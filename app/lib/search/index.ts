/**
 * Web Search — DuckDuckGo (default) + optional self-hosted SearXNG.
 */

export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
}

export type SearchEngine = "duckduckgo" | "searxng";

export async function webSearch(
    query: string,
    options: {
        maxResults?: number;
        engine?: SearchEngine;
        searxngUrl?: string;
    } = {},
): Promise<SearchResult[]> {
    const maxResults = options.maxResults ?? 5;
    if (options.engine === "searxng" && options.searxngUrl?.trim()) {
        return searxngSearch(query, options.searxngUrl.trim(), maxResults);
    }
    return duckDuckGoSearch(query, maxResults);
}

export async function duckDuckGoSearch(
    query: string,
    maxResults: number = 5,
): Promise<SearchResult[]> {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
        },
    });

    if (!response.ok) {
        throw new Error(`DuckDuckGo returned ${response.status}`);
    }

    const html = await response.text();
    return parseDuckDuckGoResults(html, maxResults);
}

export async function searxngSearch(
    query: string,
    baseUrl: string,
    maxResults: number = 5,
): Promise<SearchResult[]> {
    const root = baseUrl.replace(/\/$/, "");
    const url = new URL(`${root}/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("language", "en");

    const response = await fetch(url.toString(), {
        headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; ai.diy/0.1)",
        },
        signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
        throw new Error(`SearXNG returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
        results?: Array<{
            title?: string;
            url?: string;
            content?: string;
            pretty_url?: string;
        }>;
    };

    return (data.results ?? [])
        .filter((r) => r.title && (r.url || r.pretty_url))
        .slice(0, maxResults)
        .map((r) => ({
            title: String(r.title),
            url: String(r.url || r.pretty_url || ""),
            snippet: String(r.content || "").slice(0, 400),
        }));
}

function parseDuckDuckGoResults(
    html: string,
    maxResults: number,
): SearchResult[] {
    const results: SearchResult[] = [];
    const resultRegex =
        /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/gi;

    let match;
    while (
        (match = resultRegex.exec(html)) !== null &&
        results.length < maxResults
    ) {
        const rawUrl = match[1] || "";
        const titleHtml = match[2] || "";
        const snippetHtml = match[3] || "";

        let url = rawUrl;
        const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
        if (uddgMatch) {
            url = decodeURIComponent(uddgMatch[1]);
        }

        const title = stripHtml(titleHtml);
        const snippet = stripHtml(snippetHtml);

        if (title && url) {
            results.push({ title, url, snippet });
        }
    }

    if (results.length === 0) {
        const simpleRegex = /<a[^>]*class="result__a"[^>]*>(.*?)<\/a>/gi;
        while (
            (match = simpleRegex.exec(html)) !== null &&
            results.length < maxResults
        ) {
            const title = stripHtml(match[1]);
            if (title) {
                results.push({ title, url: "", snippet: "" });
            }
        }
    }

    return results;
}

function stripHtml(html: string): string {
    return html
        .replace(/<[^>]*>/g, "")
        .replace(/&/g, "&")
        .replace(/</g, "<")
        .replace(/>/g, ">")
        .replace(/"/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .trim();
}
