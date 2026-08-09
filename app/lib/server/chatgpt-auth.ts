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
    type ChatGPTHandler,
} from "@opencoredev/loginwithchatgpt-server";

/** Stable Codex CLI version known to expose current GPT-5.6 / 5.5 catalog. */
const DEFAULT_LWC_CLIENT_VERSION = "0.147.0";

let handler: ChatGPTHandler | null = null;

export function getChatGPTHandler(): ChatGPTHandler {
    if (handler) return handler;

    const secret = process.env.LWC_SECRET?.trim();
    if (!secret && process.env.NODE_ENV === "production") {
        console.warn(
            "[chatgpt] LWC_SECRET is unset — sessions will not survive restarts or span instances. Set LWC_SECRET (openssl rand -hex 32).",
        );
    }

    const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

    const clientVersion =
        process.env.LWC_CLIENT_VERSION?.trim() || DEFAULT_LWC_CLIENT_VERSION;

    handler = createChatGPTHandler({
        secret: secret || undefined,
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
