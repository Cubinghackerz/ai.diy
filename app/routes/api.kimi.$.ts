import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
    getKimiSessionResponse,
    logoutKimi,
    startKimiLogin,
} from "~/lib/server/kimi-auth";

function endpoint(request: Request): string {
    return new URL(request.url).pathname.replace(/^.*\/api\/kimi\/?/, "");
}

async function handle(request: Request): Promise<Response> {
    const name = endpoint(request);
    if (name === "login" && request.method === "GET") {
        return startKimiLogin(request);
    }
    if (name === "session" && request.method === "GET") {
        return getKimiSessionResponse(request);
    }
    if (name === "logout" && request.method === "POST") {
        return logoutKimi(request);
    }
    return new Response("Not Found", {
        status: 404,
        headers: { "Cache-Control": "no-store" },
    });
}

export function loader({ request }: LoaderFunctionArgs) {
    return handle(request);
}

export function action({ request }: ActionFunctionArgs) {
    return handle(request);
}