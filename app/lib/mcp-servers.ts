import type { McpServerConfig } from "~/lib/types";
import type { ToolAccessSettings } from "~/lib/tool-access";

/**
 * The two bundled keyless search servers (Parallel Search MCP and Firecrawl).
 * They are the model's web search, so web search access owns them, not MCP access.
 */
export function isBundledSearchMcpServer(server: McpServerConfig): boolean {
    const id = server.id.trim().toLowerCase();
    const url = server.url?.trim().toLowerCase() ?? "";
    return (
        id === "mcp_parallel_search" ||
        id === "mcp_firecrawl_keyless" ||
        url.includes("search.parallel.ai/mcp") ||
        url.includes("mcp.firecrawl.dev/")
    );
}

/**
 * MCP servers a client should send with a chat request. The bundled search
 * servers ride on web search access; every other server needs MCP access.
 * (The server enforces the same split.)
 */
export function mcpServersForRequest(
    servers: McpServerConfig[] | undefined,
    access: Pick<ToolAccessSettings, "mcp" | "webSearch">,
    webSearchEnabled: boolean,
): McpServerConfig[] {
    return (servers ?? []).filter((server) => {
        if (!server.enabled) return false;
        return isBundledSearchMcpServer(server) ? access.webSearch && webSearchEnabled : access.mcp;
    });
}
