/**
 * The `fetch` handed to the Login with ChatGPT SDK.
 *
 * The SDK calls OpenAI with a bare `fetch`, so a connection that is accepted
 * but never answered hangs forever. That is worse than it sounds: the guard
 * shares one in-flight validation per session, so a single stuck refresh or
 * device poll would also stall every later status check and chat for that
 * session until the server restarted. Every non-streaming call therefore gets
 * a deadline, and `/responses` gets one for response headers only (the body is
 * a long-lived stream and must never be cut off).
 *
 * Timeouts surface as a `ChatGPTAuthError`-shaped `network_error`, which the
 * route maps to a retryable 503 the UI already knows how to handle. Refreshing
 * a token is never retried here: OpenAI rotates refresh tokens, so replaying a
 * request that may have reached it could kill the session.
 */

export const CHATGPT_AUTH_TIMEOUT_MS = 20_000;
export const CHATGPT_MODELS_TIMEOUT_MS = 15_000;
export const CHATGPT_RESPONSES_HEADERS_TIMEOUT_MS = 120_000;
const MODELS_RETRY_DELAY_MS = 400;

export type ChatGPTFetchOptions = {
    authTimeoutMs?: number;
    modelsTimeoutMs?: number;
    headersTimeoutMs?: number;
    retryDelayMs?: number;
};

export type ChatGPTRequestKind = "auth" | "models" | "responses" | "other";

export function classifyChatGPTRequest(url: string): ChatGPTRequestKind {
    let pathname: string;
    try {
        pathname = new URL(url).pathname;
    } catch {
        return "other";
    }
    if (pathname.endsWith("/oauth/token") || pathname.includes("/deviceauth/")) return "auth";
    if (pathname.endsWith("/models")) return "models";
    if (pathname.endsWith("/responses")) return "responses";
    return "other";
}

/** `ChatGPTAuthError`-shaped (see `chatGPTErrorCode`) without importing the SDK's core package. */
function networkError(message: string, cause?: unknown): Error {
    const error = new Error(message, cause === undefined ? undefined : { cause });
    error.name = "ChatGPTAuthError";
    (error as Error & { code: string }).code = "network_error";
    return error;
}

function inputUrl(input: Parameters<typeof fetch>[0]): string {
    return typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
}

function abortReason(signal: AbortSignal): unknown {
    return signal.reason ?? new DOMException("Aborted", "AbortError");
}

const isTimeout = (error: unknown) =>
    error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError");

async function withDeadline(
    base: typeof fetch,
    input: Parameters<typeof fetch>[0],
    init: RequestInit | undefined,
    ms: number,
    label: string,
): Promise<Response> {
    const signals = [AbortSignal.timeout(ms)];
    if (init?.signal) signals.push(init.signal);
    const signal = signals.length > 1 ? AbortSignal.any(signals) : signals[0];
    try {
        return await base(input, { ...init, signal });
    } catch (error) {
        // The caller (a closed browser tab) aborting is not an upstream failure.
        if (init?.signal?.aborted) throw error;
        if (isTimeout(error) || signal.aborted) {
            console.warn(`[chatgpt] OpenAI ${label} request timed out after ${ms} ms`);
            throw networkError(
                `OpenAI did not answer the ${label} request in time.`,
                abortReason(signal),
            );
        }
        throw error;
    }
}

/**
 * For `/responses` only the wait for response headers is bounded; once they
 * arrive the timer is cleared and the stream runs for as long as it needs.
 */
async function withHeadersDeadline(
    base: typeof fetch,
    input: Parameters<typeof fetch>[0],
    init: RequestInit | undefined,
    ms: number,
): Promise<Response> {
    const controller = new AbortController();
    const onCallerAbort = () => controller.abort(abortReason(init!.signal!));
    if (init?.signal) {
        if (init.signal.aborted) onCallerAbort();
        else init.signal.addEventListener("abort", onCallerAbort, { once: true });
    }
    let timedOut = false;
    const timer = setTimeout(() => {
        timedOut = true;
        controller.abort(new DOMException("Timed out", "TimeoutError"));
    }, ms);
    try {
        return await base(input, { ...init, signal: controller.signal });
    } catch (error) {
        if (timedOut) {
            console.warn(`[chatgpt] OpenAI responses request sent no headers within ${ms} ms`);
            throw networkError("OpenAI did not start answering in time.", error);
        }
        throw error;
    } finally {
        clearTimeout(timer);
        init?.signal?.removeEventListener("abort", onCallerAbort);
    }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Logs why OpenAI refused a token request (status + OAuth error code only, never tokens). */
async function logTokenFailure(response: Response, url: string): Promise<void> {
    if (response.ok || !new URL(url).pathname.endsWith("/oauth/token")) return;
    const code = await response
        .clone()
        .json()
        .then((body: { error?: unknown }) =>
            typeof body?.error === "string" ? body.error : undefined,
        )
        .catch(() => undefined);
    console.warn(
        `[chatgpt] OpenAI token endpoint answered ${response.status}${code ? ` (${code})` : ""}`,
    );
}

export function createChatGPTFetch(
    base: typeof fetch = fetch,
    options: ChatGPTFetchOptions = {},
): typeof fetch {
    const authMs = options.authTimeoutMs ?? CHATGPT_AUTH_TIMEOUT_MS;
    const modelsMs = options.modelsTimeoutMs ?? CHATGPT_MODELS_TIMEOUT_MS;
    const headersMs = options.headersTimeoutMs ?? CHATGPT_RESPONSES_HEADERS_TIMEOUT_MS;
    const retryMs = options.retryDelayMs ?? MODELS_RETRY_DELAY_MS;
    return (async (input, init) => {
        const url = inputUrl(input);
        const kind = classifyChatGPTRequest(url);

        if (kind === "responses") {
            return withHeadersDeadline(base, input, init, headersMs);
        }

        if (kind === "models") {
            const attempt = () => withDeadline(base, input, init, modelsMs, "model list");
            // A GET with no side effects: one quick retry rides out a blip.
            try {
                const first = await attempt();
                if (first.status < 500 && first.status !== 429) return first;
                await first.body?.cancel().catch(() => undefined);
            } catch (error) {
                if (init?.signal?.aborted) throw error;
            }
            await sleep(retryMs);
            return attempt();
        }

        if (kind === "auth") {
            const response = await withDeadline(
                base,
                input,
                init,
                authMs,
                url.includes("/deviceauth/") ? "device sign-in" : "token",
            );
            await logTokenFailure(response, url);
            return response;
        }

        return base(input, init);
    }) as typeof fetch;
}
