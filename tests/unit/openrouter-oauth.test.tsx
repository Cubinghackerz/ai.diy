import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenRouterReturn } from "~/components/setup/OpenRouterConnect";
import {
    OPENROUTER_KEY_URL,
    OpenRouterOAuthError,
    buildOpenRouterAuthUrl,
    completeOpenRouterSignIn,
    createPkcePair,
    readOpenRouterCode,
    startOpenRouterSignIn,
} from "~/lib/openrouter-oauth.client";
import { SettingsProvider, useSettings } from "~/lib/providers/SettingsProvider";

const { decrypt, encrypt } = vi.hoisted(() => ({ decrypt: vi.fn(), encrypt: vi.fn() }));
vi.mock("~/lib/settings-crypto", async (original) => ({
    ...(await original<typeof import("~/lib/settings-crypto")>()),
    settingsCryptoAvailable: () => true,
    decryptSettingsPayload: decrypt,
    encryptSettingsPayload: encrypt,
}));

beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    decrypt.mockResolvedValue(null);
    encrypt.mockResolvedValue("test-ciphertext");
    window.history.replaceState(null, "", "/workspace");
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    });
});
afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
});

const sha256Base64Url = async (value: string) => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
};

describe("PKCE", () => {
    it("derives the challenge from the verifier with S256 and base64url", async () => {
        const { verifier, challenge } = await createPkcePair();
        expect(verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
        expect(challenge).toBe(await sha256Base64Url(verifier));
        expect((await createPkcePair()).verifier).not.toBe(verifier);
    });

    it("builds the authorize URL with the callback and challenge", () => {
        const url = new URL(buildOpenRouterAuthUrl("https://ai.diy/workspace", "abc"));
        expect(url.origin + url.pathname).toBe("https://openrouter.ai/auth");
        expect(url.searchParams.get("callback_url")).toBe("https://ai.diy/workspace");
        expect(url.searchParams.get("code_challenge")).toBe("abc");
        expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    });
});

describe("starting and finishing a sign-in", () => {
    it("sends the user to OpenRouter and remembers the verifier for this tab only", async () => {
        const navigate = vi.fn();
        await startOpenRouterSignIn(navigate);
        const target = new URL(navigate.mock.calls[0][0]);
        expect(target.searchParams.get("callback_url")).toBe(`${window.location.origin}/workspace`);
        const stored = JSON.parse(sessionStorage.getItem("aidiy:openrouter-oauth")!);
        expect(await sha256Base64Url(stored.verifier)).toBe(
            target.searchParams.get("code_challenge"),
        );
        // Not in localStorage: it must not outlive the tab.
        expect(localStorage.getItem("aidiy:openrouter-oauth")).toBeNull();
    });

    it("only treats ?code as a return trip when this tab started a sign-in", async () => {
        expect(readOpenRouterCode("?code=abc")).toBeNull();
        await startOpenRouterSignIn(vi.fn());
        expect(readOpenRouterCode("?code=abc")).toBe("abc");
        expect(readOpenRouterCode("?other=1")).toBeNull();
        expect(readOpenRouterCode(`?code=${"x".repeat(600)}`)).toBeNull();
    });

    it("exchanges the code with the verifier and returns the key", async () => {
        await startOpenRouterSignIn(vi.fn());
        const verifier = JSON.parse(sessionStorage.getItem("aidiy:openrouter-oauth")!).verifier;
        const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({ key: " sk-or-v1-abc " }));
        await expect(completeOpenRouterSignIn("the-code", fetchImpl)).resolves.toBe("sk-or-v1-abc");

        const [url, init] = fetchImpl.mock.calls[0];
        expect(url).toBe(OPENROUTER_KEY_URL);
        expect(JSON.parse(String(init?.body))).toEqual({
            code: "the-code",
            code_verifier: verifier,
            code_challenge_method: "S256",
        });
        // Single use: the verifier is gone after one attempt.
        expect(sessionStorage.getItem("aidiy:openrouter-oauth")).toBeNull();
    });

    it("explains an expired or foreign sign-in instead of calling OpenRouter", async () => {
        const fetchImpl = vi.fn<typeof fetch>();
        await expect(completeOpenRouterSignIn("c", fetchImpl)).rejects.toMatchObject({
            code: "expired",
        });
        sessionStorage.setItem(
            "aidiy:openrouter-oauth",
            JSON.stringify({ verifier: "v", startedAt: Date.now() - 31 * 60_000 }),
        );
        await expect(completeOpenRouterSignIn("c", fetchImpl)).rejects.toBeInstanceOf(
            OpenRouterOAuthError,
        );
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it.each([
        ["a rejected code", () => new Response("no", { status: 403 }), "rejected"],
        ["a server error", () => new Response("no", { status: 500 }), "rejected"],
        ["a response without a key", () => Response.json({ nope: true }), "invalid"],
        ["an empty key", () => Response.json({ key: "  " }), "invalid"],
    ])("fails cleanly on %s", async (_name, respond, code) => {
        await startOpenRouterSignIn(vi.fn());
        await expect(
            completeOpenRouterSignIn(
                "c",
                vi.fn<typeof fetch>(async () => respond()),
            ),
        ).rejects.toMatchObject({ code });
    });

    it("reports a network failure without leaking details", async () => {
        await startOpenRouterSignIn(vi.fn());
        const error = await completeOpenRouterSignIn(
            "secret-code",
            vi.fn<typeof fetch>(async () => {
                throw new TypeError("Failed to fetch https://x/?code=secret-code");
            }),
        ).then(
            () => null,
            (failure: unknown) => failure as OpenRouterOAuthError,
        );
        expect(error?.code).toBe("network");
        expect(error?.message).not.toContain("secret-code");
    });
});

describe("returning from OpenRouter", () => {
    let api: ReturnType<typeof useSettings> | null = null;
    function Probe() {
        api = useSettings();
        return null;
    }
    const mount = () =>
        render(
            <SettingsProvider>
                <Probe />
                <OpenRouterReturn />
            </SettingsProvider>,
        );

    it("saves the key, makes OpenRouter active, finishes setup, and cleans the URL", async () => {
        await startOpenRouterSignIn(vi.fn());
        window.history.replaceState(null, "", "/workspace?code=abc123");
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => Response.json({ key: "sk-or-v1-from-oauth" })),
        );
        mount();

        await waitFor(() =>
            expect(api?.settings.providers.openrouter?.apiKey).toBe("sk-or-v1-from-oauth"),
        );
        expect(api!.settings.chat.provider).toBe("openrouter");
        expect(api!.settings.providers.openrouter?.enabled).toBe(true);
        expect(api!.settings.setupComplete).toBe(true);
        expect(window.location.search).toBe("");
        expect(window.location.pathname).toBe("/workspace");
    });

    it("keeps the user's current provider when they sign in from Settings", async () => {
        localStorage.setItem(
            "prismium-lite:settings",
            JSON.stringify({
                setupComplete: true,
                chat: { provider: "openai", model: "gpt-4o" },
                providers: { openai: { id: "openai", enabled: true, apiKey: "sk-existing-key" } },
            }),
        );
        await startOpenRouterSignIn(vi.fn());
        window.history.replaceState(null, "", "/workspace?code=abc123");
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => Response.json({ key: "sk-or-v1-second" })),
        );
        mount();

        await waitFor(() =>
            expect(api?.settings.providers.openrouter?.apiKey).toBe("sk-or-v1-second"),
        );
        expect(api!.settings.chat.provider).toBe("openai");
    });

    it("shows what went wrong and keeps setup open when the exchange fails", async () => {
        await startOpenRouterSignIn(vi.fn());
        window.history.replaceState(null, "", "/workspace?code=bad");
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response("no", { status: 403 })),
        );
        mount();

        expect((await screen.findByRole("alert")).textContent).toMatch(
            /didn't accept that sign-in/i,
        );
        await act(async () => undefined);
        expect(api!.settings.setupComplete).toBe(false);
        expect(api!.settings.providers.openrouter?.apiKey ?? "").toBe("");
    });

    it("ignores a ?code that this tab never asked for", async () => {
        window.history.replaceState(null, "", "/workspace?code=unrelated");
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        mount();
        await waitFor(() => expect(api?.loaded).toBe(true));
        expect(fetchMock).not.toHaveBeenCalled();
        expect(window.location.search).toBe("?code=unrelated");
    });
});
