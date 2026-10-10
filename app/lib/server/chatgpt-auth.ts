/**
 * Login with ChatGPT — shared server handler (HttpOnly session cookie).
 * Tokens never leave this handler; use proxyFetch / getModels / getSession.
 *
 * Do not hardcode allowedModels: availability is per account/plan. Discover via
 * auth.getModels(request) and let the signed-in account decide.
 *
 * `clientVersion` must track a current Codex CLI release — ChatGPT gates the
 * model catalog on it. Override with LWC_CLIENT_VERSION if needed.
 */

import {
    createChatGPTHandler,
    readCookie,
    serializeCookie,
    type ChatGPTHandler,
} from "@opencoredev/loginwithchatgpt-server";
import { CHATGPT_SAFE_DEFAULT } from "~/lib/chatgpt-models";
import { createChatGPTFetch } from "~/lib/server/chatgpt-fetch";
import { createChatGPTGuard, type ChatGPTGuard } from "~/lib/server/chatgpt-guard";
import {
    isServerlessRuntime,
    resolveChatGPTSecret,
    resolveChatGPTSessionStore,
} from "~/lib/server/local-persist";

/**
 * Codex CLI version reported to ChatGPT. The account's model catalog is gated
 * on it: clients that report an old version are silently denied newer models
 * (GPT-6 / GPT-6.1 Sol and Luna are only listed for recent releases), so a stale
 * value is indistinguishable from "this plan has no new models". 0.162.1 was the
 * current stable release on 2026-10-09. Raise it when new models stop appearing,
 * or override per deployment with LWC_CLIENT_VERSION.
 */
export const DEFAULT_LWC_CLIENT_VERSION = "0.162.1";
const DEFAULT_LWC_SESSION_DAYS = 180;
export const CHATGPT_COOKIE_NAME = "lwc_session";

function resolveSessionTtlMs(): number {
    const configured = Number(process.env.LWC_SESSION_DAYS);
    const days = Number.isFinite(configured)
        ? Math.min(365, Math.max(1, configured))
        : DEFAULT_LWC_SESSION_DAYS;
    return days * 24 * 60 * 60 * 1000;
}

let rawHandler: ChatGPTHandler | null = null;
let guardedHandler: ChatGPTHandler | null = null;
let guard: ChatGPTGuard | null = null;

/**
 * Whether a sign-in can outlive this process. Serverless hosts need both a
 * shared store (Redis) and a fixed secret; without them every cold start or
 * instance swap silently drops the session and the user must reconnect.
 */
export function chatGPTPersistence(): "durable" | "ephemeral" {
    if (!isServerlessRuntime()) return "durable";
    const redis =
        (process.env.UPSTASH_REDIS_REST_URL?.trim() || process.env.KV_REST_API_URL?.trim()) &&
        (process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || process.env.KV_REST_API_TOKEN?.trim());
    return redis && process.env.LWC_SECRET?.trim() ? "durable" : "ephemeral";
}

function getRawHandler(): ChatGPTHandler {
    if (rawHandler) return rawHandler;

    const secret = resolveChatGPTSecret();

    const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

    const clientVersion = process.env.LWC_CLIENT_VERSION?.trim() || DEFAULT_LWC_CLIENT_VERSION;

    rawHandler = createChatGPTHandler({
        secret,
        fetch: createChatGPTFetch(),
        sessionStore: resolveChatGPTSessionStore("chatgpt-sessions.json"),
        sessionTtlMs: resolveSessionTtlMs(),
        cookieName: CHATGPT_COOKIE_NAME,
        basePath: "/api/chatgpt",
        clientVersion,
        // Only used if a request omits `model` (ours never do). Live /models still
        // returns the account's catalog, ranked newest-first.
        defaultModel: CHATGPT_SAFE_DEFAULT,
        allowedOrigins: allowedOrigins.length ? allowedOrigins : undefined,
        responsesProxy: {
            // Unset allowedModels → any model the signed-in account can use.
            rateLimit: {
                limit: 30,
                windowMs: 60_000,
            },
        },
    });

    return rawHandler;
}

/** The one guard shared by the `/api/chatgpt/*` route and in-process chat callers. */
export function getChatGPTGuard(): ChatGPTGuard {
    guard ??= createChatGPTGuard({
        getHandler: getRawHandler,
        cookieName: CHATGPT_COOKIE_NAME,
        renewCookie: refreshChatGPTSessionCookie,
        persistence: chatGPTPersistence,
    });
    return guard;
}

/**
 * The SDK handler for server code (chat, titles, model lists). `proxyFetch` and
 * `getModels` are coordinated with session validation so a token is never
 * rotated by two callers at once — see chatgpt-guard.ts.
 */
export function getChatGPTHandler(): ChatGPTHandler {
    guardedHandler ??= getChatGPTGuard().wrap(getRawHandler());
    return guardedHandler;
}

/** Renews an authenticated browser cookie without changing its signed value. */
export async function refreshChatGPTSessionCookie(request: Request): Promise<string | undefined> {
    const signed = readCookie(request, CHATGPT_COOKIE_NAME);
    if (!signed) return undefined;

    const session = await getChatGPTHandler().getSession(request);
    if (session.status !== "authenticated") return undefined;

    const url = new URL(request.url);
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
    return serializeCookie(CHATGPT_COOKIE_NAME, signed, {
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        secure: url.protocol === "https:" || forwardedProtocol === "https",
        maxAge: Math.floor(resolveSessionTtlMs() / 1000),
    });
}
