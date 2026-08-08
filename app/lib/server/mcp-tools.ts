import { createMCPClient } from "@ai-sdk/mcp";
import type { ToolSet } from "ai";
import type { McpServerConfig } from "~/lib/types";
import { assertConfiguredHttpUrl } from "~/lib/server/provider-url";
import type { TokenModePolicy } from "~/lib/token-mode";

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
    // Keep page scrapes usable; only search listings are kept tiny.
    const bodyChars =
        kind === "search"
            ? Math.min(800, Math.max(400, Math.floor(policy.maxMcpResultChars / 4)))
            : Math.min(policy.maxMcpResultChars, Math.max(4_000, Math.floor(policy.maxMcpResultChars * 0.75)));
    const resultBudget =
        kind === "search"
            ? Math.min(policy.maxMcpResultChars, 3_500)
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
            return compactMcpToolResult(result, resultBudget, {
                maxItems: kind === "search" ? policy.maxSearchResults : undefined,
                maxSnippetChars: snippetChars,
                maxBodyChars: kind === "fetch" ? bodyChars : bodyChars,
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

function clampMcpSearchArgs(
    args: unknown,
    policy: Pick<TokenModePolicy, "defaultSearchResults" | "maxSearchResults">,
    mcpTool?: ToolSet[string],
): unknown {
    if (!args || typeof args !== "object" || Array.isArray(args)) return args;
    const next: Record<string, unknown> = { ...(args as Record<string, unknown>) };
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
    const client = await createMCPClient({
        transport: {
            type,
            url: url.toString(),
            headers: sanitizeHeaders(server.headers),
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
