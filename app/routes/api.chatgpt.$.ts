/**
 * Login with ChatGPT — mounts createChatGPTHandler at /api/chatgpt/*.
 *
 * All requests go through the session guard (app/lib/server/chatgpt-guard.ts),
 * which serializes token refreshes per session, keeps a stray sign-in click
 * from wiping a live session, validates `GET /session`, and maps SDK failures
 * to stable JSON.
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getChatGPTGuard } from "~/lib/server/chatgpt-auth";

export function loader({ request }: LoaderFunctionArgs) {
    return getChatGPTGuard().handle(request);
}

export function action({ request }: ActionFunctionArgs) {
    return getChatGPTGuard().handle(request);
}
