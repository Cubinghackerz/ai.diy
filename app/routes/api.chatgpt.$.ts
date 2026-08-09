/**
 * Login with ChatGPT — mounts createChatGPTHandler at /api/chatgpt/*.
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getChatGPTHandler } from "~/lib/server/chatgpt-auth";

async function handle(request: Request): Promise<Response> {
    return getChatGPTHandler().handler(request);
}

export function loader({ request }: LoaderFunctionArgs) {
    return handle(request);
}

export function action({ request }: ActionFunctionArgs) {
    return handle(request);
}
