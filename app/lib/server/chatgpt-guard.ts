/**
 * Session-safety layer in front of the Login with ChatGPT SDK handler.
 *
 * ChatGPT refresh tokens rotate: using one twice kills the session. The SDK has
 * two independent refresh paths that do not know about each other, plus a
 * login route that overwrites whatever session it finds:
 *
 * - `GET /status` (`advance()`) refreshes with no in-flight guard and DELETES
 *   the session when the refresh token looks reused.
 * - `/models` and `/responses` (`getFreshTokens()`) refresh under their own
 *   per-session guard, invisible to `advance()`.
 * - `POST /login` replaces an authenticated record with a pending one, wiping
 *   its tokens even if the new sign-in is never completed.
 *
 * Left alone, a session check racing a chat request, or a stray "Connect"
 * click, silently ends a working login and forces a reconnect. This guard:
 *
 * 1. Runs at most one validation (`/session`, `/status`) per session cookie.
 * 2. Makes validation wait for chat/model requests that are mid-refresh, and
 *    chat/model requests wait for a validation that is mid-refresh, so a token
 *    is only ever rotated by one caller at a time.
 * 3. Answers `POST /login` on a live session with "authenticated" instead of
 *    starting a new sign-in (a dead session falls through to a real login).
 * 4. Maps SDK failures to stable JSON and adds no-store/noindex headers.
 */

import { readCookie, type ChatGPTHandler } from "@opencoredev/loginwithchatgpt-server";
import { chatGPTErrorCode, describeChatGPTError } from "~/lib/chatgpt-errors";

type Reply = { status: number; body: string };

export type ChatGPTGuardOptions = {
    getHandler: () => ChatGPTHandler;
    cookieName?: string;
    /** Extra `Set-Cookie` to attach to a successful validation (sliding expiry). */
    renewCookie?: (request: Request) => Promise<string | undefined>;
    /** Reported to the UI so it can explain sign-ins that cannot survive restarts. */
    persistence?: () => "durable" | "ephemeral";
};

const TOKEN_ROUTES = ["/models", "/responses"];

function errorResponse(error: unknown): Response {
    const code = chatGPTErrorCode(error);
    const info = describeChatGPTError(code);
    if (!code) console.error("[chatgpt] unexpected route error", error);
    return Response.json(
        { status: "error", error: code ?? "unknown", message: info.message, retryable: info.retryable },
        { status: info.status },
    );
}

export type ChatGPTGuard = ReturnType<typeof createChatGPTGuard>;

export function createChatGPTGuard(options: ChatGPTGuardOptions) {
    const cookieName = options.cookieName ?? "lwc_session";
    /** In-flight validation per session cookie. */
    const validations = new Map<string, Promise<Reply>>();
    /** In-flight chat/model requests per cookie, until their token step is done. */
    const tokenUsers = new Map<string, Set<Promise<unknown>>>();

    const routeOf = (request: Request) => new URL(request.url).pathname;

    /** `/session` and `/login` both check the session through the SDK's `/status`. */
    function toStatusRequest(request: Request): Request {
        const url = new URL(request.url);
        url.pathname = url.pathname.replace(/\/(session|login)$/, "/status");
        return new Request(url, { method: "GET", headers: request.headers });
    }

    function validate(request: Request, key: string | undefined): Promise<Reply> {
        const existing = key ? validations.get(key) : undefined;
        if (existing) return existing;

        // Snapshot synchronously: anything registered after this waits for us instead.
        const inFlightUsers = key ? [...(tokenUsers.get(key) ?? [])] : [];
        const run = (async (): Promise<Reply> => {
            if (inFlightUsers.length) await Promise.allSettled(inFlightUsers);
            const response = await options.getHandler().handler(toStatusRequest(request));
            return { status: response.status, body: await response.text() };
        })();

        if (key) {
            validations.set(key, run);
            const cleanup = () => {
                if (validations.get(key) === run) validations.delete(key);
            };
            run.then(cleanup, cleanup);
        }
        return run;
    }

    /**
     * Runs a call that may rotate the session's tokens (chat, model list).
     * Waits for a validation that is mid-refresh, and registers itself so a
     * validation starting meanwhile waits for it. Resolves when the call
     * resolves (for streaming proxies that is response headers, not the body).
     */
    async function coordinate<T>(request: Request, run: () => Promise<T>): Promise<T> {
        const key = readCookie(request, cookieName);
        if (!key) return run();

        while (validations.has(key)) {
            await validations.get(key)!.catch(() => undefined);
        }
        // No await between the check above and registering below.
        const call = Promise.resolve().then(run);
        const users = tokenUsers.get(key) ?? new Set<Promise<unknown>>();
        tokenUsers.set(key, users);
        users.add(call);
        const done = () => {
            users.delete(call);
            if (users.size === 0 && tokenUsers.get(key) === users) tokenUsers.delete(key);
        };
        call.then(done, done);
        return call;
    }

    /** The SDK handler with `proxyFetch`/`getModels` routed through {@link coordinate}. */
    function wrap(handler: ChatGPTHandler): ChatGPTHandler {
        return {
            ...handler,
            proxyFetch: (request) => {
                const inner = handler.proxyFetch(request);
                return ((input: RequestInfo | URL, init?: RequestInit) =>
                    coordinate(request, () => inner(input, init))) as typeof fetch;
            },
            getModels: (request) => coordinate(request, () => handler.getModels(request)),
        };
    }

    /** `POST /login`: never replace a working session with a pending one. */
    async function login(request: Request, key: string | undefined): Promise<Response> {
        const handler = options.getHandler();
        if (key) {
            const current = await handler.getSession(request);
            if (current.status === "authenticated") {
                const reply = await validate(request, key);
                const json = { "content-type": "application/json" };
                if (reply.status >= 400) return new Response(reply.body, { status: reply.status, headers: json });
                const parsed = JSON.parse(reply.body || "{}") as { status?: string };
                if (parsed.status === "authenticated") {
                    return new Response(reply.body, { status: 200, headers: json });
                }
                // The session really was dead (the SDK cleared it): sign in for real.
            }
        }
        return handler.handler(request);
    }

    async function withPersistence(reply: Reply): Promise<Reply> {
        if (!options.persistence) return reply;
        try {
            const parsed = JSON.parse(reply.body) as Record<string, unknown>;
            return { ...reply, body: JSON.stringify({ ...parsed, persistence: options.persistence() }) };
        } catch {
            return reply;
        }
    }

    async function dispatch(request: Request): Promise<Response> {
        const pathname = routeOf(request);
        const key = readCookie(request, cookieName);
        const isRead = request.method === "GET";

        if (isRead && (pathname.endsWith("/session") || pathname.endsWith("/status"))) {
            const reply = await withPersistence(await validate(request, key));
            return new Response(reply.body, {
                status: reply.status,
                headers: { "content-type": "application/json" },
            });
        }
        if (request.method === "POST" && pathname.endsWith("/login")) return login(request, key);
        if (TOKEN_ROUTES.some((route) => pathname.endsWith(route))) {
            return coordinate(request, () => options.getHandler().handler(request));
        }
        return options.getHandler().handler(request);
    }

    async function handle(request: Request): Promise<Response> {
        const pathname = routeOf(request);
        const advancing =
            request.method === "GET" &&
            (pathname.endsWith("/session") || pathname.endsWith("/status"));
        let response: Response;
        try {
            response = await dispatch(request);
        } catch (error) {
            response = errorResponse(error);
        }
        const headers = new Headers(response.headers);
        headers.set("Cache-Control", "no-store");
        headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
        if (response.ok && advancing && options.renewCookie) {
            const cookie = await options.renewCookie(request).catch(() => undefined);
            if (cookie) headers.append("Set-Cookie", cookie);
        }
        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });
    }

    return { handle, coordinate, wrap };
}
