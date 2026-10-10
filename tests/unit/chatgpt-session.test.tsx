import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deviceCodeDeadline, pollDelayMs, serverClockSkewMs } from "~/lib/chatgpt-errors";
import { ChatGPTSessionProvider, useChatGPTSession } from "~/lib/providers/ChatGPTSessionProvider";

vi.mock("~/lib/providers/SettingsProvider", () => ({
    useSettings: () => ({
        settings: { providers: {}, chatgptLoginEnabled: false },
        loaded: false,
        updateSettings: vi.fn(),
        updateProvider: vi.fn(),
    }),
}));

describe("device-code timing helpers", () => {
    it("reads clock skew from the Date header and ignores rounding noise", () => {
        const now = Date.parse("2026-10-10T12:00:00Z");
        expect(serverClockSkewMs("Sat, 10 Oct 2026 12:00:02 GMT", now)).toBe(0);
        expect(serverClockSkewMs("Sat, 10 Oct 2026 12:10:00 GMT", now)).toBe(10 * 60_000);
        expect(serverClockSkewMs("Sat, 10 Oct 2026 11:50:00 GMT", now)).toBe(-10 * 60_000);
        expect(serverClockSkewMs(null, now)).toBe(0);
        expect(serverClockSkewMs("garbage", now)).toBe(0);
    });

    it("expresses the code deadline on the browser's clock", () => {
        const now = 1_000_000;
        // Browser clock 10 minutes behind the server: the server's deadline is 15 min after
        // the server's "now", which must still read as ~15 minutes from the browser's.
        const skew = 10 * 60_000;
        const serverExpiresAt = now + skew + 15 * 60_000;
        expect(deviceCodeDeadline(serverExpiresAt, skew, now)).toBe(now + 15 * 60_000);
        expect(deviceCodeDeadline(undefined, 0, now)).toBe(now + 15 * 60_000);
    });

    it("backs off after failures but never beyond 15 seconds", () => {
        expect(pollDelayMs(5, 0)).toBe(5_000);
        expect(pollDelayMs(5, 1)).toBe(10_000);
        expect(pollDelayMs(5, 2)).toBe(15_000);
        expect(pollDelayMs(5, 9)).toBe(15_000);
        expect(pollDelayMs(1, 0)).toBe(2_000);
    });
});

type Handler = (init: RequestInit | undefined) => Promise<Response>;

function setup(routes: Record<string, Handler>) {
    const calls: string[] = [];
    vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const path = String(input).replace("/api/chatgpt", "");
            calls.push(path);
            const handler = routes[path];
            if (!handler) return Response.json({ status: "unauthenticated" });
            return handler(init);
        }),
    );
    return calls;
}

/** Never answers until the request is aborted, like a stalled upstream. */
const hang: Handler = (init) =>
    new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
        );
    });

const pendingLogin = (extra: Record<string, unknown> = {}) =>
    Response.json({
        status: "pending",
        userCode: "OP4S-LOVVE",
        verificationUrl: "https://auth.openai.com/codex/device",
        interval: 5,
        expiresAt: Date.now() + 15 * 60_000,
        ...extra,
    });

let api: ReturnType<typeof useChatGPTSession>;
function Probe() {
    api = useChatGPTSession();
    return (
        <p data-testid="state">
            {api.status}|{api.error ?? ""}|{api.copied ? "copied" : ""}|
            {api.copyFailed ? "copyfailed" : ""}
        </p>
    );
}
const state = () => screen.getByTestId("state").textContent ?? "";

const popup = () => ({
    closed: false,
    focus: vi.fn(),
    close: vi.fn(),
    location: { assign: vi.fn() },
});

async function flush(ms = 0) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
}

beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    vi.spyOn(window, "open").mockImplementation(() => popup() as unknown as Window);
    Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: vi.fn(async () => undefined) },
    });
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

async function mount(routes: Record<string, Handler>) {
    const calls = setup({
        "/session": async () => Response.json({ status: "unauthenticated" }),
        ...routes,
    });
    render(
        <ChatGPTSessionProvider>
            <Probe />
        </ChatGPTSessionProvider>,
    );
    await flush(0);
    expect(state().startsWith("unauthenticated")).toBe(true);
    return calls;
}

describe("sign-in flow", () => {
    it("gives up on a hung /login instead of staying on Connecting forever", async () => {
        await mount({ "/login": hang });
        act(() => api.login());
        expect(state().startsWith("starting")).toBe(true);

        // Two bounded attempts (30 s each) plus the retry pause.
        await flush(65_000);

        expect(state()).toContain("unauthenticated|OpenAI is taking too long");
    });

    it("lets the user cancel while Connecting, and ignores the late response", async () => {
        let release: (response: Response) => void = () => undefined;
        const calls = await mount({
            "/login": () => new Promise<Response>((resolve) => (release = resolve)),
        });
        act(() => api.login());
        expect(state().startsWith("starting")).toBe(true);

        act(() => api.cancel());
        expect(state().startsWith("unauthenticated")).toBe(true);

        await act(async () => release(pendingLogin()));
        await flush(20_000);

        expect(state().startsWith("unauthenticated")).toBe(true);
        expect(calls).not.toContain("/status");
    });

    it("shows the code and starts polling even if the clipboard never answers", async () => {
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: { writeText: () => new Promise(() => undefined) },
        });
        const calls = await mount({
            "/login": async () => pendingLogin(),
            "/status": async () => Response.json({ status: "pending" }),
        });
        act(() => api.login());
        await flush(0);

        expect(state().startsWith("pending")).toBe(true);
        expect(api.userCode).toBe("OP4S-LOVVE");

        await flush(2_000);
        expect(calls).toContain("/status");

        // After the clipboard deadline the UI says so instead of claiming it copied.
        await flush(2_000);
        expect(state()).toContain("copyfailed");
    });

    it("retries a transient 502 once and then shows the code", async () => {
        let attempts = 0;
        await mount({
            "/login": async () => {
                attempts += 1;
                return attempts === 1
                    ? Response.json(
                          { status: "error", error: "device_code_request_failed" },
                          { status: 502 },
                      )
                    : pendingLogin();
            },
        });
        act(() => api.login());
        await flush(3_000);

        expect(attempts).toBe(2);
        expect(state().startsWith("pending")).toBe(true);
    });

    it("does not retry a failure that cannot succeed", async () => {
        let attempts = 0;
        await mount({
            "/login": async () => {
                attempts += 1;
                return Response.json(
                    { status: "error", error: "device_code_disabled" },
                    { status: 502 },
                );
            },
        });
        act(() => api.login());
        await flush(3_000);

        expect(attempts).toBe(1);
        expect(state()).toContain("unauthenticated|OpenAI has device-code sign-in turned off");
    });
});

describe("cross-tab sync", () => {
    it("re-checks the session when another tab changes the connected flag", async () => {
        const calls = await mount({});
        const before = calls.filter((path) => path === "/session").length;

        await act(async () => {
            window.dispatchEvent(
                new StorageEvent("storage", { key: "prismium:chatgpt-connected", newValue: "1" }),
            );
        });
        await flush(0);

        expect(calls.filter((path) => path === "/session").length).toBe(before + 1);
    });
});
