import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
    getGrokBuildSessionResponse,
    logoutGrokBuild,
    startGrokBuildLogin,
} from "~/lib/server/grok-build-auth";

function endpoint(request: Request): string {
    return new URL(request.url).pathname.replace(/^.*\/api\/grok\/?/, "");
}

async function handle(request: Request): Promise<Response> {
    const name = endpoint(request);
    if (name === "login" && request.method === "GET") {
        return startGrokBuildLogin(request);
    }
    if (name === "session" && request.method === "GET") {
        return getGrokBuildSessionResponse(request);
    }
    if (name === "logout" && request.method === "POST") {
        return logoutGrokBuild(request);
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
