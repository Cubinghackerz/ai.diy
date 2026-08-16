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
import {
    FileKeyValueStore,
    resolveChatGPTSecret,
} from "~/lib/server/local-persist";

/** Stable Codex CLI version known to expose current GPT-5.6 / 5.5 catalog. */
const DEFAULT_LWC_CLIENT_VERSION = "0.147.0";
const DEFAULT_LWC_SESSION_DAYS = 180;
const CHATGPT_COOKIE_NAME = "lwc_session";

function resolveSessionTtlMs(): number {
    const configured = Number(process.env.LWC_SESSION_DAYS);
    const days = Number.isFinite(configured)
        ? Math.min(365, Math.max(1, configured))
        : DEFAULT_LWC_SESSION_DAYS;
    return days * 24 * 60 * 60 * 1000;
}

let handler: ChatGPTHandler | null = null;

export function getChatGPTHandler(): ChatGPTHandler {
    if (handler) return handler;

    const secret = resolveChatGPTSecret();
    if (!process.env.LWC_SECRET?.trim() && process.env.NODE_ENV === "production") {
        console.warn(
            "[chatgpt] Using a local .data/lwc-secret. Set LWC_SECRET for multi-instance production so every replica shares the same cookie key.",
        );
    }

    const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

    const clientVersion =
        process.env.LWC_CLIENT_VERSION?.trim() || DEFAULT_LWC_CLIENT_VERSION;

    handler = createChatGPTHandler({
        secret,
        sessionStore: new FileKeyValueStore("chatgpt-sessions.json"),
        sessionTtlMs: resolveSessionTtlMs(),
        cookieName: CHATGPT_COOKIE_NAME,
        basePath: "/api/chatgpt",
        clientVersion,
        // Prefer latest Codex default; live discovery still picks the account's best.
        defaultModel: "gpt-5.6",
        allowedOrigins: allowedOrigins.length ? allowedOrigins : undefined,
        responsesProxy: {
            // Unset allowedModels → any model the signed-in account can use.
            rateLimit: {
                limit: 30,
                windowMs: 60_000,
            },
        },
    });

    return handler;
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
