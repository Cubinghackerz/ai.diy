import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { corsPreflight, withCors } from "~/lib/server/cors";
import { connectorSearch } from "~/lib/search/connectors";
import type { ConnectorConfig } from "~/lib/types";
import {
    checkRateLimit,
    rateLimitKeyFromRequest,
    rateLimitResponse,
} from "~/lib/server/rate-limit";

export function loader({ request }: LoaderFunctionArgs) {
    const preflight = corsPreflight(request);
    if (preflight) return preflight;
    return withCors(request, new Response("Method Not Allowed", { status: 405 }));
}

export async function action({ request }: ActionFunctionArgs) {
    const preflight = corsPreflight(request);
    if (preflight) return preflight;
    if (request.method !== "POST") {
        return withCors(request, new Response("Method Not Allowed", { status: 405 }));
    }

    try {
        const body = (await request.json()) as {
            action?: "test";
            connector?: ConnectorConfig;
        };

        const rateKey = rateLimitKeyFromRequest(request, body.connector?.apiKey);
        const rateCheck = checkRateLimit(rateKey);
        if (!rateCheck.ok) {
            return withCors(request, rateLimitResponse(rateCheck.retryAfterMs));
        }

        const connector = body.connector;
        if (body.action !== "test" || !connector) {
            return withCors(request, Response.json({ error: "Connector test required." }, { status: 400 }));
        }
        if (!["tavily", "brave", "exa", "parallel"].includes(connector.kind)) {
            return withCors(
                request,
                Response.json(
                    { error: "Use a Remote MCP server for this connector until its permission-scoped adapter is enabled." },
                    { status: 501 },
                ),
            );
        }
        const results = await connectorSearch(connector, "ai.diy", 1);
        return withCors(request, Response.json({ ok: true, results }));
    } catch (error) {
        return withCors(
            request,
            Response.json(
                { ok: false, error: error instanceof Error ? error.message : "Connector test failed." },
                { status: 502 },
            ),
        );
    }
}
