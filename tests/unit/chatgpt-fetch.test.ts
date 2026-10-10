import { afterEach, describe, expect, it, vi } from "vitest";
import { chatGPTErrorCode } from "~/lib/chatgpt-errors";
import { classifyChatGPTRequest, createChatGPTFetch } from "~/lib/server/chatgpt-fetch";
import { createChatGPTGuard, MAX_TOKEN_USER_WAIT_MS } from "~/lib/server/chatgpt-guard";

afterEach(() => vi.restoreAllMocks());

/** A fetch that never answers until its signal aborts. */
const hanging = (): typeof fetch =>
    ((_input, init) =>
        new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
                reject(init.signal?.reason ?? new DOMException("Aborted", "AbortError")),
            );
        })) as typeof fetch;

const tiny = { authTimeoutMs: 30, modelsTimeoutMs: 30, headersTimeoutMs: 30, retryDelayMs: 1 };

describe("classifyChatGPTRequest", () => {
    it("separates auth, model list, responses and everything else", () => {
        expect(classifyChatGPTRequest("https://auth.openai.com/oauth/token")).toBe("auth");
        expect(
            classifyChatGPTRequest("https://auth.openai.com/api/accounts/deviceauth/usercode"),
        ).toBe("auth");
        expect(
            classifyChatGPTRequest("https://chatgpt.com/backend-api/codex/models?client_version=1"),
        ).toBe("models");
        expect(classifyChatGPTRequest("https://chatgpt.com/backend-api/codex/responses")).toBe(
            "responses",
        );
        expect(classifyChatGPTRequest("https://chatgpt.com/other")).toBe("other");
        expect(classifyChatGPTRequest("not a url")).toBe("other");
    });
});

describe("createChatGPTFetch", () => {
    it("turns a hung auth call into a retryable network_error instead of hanging", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const fetcher = createChatGPTFetch(hanging(), tiny);
        const error = await fetcher("https://auth.openai.com/oauth/token", {
            method: "POST",
        }).catch((e: unknown) => e);
        expect(chatGPTErrorCode(error)).toBe("network_error");
    });

    it("retries the model list once on a 5xx and returns the second answer", async () => {
        const base = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(new Response("bad gateway", { status: 502 }))
            .mockResolvedValueOnce(Response.json({ models: [{ slug: "gpt-6.1-sol" }] }));
        const response = await createChatGPTFetch(
            base,
            tiny,
        )("https://chatgpt.com/backend-api/codex/models");
        expect(base).toHaveBeenCalledTimes(2);
        expect(await response.json()).toEqual({ models: [{ slug: "gpt-6.1-sol" }] });
    });

    it("does not retry token calls (refresh tokens rotate)", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const base = vi
            .fn<typeof fetch>()
            .mockResolvedValue(Response.json({ error: "server_error" }, { status: 500 }));
        const response = await createChatGPTFetch(base, tiny)(
            "https://auth.openai.com/oauth/token",
            {
                method: "POST",
            },
        );
        expect(response.status).toBe(500);
        expect(base).toHaveBeenCalledTimes(1);
    });

    it("only bounds the wait for /responses headers, never the stream body", async () => {
        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
            start(controller) {
                setTimeout(() => {
                    controller.enqueue(encoder.encode("late chunk"));
                    controller.close();
                }, 90);
            },
        });
        const base = vi.fn<typeof fetch>().mockResolvedValue(new Response(body));
        const response = await createChatGPTFetch(base, tiny)(
            "https://chatgpt.com/backend-api/codex/responses",
            { method: "POST" },
        );
        // The body arrives after the 30 ms headers deadline and is still delivered.
        expect(await response.text()).toBe("late chunk");
    });

    it("keeps the caller's abort wired to the /responses stream after headers arrive", async () => {
        let upstream: AbortSignal | null | undefined;
        const base = vi.fn<typeof fetch>(async (_input, init) => {
            upstream = init?.signal;
            return new Response("streaming");
        });
        const caller = new AbortController();
        await createChatGPTFetch(base, tiny)("https://chatgpt.com/backend-api/codex/responses", {
            method: "POST",
            signal: caller.signal,
        });
        expect(upstream?.aborted).toBe(false);

        // "Stop generating" / a closed tab must still stop the upstream stream.
        caller.abort();
        expect(upstream?.aborted).toBe(true);
    });

    it("fails a /responses call that never sends headers", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const error = await createChatGPTFetch(hanging(), tiny)(
            "https://chatgpt.com/backend-api/codex/responses",
            { method: "POST" },
        ).catch((e: unknown) => e);
        expect(chatGPTErrorCode(error)).toBe("network_error");
    });

    it("passes the caller's abort through untouched", async () => {
        const controller = new AbortController();
        const pending = createChatGPTFetch(hanging(), { ...tiny, authTimeoutMs: 5_000 })(
            "https://auth.openai.com/oauth/token",
            { signal: controller.signal },
        ).catch((e: unknown) => e);
        controller.abort(new DOMException("tab closed", "AbortError"));
        const error = await pending;
        expect(chatGPTErrorCode(error)).toBeUndefined();
        expect((error as DOMException).name).toBe("AbortError");
    });
});

describe("guard", () => {
    it("validates after a bounded wait when a chat call is stuck mid-refresh", async () => {
        vi.useFakeTimers();
        try {
            const handler = {
                handler: vi.fn(async () => Response.json({ status: "authenticated" })),
            };
            const guard = createChatGPTGuard({
                getHandler: () => handler as never,
                cookieName: "lwc_session",
            });
            const request = (path: string) =>
                new Request(`http://localhost/api/chatgpt${path}`, {
                    headers: { cookie: "lwc_session=abc" },
                });

            // A token user that never settles.
            const stuck = guard.coordinate(
                request("/responses"),
                () => new Promise<never>(() => {}),
            );
            void stuck.catch(() => undefined);

            const reply = guard.handle(request("/session"));
            await vi.advanceTimersByTimeAsync(MAX_TOKEN_USER_WAIT_MS + 10);
            const response = await reply;

            expect(response.status).toBe(200);
            expect(handler.handler).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });
});
