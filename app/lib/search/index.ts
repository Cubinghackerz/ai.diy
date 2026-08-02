/**
 * Web Search — DuckDuckGo (default) + optional self-hosted SearXNG.
 *
 * Reliability strategy: DDG serves several front-ends that use different
 * HTML classes. We try the most stable ones in order and return the first
 * set of parseable results. Each attempt uses an 8–12s timeout with a small
 * retry so transient bot-block pages or rate limits don't kill a query.
 */

export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
}

export type SearchEngine = "duckduckgo" | "searxng";

export interface DuckDuckGoInstantAnswer {
    query: string;
    answer?: string;
    answerType?: string;
    abstractText?: string;
    abstractUrl?: string;
    abstractSource?: string;
    definition?: string;
    definitionUrl?: string;
    definitionSource?: string;
    relatedTopics: SearchResult[];
}

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

/**
 * Fetch DuckDuckGo's free Instant Answer API separately from ranked search.
 * It is a useful first-pass overview/definition source, not an LLM and not a
 * substitute for fetching authoritative pages for consequential claims.
 */
export async function duckDuckGoInstantAnswer(
    query: string,
    maxRelatedTopics: number = 5,
): Promise<DuckDuckGoInstantAnswer> {
    const normalizedQuery = query.trim().slice(0, 500);
    if (!normalizedQuery) throw new Error("Query required");

    const params = new URLSearchParams({
        q: normalizedQuery,
        format: "json",
        no_html: "1",
        no_redirect: "1",
        skip_disambig: "1",
    });
    const response = await fetch(`https://api.duckduckgo.com/?${params.toString()}`, {
        headers: {
            ...ddgHeaders(),
            Accept: "application/json",
        },
        signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
        throw new Error(`DuckDuckGo Instant Answer API returned HTTP ${response.status}`);
    }

    const body = await response.text();
    if (!body.trim()) {
        throw new Error("DuckDuckGo Instant Answer API returned an empty response");
    }

    let data: {
        Answer?: string;
        AnswerType?: string;
        AbstractText?: string;
        AbstractURL?: string;
        AbstractSource?: string;
        Definition?: string;
        DefinitionURL?: string;
        DefinitionSource?: string;
        RelatedTopics?: DuckDuckGoRelatedTopic[];
    };
    try {
        data = JSON.parse(body) as typeof data;
    } catch {
        throw new Error("DuckDuckGo Instant Answer API returned invalid JSON");
    }

    return {
        query: normalizedQuery,
        answer: cleanSearchText(data.Answer),
        answerType: cleanSearchText(data.AnswerType),
        abstractText: cleanSearchText(data.AbstractText, 2_000),
        abstractUrl: publicHttpUrl(data.AbstractURL),
        abstractSource: cleanSearchText(data.AbstractSource),
        definition: cleanSearchText(data.Definition, 2_000),
        definitionUrl: publicHttpUrl(data.DefinitionURL),
        definitionSource: cleanSearchText(data.DefinitionSource),
        relatedTopics: flattenDuckDuckGoTopics(data.RelatedTopics ?? [], maxRelatedTopics),
    };
}

const DDG_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
];

let ddgAgentIndex = 0;

function ddgHeaders(cookie = false): Record<string, string> {
    const headers: Record<string, string> = {
        "User-Agent": DDG_USER_AGENTS[ddgAgentIndex++ % DDG_USER_AGENTS.length],
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        DNT: "1",
    };
    if (cookie) headers.Cookie = DDG_COOKIES;
    return headers;
}

const DDG_COOKIES =
    "cf_clearance=; lmt=; __cf_bm=; exp=; dcl=; p=-1; _ga=GA1.2.; _gid=GA1.2.";

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeDdgcUddg(rawUrl: string): string {
    if (!rawUrl) return rawUrl;
    const uddg = rawUrl.match(/uddg=([^&]+)/);
    if (uddg) {
        try {
            const decoded = decodeURIComponent(uddg[1]);
            if (/^https?:\/\//i.test(decoded)) return decoded;
        } catch {
            // fall through to raw url
        }
    }
    return rawUrl;
}

/**
 * Fetch with rotating user agents and one retry so transient bot-block pages
 * or rate limits don't kill a query.
 */
async function robustFetch(
    url: string,
    headers: Record<string, string>,
    timeoutMs: number,
): Promise<Response | undefined> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const response = await fetch(url, {
                headers: {
                    ...ddgHeaders(attempt === 1),
                    ...headers,
                },
                signal: AbortSignal.timeout(timeoutMs),
                redirect: "follow",
            });
            if (response.ok) return response;
        } catch {
            // transient failure — retry once below
        }
        await sleep(300 + attempt * 200);
    }
    return undefined;
}

type DuckDuckGoRelatedTopic = {
    Text?: string;
    FirstURL?: string;
    Topics?: DuckDuckGoRelatedTopic[];
};

function cleanSearchText(value: unknown, maxLength = 500): string | undefined {
    if (typeof value !== "string") return undefined;
    const text = value.replace(/\s+/g, " ").trim().slice(0, maxLength);
    return text || undefined;
}

function publicHttpUrl(value: unknown): string | undefined {
    if (typeof value !== "string" || !value.trim()) return undefined;
    try {
        const url = new URL(value.trim());
        return url.protocol === "http:" || url.protocol === "https:"
            ? url.toString()
            : undefined;
    } catch {
        return undefined;
    }
}

function flattenDuckDuckGoTopics(
    topics: DuckDuckGoRelatedTopic[],
    maxResults: number,
): SearchResult[] {
    const results: SearchResult[] = [];
    const visit = (items: DuckDuckGoRelatedTopic[]) => {
        for (const item of items) {
            if (results.length >= maxResults) return;
            const url = publicHttpUrl(item.FirstURL);
            const snippet = cleanSearchText(item.Text, 600);
            if (url && snippet) {
                results.push({
                    title: snippet.slice(0, 120),
                    url,
                    snippet,
                });
            }
            if (item.Topics) visit(item.Topics);
        }
    };
    visit(topics);
    return results;
}

export async function duckDuckGoSearch(
    query: string,
    maxResults: number = 5,
): Promise<SearchResult[]> {
    // Strategy: try the HTML front-end, then Lite, then Bing RSS, then the
    // Instant Answer API. DDG blocks aggressive bot traffic, so each attempt
    // uses rotating user agents, a retry, and short timeouts.
    const limit = Math.max(1, Math.min(maxResults, 10));
    const strategies: Array<() => Promise<SearchResult[]>> = [
        () => searchDuckDuckGoHtml(query, limit),
        () => searchDuckDuckGoLite(query, limit),
        () => searchBingRss(query, limit),
        () => searchDuckDuckGoInstantAnswerApi(query, limit),
    ];

    for (const strategy of strategies) {
        try {
            const results = deduplicateResults(await strategy());
            if (results.length > 0) return results;
        } catch {
            // Fall through to the next strategy
        }
    }

    return [];
}

async function searchDuckDuckGoHtml(
    query: string,
    maxResults: number,
): Promise<SearchResult[]> {
    const params = new URLSearchParams({
        q: query,
        kl: "us-en",
    });
    const url = `https://html.duckduckgo.com/html/?${params.toString()}`;
    const response = await robustFetch(
        url,
        { Referer: "https://duckduckgo.com/" },
        10_000,
    );
    if (!response) return [];
    const html = await response.text();
    return parseDdggHtmlResults(html, maxResults);
}

async function searchDuckDuckGoLite(
    query: string,
    maxResults: number,
): Promise<SearchResult[]> {
    const params = new URLSearchParams({
        q: query,
        kl: "us-en",
    });
    const url = `https://lite.duckduckgo.com/lite/?${params.toString()}`;
    const response = await robustFetch(
        url,
        { Referer: "https://duckduckgo.com/" },
        10_000,
    );
    if (!response) return [];
    const html = await response.text();
    return parseDuckDuckGoResults(html, maxResults);
}

async function searchBingRss(
    query: string,
    maxResults: number,
): Promise<SearchResult[]> {
    const params = new URLSearchParams({
        q: query,
        format: "rss",
    });
    const url = `https://www.bing.com/search?${params.toString()}`;
    const response = await robustFetch(
        url,
        { Referer: "https://www.bing.com/" },
        10_000,
    );
    if (!response) return [];
    const xml = await response.text();
    return parseRssFeed(xml, maxResults);
}

async function searchDuckDuckGoInstantAnswerApi(
    query: string,
    maxResults: number,
): Promise<SearchResult[]> {
    const answer = await duckDuckGoInstantAnswer(query, maxResults);
    const results: SearchResult[] = [];
    if (answer.abstractText && answer.abstractUrl) {
        results.push({
            title: answer.abstractSource || "DuckDuckGo",
            url: answer.abstractUrl,
            snippet: answer.abstractText,
        });
    }
    for (const topic of answer.relatedTopics) {
        if (results.length >= maxResults) break;
        results.push(topic);
    }
    return results;
}

function deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    const deduped: SearchResult[] = [];
    for (const result of results) {
        let key = result.url.trim();
        try {
            const url = new URL(key);
            url.hash = "";
            url.search = "";
            key = url.toString().replace(/\/+$/, "").toLowerCase();
        } catch {
            key = key.toLowerCase();
        }
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(result);
    }
    return deduped;
}

function parseDdggHtmlResults(
    html: string,
    maxResults: number,
): SearchResult[] {
    const results: SearchResult[] = [];

    // HTML front-end: <a class="result__a" href="...">Title</a> followed by
    // <a class="result__snippet">…</a> in the same result row.
    const resultRegex =
        /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while (
        (match = resultRegex.exec(html)) !== null &&
        results.length < maxResults
    ) {
        const url = decodeDdgcUddg(match[1] || "");
        const title = stripHtml(match[2] || "");
        const snippet = stripHtml(match[3] || "");
        if (title && url) results.push({ title, url, snippet });
    }

    // Fallback: title-only links when snippets aren't present
    if (results.length === 0) {
        const fallbackRegex =
            /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
        while (
            (match = fallbackRegex.exec(html)) !== null &&
            results.length < maxResults
        ) {
            const url = decodeDdgcUddg(match[1] || "");
            const title = stripHtml(match[2] || "");
            if (title && url) results.push({ title, url, snippet: "" });
        }
    }

    return results;
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

        url = decodeDdgcUddg(url);

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
            url = decodeDdgcUddg(url);
            if (title && url) {
                results.push({ title, url, snippet: "" });
            }
        }
    }

    return results;
}

function stripHtml(html: string): string {
    return html
        .replace(/<[^>]*>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/&#x2F;/g, "/")
        .replace(/&#x22;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}

function parseRssFeed(xml: string, maxResults: number): SearchResult[] {
    const results: SearchResult[] = [];

    // Simple RSS parsing: extract <item> blocks
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;

    while (
        (match = itemRegex.exec(xml)) !== null &&
        results.length < maxResults
    ) {
        const itemXml = match[1];
        const titleMatch = itemXml.match(/<title[^>]*>([^<]*)<\/title>/i);
        const linkMatch = itemXml.match(/<link[^>]*>([^<]*)<\/link>/i);
        const descMatch = itemXml.match(/<description[^>]*>([\s\S]*?)<\/description>/i);

        const title = stripHtml(titleMatch?.[1] || "");
        const url = (linkMatch?.[1] || "").trim();
        const snippet = descMatch ? stripHtml(descMatch[1]) : "";

        if (title && url) {
            results.push({ title, url, snippet });
        }
    }

    return results;
}
