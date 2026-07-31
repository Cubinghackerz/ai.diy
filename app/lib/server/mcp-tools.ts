/**
 * Connect enabled MCP servers (HTTP/SSE; stdio on self-host only) and collect tools.
 */

import { createMCPClient } from "@ai-sdk/mcp";
import type { ToolSet } from "ai";
import { isVercelServerless } from "~/lib/server/env";
import type { McpServerConfig } from "~/lib/types";

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
        if (isVercelServerless()) {
            console.warn(
                `[mcp] Skipping stdio server "${server.name}" on Vercel — self-host required.`,
            );
            return null;
        }
        if (!server.command?.trim()) return null;
        const { Experimental_StdioMCPTransport } = await import(
            "@ai-sdk/mcp/mcp-stdio"
        );
        const client = await createMCPClient({
            transport: new Experimental_StdioMCPTransport({
                command: server.command,
                args: server.args ?? [],
                env: server.env,
            }),
            clientName: `prismium-${slugify(server.name)}`,
        });
        return {
            tools: () => client.tools() as Promise<ToolSet>,
            close: () => client.close(),
        };
    }

    if (!server.url?.trim()) return null;
    const type = server.kind === "http" ? "http" : "sse";
    const client = await createMCPClient({
        transport: {
            type,
            url: server.url.trim(),
        },
        clientName: `prismium-${slugify(server.name)}`,
    });
    return {
        tools: () => client.tools() as Promise<ToolSet>,
        close: () => client.close(),
    };
}

function slugify(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 24) || "server";
}
