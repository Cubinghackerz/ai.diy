import { createMCPClient } from "@ai-sdk/mcp";
import type { ToolSet } from "ai";
import type { McpServerConfig } from "~/lib/types";
import {
    connectAvailable,
    connectCredentialHint,
    requestConnectToken,
} from "~/lib/server/connect";
import { assertConfiguredHttpUrl } from "~/lib/server/provider-url";
import type { TokenModePolicy } from "~/lib/token-mode";
import {
    focusSearchQuery,
    formatCompactSearchResults,
    rankSearchResults,
    type SearchResult,
} from "~/lib/search";

export type McpClientHandle = {
    close: () => Promise<void>;
};

export async function loadMcpTools(
    servers: McpServerConfig[] | undefined,
    policy?: Pick<
        TokenModePolicy,
        | "defaultSearchResults"
        | "maxSearchResults"
        | "maxMcpResultChars"
        | "maxSnippetChars"
    >,
): Promise<{ tools: ToolSet; clients: McpClientHandle[] }> {
    const tools: ToolSet = {};
    const clients: McpClientHandle[] = [];
    const enabled = (servers ?? []).filter((s) => s.enabled !== false);

    for (const server of enabled) {
        try {
            const client = await connectMcpServer(server);
            if (!client) continue;
            clients.push(client);
            const serverTools = await client.tools();
            const prefix = slugify(server.name || server.id);
            for (const [name, t] of Object.entries(serverTools)) {
                const key = `mcp_${prefix}_${name}`.replace(/[^a-zA-Z0-9_-]/g, "_");
                const wrapped = policy
                    ? wrapMcpToolForBudget(key, t as ToolSet[string], policy)
                    : (t as ToolSet[string]);
                tools[key] = wrapped;
            }
        } catch (err) {
            console.warn(
                `[mcp] Failed to connect ${server.name}:`,
                err instanceof Error ? err.message : err,
            );
        }
    }

    return { tools, clients };
}

export async function closeMcpClients(clients: McpClientHandle[]) {
    await Promise.allSettled(clients.map((c) => c.close()));
}

/**
 * Clamp Parallel/Firecrawl-style search args and truncate bulky scrape dumps so
 * MCP tools stay useful without blowing the context window.
 */
export function wrapMcpToolForBudget(
    toolName: string,
    mcpTool: ToolSet[string],
    policy: Pick<
        TokenModePolicy,
        | "defaultSearchResults"
        | "maxSearchResults"
        | "maxMcpResultChars"
        | "maxSnippetChars"
    >,
): ToolSet[string] {
    const original = mcpTool as ToolSet[string] & {
        execute?: (...args: unknown[]) => unknown;
    };
    if (typeof original.execute !== "function") return mcpTool;

    const kind = classifyMcpTool(toolName);
    const execute = original.execute.bind(original);
    const snippetChars = policy.maxSnippetChars ?? 160;
    // Keep page scrapes usable; search listings are formatted first so we never
    // truncate mid-JSON before extraction (Parallel/Firecrawl payloads are rich).
    const bodyChars =
        kind === "search"
            ? Math.min(1_200, Math.max(600, Math.floor(policy.maxMcpResultChars / 4)))
            : Math.min(policy.maxMcpResultChars, Math.max(4_000, Math.floor(policy.maxMcpResultChars * 0.75)));
    const resultBudget =
        kind === "search"
            ? Math.min(policy.maxMcpResultChars, Math.max(8_000, policy.maxSearchResults * 480))
            : policy.maxMcpResultChars;

    return {
        ...original,
        execute: async (...callArgs: unknown[]) => {
            const [rawArgs, ...rest] = callArgs;
            const args =
                kind === "search"
                    ? clampMcpSearchArgs(rawArgs, policy, original)
                    : rawArgs;
            const result = await execute(args, ...rest);
            if (kind === "search") {
                // Format from the full payload first — compacting JSON before
                // extraction produces truncated garbage the model cannot use.
                const formatted = formatMcpSearchToolOutput(result, {
                    query: extractMcpSearchQuery(args),
                    maxItems: policy.maxSearchResults,
                    maxSnippetChars: snippetChars,
                    includeSnippets: true,
                });
                if (formatted !== result) return formatted;
            }
            return compactMcpToolResult(result, resultBudget, {
                maxItems: kind === "search" ? Math.max(policy.maxSearchResults * 2, 8) : undefined,
                maxSnippetChars: snippetChars,
                maxBodyChars: bodyChars,
            });
        },
    } as ToolSet[string];
}

function classifyMcpTool(toolName: string): "search" | "fetch" | "other" {
    const name = toolName.toLowerCase();
    if (/search|web_search|find/.test(name) && !/scrape|fetch|parse|crawl|read/.test(name)) {
        return "search";
    }
    if (/scrape|fetch|parse|crawl|read_url|web_fetch|extract/.test(name)) {
        return "fetch";
    }
    return "other";
}

const SEARCH_LIMIT_KEYS = [
    "limit",
    "max_results",
    "maxResults",
    "num_results",
    "numResults",
    "count",
    "top_k",
    "topK",
    "n",
    "size",
] as const;

const SEARCH_QUERY_KEYS = [
    "query",
    "q",
    "search",
    "search_query",
    "searchQuery",
    "objective",
    "prompt",
    "text",
    "input",
] as const;

function extractMcpSearchQuery(args: unknown): string {
    if (!args || typeof args !== "object" || Array.isArray(args)) return "";
    const record = args as Record<string, unknown>;
    for (const key of SEARCH_QUERY_KEYS) {
        const value = record[key];
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    // Parallel-style: search_queries: string[]
    const queries = record.search_queries ?? record.searchQueries ?? record.queries;
    if (Array.isArray(queries)) {
        const joined = queries
            .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            .join(" ");
        if (joined) return joined;
    }
    return "";
}

function clampMcpSearchArgs(
    args: unknown,
    policy: Pick<TokenModePolicy, "defaultSearchResults" | "maxSearchResults">,
    mcpTool?: ToolSet[string],
): unknown {
    if (!args || typeof args !== "object" || Array.isArray(args)) return args;
    const next: Record<string, unknown> = { ...(args as Record<string, unknown>) };

    for (const key of SEARCH_QUERY_KEYS) {
        if (!(key in next)) continue;
        const value = next[key];
        if (typeof value === "string") {
            const focused = focusSearchQuery(value);
            if (focused) next[key] = focused;
        }
    }
    for (const key of ["search_queries", "searchQueries", "queries"] as const) {
        if (!(key in next) || !Array.isArray(next[key])) continue;
        next[key] = (next[key] as unknown[]).map((item) =>
            typeof item === "string" ? focusSearchQuery(item) || item : item,
        );
    }

    let sawLimit = false;
    for (const key of SEARCH_LIMIT_KEYS) {
        if (!(key in next)) continue;
        sawLimit = true;
        const value = next[key];
        if (typeof value === "number" && Number.isFinite(value)) {
            next[key] = Math.max(1, Math.min(policy.maxSearchResults, Math.round(value)));
        } else if (typeof value === "string" && /^\d+$/.test(value.trim())) {
            next[key] = String(
                Math.max(1, Math.min(policy.maxSearchResults, Number.parseInt(value, 10))),
            );
        }
    }
    // Only inject a limit key the tool schema already accepts — unknown keys
    // can make Parallel/Firecrawl reject the call.
    if (!sawLimit) {
        const schemaKey = firstSearchLimitKeyFromSchema(mcpTool);
        if (schemaKey) next[schemaKey] = policy.defaultSearchResults;
    }
    return next;
}

function firstSearchLimitKeyFromSchema(mcpTool?: ToolSet[string]): string | null {
    if (!mcpTool || typeof mcpTool !== "object") return null;
    const schema = (mcpTool as { inputSchema?: unknown }).inputSchema as
        | { shape?: Record<string, unknown>; jsonSchema?: { properties?: Record<string, unknown> } }
        | undefined;
    const props =
        schema?.shape ??
        schema?.jsonSchema?.properties ??
        (mcpTool as { parameters?: { properties?: Record<string, unknown> } }).parameters
            ?.properties;
    if (!props || typeof props !== "object") return null;
    for (const key of SEARCH_LIMIT_KEYS) {
        if (key in props) return key;
    }
    return null;
}

export function compactMcpToolResult(
    result: unknown,
    maxChars: number,
    options: {
        maxItems?: number;
        maxSnippetChars?: number;
        maxBodyChars?: number;
    } = {},
): unknown {
    if (result == null) return result;

    if (typeof result === "string") {
        return truncateText(result, maxChars);
    }

    // AI SDK MCP often returns { content: [{ type: "text", text: "..." }] }
    if (typeof result === "object") {
        const compacted = compactJsonValue(result, options);
        const serialized = safeJsonStringify(compacted);
        if (serialized.length <= maxChars) return compacted;

        // Prefer keeping a truncated text payload over dropping structure entirely.
        if (isMcpContentEnvelope(compacted)) {
            const text = extractMcpText(compacted);
            return {
                content: [
                    {
                        type: "text",
                        text: truncateText(
                            `${text}\n\n[Truncated for token budget]`,
                            maxChars,
                        ),
                    },
                ],
            };
        }

        return truncateText(
            `${serialized}\n\n[Truncated for token budget]`,
            maxChars,
        );
    }

    return result;
}

function compactJsonValue(
    value: unknown,
    options: {
        maxItems?: number;
        maxSnippetChars?: number;
        maxBodyChars?: number;
    } = {},
): unknown {
    const maxItems = options.maxItems;
    const snippetChars = options.maxSnippetChars ?? 160;
    const bodyChars = options.maxBodyChars ?? 1_200;

    if (Array.isArray(value)) {
        const limited =
            typeof maxItems === "number" ? value.slice(0, maxItems) : value;
        return limited.map((item) => compactJsonValue(item, options));
    }
    if (!value || typeof value !== "object") return value;

    const record = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(record)) {
        if (
            typeof maxItems === "number" &&
            Array.isArray(child) &&
            /^(results?|items|hits|documents|data|organic)$/i.test(key)
        ) {
            next[key] = child
                .slice(0, maxItems)
                .map((item) => compactJsonValue(item, options));
            if (child.length > maxItems) {
                next[`${key}_truncated`] = `Showing ${maxItems} of ${child.length}`;
            }
            continue;
        }
        if (typeof child === "string" && /^(content|markdown|html|text|raw|body)$/i.test(key)) {
            next[key] = truncateText(child, bodyChars);
            continue;
        }
        if (typeof child === "string" && /^(snippet|description|excerpt|summary|title)$/i.test(key)) {
            next[key] = truncateText(child, key === "title" ? 80 : snippetChars);
            continue;
        }
        if (
            Array.isArray(child) &&
            /^(excerpts|highlights|snippets)$/i.test(key) &&
            child.every((item) => typeof item === "string")
        ) {
            const joined = (child as string[])
                .map((item) => item.trim())
                .filter(Boolean)
                .join(" · ");
            next[key] = [truncateText(joined, snippetChars)];
            continue;
        }
        next[key] = compactJsonValue(child, options);
    }
    return next;
}

function isMcpContentEnvelope(value: unknown): value is { content: unknown[] } {
    return Boolean(
        value &&
            typeof value === "object" &&
            Array.isArray((value as { content?: unknown }).content),
    );
}

function extractMcpText(value: { content: unknown[] }): string {
    return value.content
        .map((part) => {
            if (!part || typeof part !== "object") return "";
            const text = (part as { text?: unknown }).text;
            return typeof text === "string" ? text : "";
        })
        .filter(Boolean)
        .join("\n\n");
}

function truncateText(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    return `${text.slice(0, Math.max(0, maxChars - 32)).trimEnd()}\n\n[Truncated for token budget]`;
}

function safeJsonStringify(value: unknown): string {
    try {
        return JSON.stringify(value) ?? "";
    } catch {
        return String(value);
    }
}

const SEARCH_RESULT_ARRAY_KEYS =
    /^(results?|items|hits|documents|organic|web_results?|search_results?)$/i;

function formatMcpSearchToolOutput(
    result: unknown,
    options: {
        query?: string;
        maxItems: number;
        maxSnippetChars: number;
        includeSnippets: boolean;
    },
): unknown {
    const parsed = extractSearchResultsFromMcpPayload(result);
    if (parsed.length === 0) return result;

    // Rank a slightly larger pool, then keep only the policy budget.
    const ranked = rankSearchResults(
        options.query || "",
        parsed,
        Math.min(parsed.length, Math.max(options.maxItems * 2, options.maxItems)),
    ).slice(0, options.maxItems);

    const text = formatCompactSearchResults(ranked, {
        maxSnippetChars: options.maxSnippetChars,
        maxTitleChars: 72,
        includeSnippets: options.includeSnippets,
        includeCitationFooter: true,
    });

    if (typeof result === "string") return text;
    if (isMcpContentEnvelope(result)) {
        return { content: [{ type: "text", text }] };
    }
    return text;
}

function extractSearchResultsFromMcpPayload(value: unknown): SearchResult[] {
    const collected: SearchResult[] = [];
    const visit = (node: unknown, depth = 0) => {
        if (depth > 6 || node == null) return;
        if (typeof node === "string") {
            const trimmed = node.trim();
            if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
                try {
                    visit(JSON.parse(trimmed), depth + 1);
                } catch {
                    // not JSON — ignore
                }
            }
            return;
        }
        if (Array.isArray(node)) {
            for (const item of node) {
                const parsed = parseMcpSearchResultItem(item);
                if (parsed) collected.push(parsed);
            }
            return;
        }
        if (typeof node !== "object") return;

        const record = node as Record<string, unknown>;
        if (isMcpContentEnvelope(record)) {
            for (const part of record.content) visit(part, depth + 1);
            return;
        }

        let foundArray = false;
        for (const [key, child] of Object.entries(record)) {
            if (!Array.isArray(child) || !SEARCH_RESULT_ARRAY_KEYS.test(key)) continue;
            foundArray = true;
            for (const item of child) {
                const parsed = parseMcpSearchResultItem(item);
                if (parsed) collected.push(parsed);
            }
        }
        if (foundArray) return;

        if (record.data && typeof record.data === "object") {
            visit(record.data, depth + 1);
        }
    };

    visit(value);
    return dedupeSearchResults(collected);
}

function parseMcpSearchResultItem(item: unknown): SearchResult | null {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    const url = pickMcpString(record, ["url", "link", "href", "uri", "source"]);
    if (!url || !/^https?:\/\//i.test(url)) return null;
    const title =
        pickMcpString(record, ["title", "name", "heading", "page_title"]) || "Untitled";
    const snippet =
        pickMcpString(record, [
            "snippet",
            "description",
            "excerpt",
            "summary",
            "content",
            "text",
            "body",
            "markdown",
        ]) || pickMcpJoinedText(record, ["excerpts", "highlights", "snippets"]);
    return { title, url, snippet: snippet || "" };
}

function pickMcpString(record: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
        const value = record[key];
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
}

/** Parallel returns excerpts/highlights as string arrays — join into one snippet. */
function pickMcpJoinedText(record: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
        const value = record[key];
        if (!Array.isArray(value) || value.length === 0) continue;
        const parts = value
            .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            .map((item) => item.trim());
        if (parts.length) return parts.join(" · ");
    }
    return "";
}

function dedupeSearchResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    const deduped: SearchResult[] = [];
    for (const result of results) {
        let key = result.url.trim();
        try {
            const url = new URL(key);
            url.hash = "";
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

async function connectMcpServer(
    server: McpServerConfig,
): Promise<(McpClientHandle & { tools: () => Promise<ToolSet> }) | null> {
    if (server.kind === "stdio") {
        // Browser-controlled settings must never execute commands on the host.
        throw new Error("Stdio MCP servers are disabled. Connect a remote HTTP or SSE MCP server instead.");
    }

    if (!server.url?.trim()) return null;
    const url = assertConfiguredHttpUrl(server.url);
    const type = server.kind === "http" ? "http" : "sse";
    let headers = sanitizeHeaders(server.headers);
    if (server.vercelAuth) {
        if (!connectAvailable()) {
            console.warn(
                `[mcp] ${server.name}: vercelAuth configured but Vercel Connect is unavailable — ${connectCredentialHint()}. Skipping.`,
            );
            return null;
        }
        const result = await requestConnectToken(
            server.vercelAuth.connectorId,
            server.vercelAuth.scopes,
        );
        if (!result.ok) {
            if (result.kind === "authorization-required") {
                console.warn(
                    `[mcp] ${server.name}: Vercel Connect authorization pending. Open ${
                        result.authorizeUrl ?? "the Connected apps settings"
                    } and complete the consent, then request again. Skipping this server.`,
                );
            } else {
                console.warn(
                    `[mcp] ${server.name}: Vercel Connect token unavailable (${result.kind}): ${result.message}. Skipping.`,
                );
            }
            return null;
        }
        headers = { ...(headers ?? {}), Authorization: `Bearer ${result.token}` };
    }
    const client = await createMCPClient({
        transport: {
            type,
            url: url.toString(),
            headers,
            redirect: "error",
        },
        clientName: `prismium-${slugify(server.name)}`,
    });
    return {
        tools: () => client.tools() as Promise<ToolSet>,
        close: () => client.close(),
    };
}

function sanitizeHeaders(headers?: Record<string, string>): Record<string, string> | undefined {
    if (!headers) return undefined;
    const safeEntries = Object.entries(headers).filter(
        ([name, value]) =>
            /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) &&
            typeof value === "string" &&
            !/[\r\n]/.test(value),
    );
    return safeEntries.length > 0 ? Object.fromEntries(safeEntries) : undefined;
}

function slugify(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 24) || "server";
}
