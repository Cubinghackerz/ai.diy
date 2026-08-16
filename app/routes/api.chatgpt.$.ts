/**
 * Login with ChatGPT — mounts createChatGPTHandler at /api/chatgpt/*.
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
    getChatGPTHandler,
    refreshChatGPTSessionCookie,
} from "~/lib/server/chatgpt-auth";

async function handle(request: Request): Promise<Response> {
    const response = await getChatGPTHandler().handler(request);
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    const pathname = new URL(request.url).pathname;
    if (pathname.endsWith("/session") || pathname.endsWith("/status")) {
        const cookie = await refreshChatGPTSessionCookie(request);
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
