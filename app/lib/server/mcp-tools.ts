import { createMCPClient } from "@ai-sdk/mcp";
import type { ToolSet } from "ai";
import type { McpServerConfig } from "~/lib/types";
import { assertConfiguredHttpUrl } from "~/lib/server/provider-url";

export type McpClientHandle = {
    close: () => Promise<void>;
};

export async function loadMcpTools(
    servers: McpServerConfig[] | undefined,
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
                tools[key] = t as ToolSet[string];
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
