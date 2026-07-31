/**
 * API Search Route — DuckDuckGo or optional SearXNG
 */

import type { ActionFunctionArgs } from "react-router";
import { webSearch } from "~/lib/search";

export async function action({ request }: ActionFunctionArgs) {
    const body = (await request.json()) as {
        query: string;
        maxResults?: number;
        engine?: "duckduckgo" | "searxng";
        searxngUrl?: string;
    };
    const query = body.query?.trim();

    if (!query) {
        return Response.json({ error: "Query required" }, { status: 400 });
    }

    try {
        const results = await webSearch(query, {
            maxResults: body.maxResults ?? 5,
            engine: body.engine,
            searxngUrl: body.searxngUrl,
        });
        return Response.json({ results });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Search failed";
        return Response.json({ error: message, results: [] }, { status: 500 });
    }
}
