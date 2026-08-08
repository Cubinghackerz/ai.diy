import type { ConnectorConfig } from "~/lib/types";
import { clipSearchText, type SearchResult } from "~/lib/search";

type ConnectorResponse = {
    results?: SearchResult[];
    web?: { results?: Array<{ title?: string; url?: string; description?: string; age?: string }> };
};

const CONNECTOR_SNIPPET_CHARS = 160;

function normalizeConnectorResults(results: SearchResult[]): SearchResult[] {
    return results.map((result) => ({
        title: clipSearchText(result.title, 80),
        url: result.url,
        snippet: clipSearchText(result.snippet, CONNECTOR_SNIPPET_CHARS),
    }));
}

function keyFor(connector: ConnectorConfig): string {
    const key = connector.apiKey?.trim();
    if (!key) throw new Error(`${connector.name || connector.kind} API key is missing.`);
    return key;
}

export async function connectorSearch(
    connector: ConnectorConfig,
    query: string,
    maxResults = 5,
): Promise<SearchResult[]> {
    const key = keyFor(connector);
    if (connector.kind === "tavily") {
        const response = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ query, search_depth: "basic", max_results: maxResults }),
            signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error(`Tavily returned HTTP ${response.status}`);
        const data = (await response.json()) as ConnectorResponse;
        return normalizeConnectorResults(data.results ?? []);
    }

    if (connector.kind === "brave") {
        const url = new URL("https://api.search.brave.com/res/v1/web/search");
        url.searchParams.set("q", query);
        url.searchParams.set("count", String(Math.min(maxResults, 20)));
        const response = await fetch(url, {
            headers: {
                Accept: "application/json",
                "X-Subscription-Token": key,
            },
            signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error(`Brave Search returned HTTP ${response.status}`);
        const data = (await response.json()) as ConnectorResponse;
        return normalizeConnectorResults(
            (data.web?.results ?? []).flatMap((result) =>
                result.title && result.url
                    ? [{ title: result.title, url: result.url, snippet: result.description || result.age || "" }]
                    : [],
            ),
        );
    }

    if (connector.kind === "exa") {
        const response = await fetch("https://api.exa.ai/search", {
            method: "POST",
            headers: {
                "x-api-key": key,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query,
                type: "auto",
                numResults: Math.min(maxResults, 20),
                contents: { highlights: { maxCharacters: CONNECTOR_SNIPPET_CHARS } },
            }),
            signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error(`Exa returned HTTP ${response.status}`);
        const data = (await response.json()) as {
            results?: Array<{ title?: string; url?: string; highlights?: string[]; text?: string }>;
        };
        return normalizeConnectorResults(
            (data.results ?? []).flatMap((result) =>
                result.title && result.url
                    ? [
                          {
                              title: result.title,
                              url: result.url,
                              snippet: result.highlights?.join(" ") || result.text || "",
                          },
                      ]
                    : [],
            ),
        );
    }

    if (connector.kind === "parallel") {
        const response = await fetch("https://api.parallel.ai/v1/search", {
            method: "POST",
            headers: {
                "x-api-key": key,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                search_queries: [query],
                mode: "advanced",
                advanced_settings: { max_results: Math.min(maxResults, 20) },
            }),
            signal: AbortSignal.timeout(20_000),
        });
        if (!response.ok) throw new Error(`Parallel Search returned HTTP ${response.status}`);
        const data = (await response.json()) as {
            results?: Array<{ title?: string; url?: string; excerpts?: string[] }>;
        };
        return normalizeConnectorResults(
            (data.results ?? []).flatMap((result) =>
                result.title && result.url
                    ? [{ title: result.title, url: result.url, snippet: result.excerpts?.join(" ") || "" }]
                    : [],
            ),
        );
    }

    throw new Error(`${connector.kind} is configured through Remote MCP, not direct web search.`);
}
