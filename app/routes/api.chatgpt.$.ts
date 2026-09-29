/**
 * Login with ChatGPT — mounts createChatGPTHandler at /api/chatgpt/*.
 *
 * Wrapper responsibilities on top of the SDK handler:
 * - `GET /session` validates the session (advances it via `/status`) so tokens
 *   are renewed and a revoked session reports `expired` instead of a stale
 *   "authenticated". Concurrent validations of one cookie are coalesced so
 *   refresh-token rotation is never raced by our own polling.
 * - SDK failures become stable JSON `{ status: "error", error, message }`
 *   responses instead of opaque 500s.
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
    CHATGPT_COOKIE_NAME,
    getChatGPTHandler,
    refreshChatGPTSessionCookie,
} from "~/lib/server/chatgpt-auth";
import { readCookie } from "@opencoredev/loginwithchatgpt-server";
import { chatGPTErrorCode, describeChatGPTError } from "~/lib/chatgpt-errors";

const validations = new Map<string, Promise<{ status: number; body: string }>>();

function errorResponse(error: unknown): Response {
    const code = chatGPTErrorCode(error);
    const info = describeChatGPTError(code);
    if (!code) console.error("[chatgpt] unexpected route error", error);
    return Response.json(
        { status: "error", error: code ?? "unknown", message: info.message, retryable: info.retryable },
        { status: info.status },
    );
}

async function runValidation(request: Request): Promise<{ status: number; body: string }> {
    const url = new URL(request.url);
    url.pathname = url.pathname.replace(/\/session$/, "/status");
    const response = await getChatGPTHandler().handler(new Request(url, request));
    return { status: response.status, body: await response.text() };
}

async function validateSession(request: Request): Promise<Response> {
    const key = readCookie(request, CHATGPT_COOKIE_NAME);
    let pending = key ? validations.get(key) : undefined;
    if (!pending) {
        pending = runValidation(request);
        if (key) {
            validations.set(key, pending);
            void pending
                .finally(() => validations.delete(key))
                .catch(() => undefined);
        }
    }
    const { status, body } = await pending;
    return new Response(body, { status, headers: { "content-type": "application/json" } });
}

async function handle(request: Request): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    const isSession = request.method === "GET" && pathname.endsWith("/session");
    let response: Response;
    try {
        response = isSession
            ? await validateSession(request)
            : await getChatGPTHandler().handler(request);
    } catch (error) {
        response = errorResponse(error);
    }
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    if (response.ok && (isSession || pathname.endsWith("/status"))) {
        const cookie = await refreshChatGPTSessionCookie(request).catch(() => undefined);
        if (cookie) headers.append("Set-Cookie", cookie);
    }
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}

export function loader({ request }: LoaderFunctionArgs) {
    return handle(request);
}

export function action({ request }: ActionFunctionArgs) {
    return handle(request);
}
