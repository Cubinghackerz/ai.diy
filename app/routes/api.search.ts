/**
 * API Search Route — DuckDuckGo or optional SearXNG
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { webSearch } from "~/lib/search";
import { corsPreflight, withCors } from "~/lib/server/cors";
import { assertConfiguredHttpUrl } from "~/lib/server/provider-url";

export function loader({ request }: LoaderFunctionArgs) {
    const preflight = corsPreflight(request);
    if (preflight) return preflight;
    return withCors(
        request,
        new Response("Method Not Allowed", { status: 405 }),
    );
}

export async function action({ request }: ActionFunctionArgs) {
    const preflight = corsPreflight(request);
    if (preflight) return preflight;

    if (request.method !== "POST") {
        return withCors(
            request,
            new Response("Method Not Allowed", { status: 405 }),
        );
    }

    let body: {
        query: string;
        maxResults?: number;
        engine?: "duckduckgo" | "searxng";
        searxngUrl?: string;
    };
    try {
        body = (await request.json()) as typeof body;
    } catch {
        return withCors(
            request,
            Response.json({ error: "Invalid JSON body" }, { status: 400 }),
        );
    }
    const query = body.query?.trim();

    if (!query) {
        return withCors(
            request,
            Response.json({ error: "Query required" }, { status: 400 }),
        );
    }

    if (body.engine === "searxng" && body.searxngUrl?.trim()) {
        try {
            assertConfiguredHttpUrl(body.searxngUrl);
        } catch (err) {
            return withCors(
                request,
                Response.json(
                    { error: err instanceof Error ? err.message : "Invalid SearXNG URL", results: [] },
                    { status: 400 },
                ),
            );
        }
    }

    try {
        const results = await webSearch(query, {
            maxResults: body.maxResults ?? 5,
            engine: body.engine,
            searxngUrl: body.searxngUrl,
        });
        return withCors(request, Response.json({ results }));
    } catch (err) {
        const message = err instanceof Error ? err.message : "Search failed";
        return withCors(
            request,
            Response.json({ error: message, results: [] }, { status: 500 }),
        );
    }
}
