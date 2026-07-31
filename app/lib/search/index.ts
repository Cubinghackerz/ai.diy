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

const DDG_HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    DNT: "1",
    Connection: "keep-alive",
};

const DDG_COOKIES =
    "cf_clearance=; lmt=; __cf_bm=; exp=; dcl=; p=-1; _ga=GA1.2.; _gid=GA1.2.";

export async function duckDuckGoSearch(
    query: string,
    maxResults: number = 5,
): Promise<SearchResult[]> {
    const params = new URLSearchParams();
    params.set("q", query);
    params.set("kl", "us-en");
    params.set("df", "pastyear");

    const url = `https://lite.duckduckgo.com/lite/?${params.toString()}`;

    const response = await fetch(url, {
        headers: {
            ...DDG_HEADERS,
            Cookie: DDG_COOKIES,
            Referer: "https://duckduckgo.com/",
        },
        signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
        throw new Error(`DuckDuckGo returned HTTP ${response.status}`);
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

    // DuckDuckGo lite uses <a class="result-link" href="...">Title</a>
    // followed by a snippet in the same row.
    const resultRegex =
        /<a[^>]*class="result-link"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>[\s\S]*?<td[^>]*class="result-snippet"[^>]*>(.*?)<\/td>/gi;

    let match: RegExpExecArray | null;
    while (
        (match = resultRegex.exec(html)) !== null &&
        results.length < maxResults
    ) {
        let url = match[1] || "";
        const title = stripHtml(match[2] || "");
        const snippet = stripHtml(match[3] || "");

        const uddgMatch = url.match(/uddg=([^&]+)/);
        if (uddgMatch) {
            url = decodeURIComponent(uddgMatch[1]);
        }

        if (title && url) {
            results.push({ title, url, snippet });
        }
    }

    // Fallback: any <a class="result-link"> without a paired snippet cell
    if (results.length === 0) {
        const fallbackRegex =
            /<a[^>]*class="result-link"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
        while (
            (match = fallbackRegex.exec(html)) !== null &&
            results.length < maxResults
        ) {
            let url = match[1] || "";
            const title = stripHtml(match[2] || "");
            const uddgMatch = url.match(/uddg=([^&]+)/);
            if (uddgMatch) {
                url = decodeURIComponent(uddgMatch[1]);
            }
            if (title && url) {
                results.push({ title, url, snippet: "" });
            }
        }
    }

    // Final fallback: generic result__a links from the HTML/endpoint
    if (results.length === 0) {
        const genericRegex =
            /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/gi;
        while (
            (match = genericRegex.exec(html)) !== null &&
            results.length < maxResults
        ) {
            const rawUrl = match[1] || "";
            const title = stripHtml(match[2] || "");
            const snippet = stripHtml(match[3] || "");
            let url = rawUrl;
            const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
            if (uddgMatch) {
                url = decodeURIComponent(uddgMatch[1]);
            }
            if (title && url) {
                results.push({ title, url, snippet });
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
