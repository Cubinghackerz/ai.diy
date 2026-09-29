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
import { pickLatestChatGPTModel } from "~/lib/chatgpt-models";
import { createChatGPTGuard, type ChatGPTGuard } from "~/lib/server/chatgpt-guard";
import {
    isServerlessRuntime,
    resolveChatGPTSecret,
    resolveChatGPTSessionStore,
} from "~/lib/server/local-persist";
import { DEFAULT_MODELS } from "~/lib/types";

/** Stable Codex CLI version known to expose current GPT-5.6 / 5.5 catalog. */
const DEFAULT_LWC_CLIENT_VERSION = "0.147.0";
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

/** Logs why OpenAI refused a token request (status + OAuth error code only, never tokens). */
const loggingFetch: typeof fetch = async (input, init) => {
    const response = await fetch(input, init);
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!response.ok && url.includes("/oauth/token")) {
        const code = await response
            .clone()
            .json()
            .then((body: { error?: unknown }) => (typeof body?.error === "string" ? body.error : undefined))
            .catch(() => undefined);
        console.warn(`[chatgpt] OpenAI token endpoint answered ${response.status}${code ? ` (${code})` : ""}`);
    }
    return response;
};

function getRawHandler(): ChatGPTHandler {
    if (rawHandler) return rawHandler;

    const secret = resolveChatGPTSecret();

    const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

    const clientVersion =
        process.env.LWC_CLIENT_VERSION?.trim() || DEFAULT_LWC_CLIENT_VERSION;

    rawHandler = createChatGPTHandler({
        secret,
        fetch: loggingFetch,
        sessionStore: resolveChatGPTSessionStore("chatgpt-sessions.json"),
        sessionTtlMs: resolveSessionTtlMs(),
        cookieName: CHATGPT_COOKIE_NAME,
        basePath: "/api/chatgpt",
        clientVersion,
        // Fallback only. Live /models still returns the account catalog, ranked newest-first.
        defaultModel:
            pickLatestChatGPTModel((DEFAULT_MODELS.chatgpt ?? []).map((model) => model.id)) ||
            "gpt-5.6-luna",
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
export async function refreshChatGPTSessionCookie(
    request: Request,
): Promise<string | undefined> {
    const signed = readCookie(request, CHATGPT_COOKIE_NAME);
    if (!signed) return undefined;

    const session = await getChatGPTHandler().getSession(request);
    if (session.status !== "authenticated") return undefined;

    const url = new URL(request.url);
    const forwardedProtocol = request.headers
        .get("x-forwarded-proto")
        ?.split(",", 1)[0]
        ?.trim();
    return serializeCookie(CHATGPT_COOKIE_NAME, signed, {
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        secure: url.protocol === "https:" || forwardedProtocol === "https",
        maxAge: Math.floor(resolveSessionTtlMs() / 1000),
    });
}
