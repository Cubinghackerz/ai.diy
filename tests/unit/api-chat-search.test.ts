// @vitest-environment node
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { jsonSchema } from "ai";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetBundledSearchFailures } from "~/lib/server/mcp-tools";
import { FREE_SEARCH_MCP_PRESETS } from "~/lib/types";

// The whole /api/chat route against a fake OpenAI-compatible provider and fake
// Parallel / Firecrawl MCP servers: what the model is actually offered.

const createMCPClient = vi.hoisted(() => vi.fn());
vi.mock("@ai-sdk/mcp", () => ({ createMCPClient }));
vi.mock("~/lib/server/provider-url", async (original) => ({
    ...(await original<typeof import("~/lib/server/provider-url")>()),
    assertConfiguredHttpUrlResolved: async (value: string) => new URL(value),
}));

type Offered = { tools: string[]; system: string };
let provider: Server;
let baseUrl = "";
let offered: Offered[] = [];

beforeAll(async () => {
    provider = createServer((request, response) => {
        const chunks: Buffer[] = [];
        request.on("data", (chunk) => chunks.push(chunk));
        request.on("end", () => {
            const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
            offered.push({
                tools: (body.tools ?? []).map((tool: { function?: { name?: string } }) =>
                    String(tool.function?.name),
                ),
                system: String(
                    (body.messages ?? []).find((m: { role: string }) => m.role === "system")
                        ?.content ?? "",
                ),
            });
            response.writeHead(200, { "Content-Type": "text/event-stream" });
            const send = (delta: object, finish: string | null = null) =>
                response.write(
                    `data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 0, model: "m", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`,
                );
            send({ role: "assistant", content: "ok" });
            send({}, "stop");
            response.end("data: [DONE]\n\n");
        });
    });
    await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(provider.address() as AddressInfo).port}/v1`;
    process.env.ALLOW_PRIVATE_PROVIDER_URLS = "true";
});
afterAll(() => new Promise<void>((resolve) => provider.close(() => resolve())));

beforeEach(() => {
    offered = [];
    resetBundledSearchFailures();
});
afterEach(() => createMCPClient.mockReset());

const mcpTool = () => ({
    description: "fake MCP tool",
    inputSchema: jsonSchema({ type: "object", properties: { query: { type: "string" } } }),
    execute: async () => "ok",
});
const searchServers = (): Record<string, Record<string, unknown>> => ({
    parallel: { web_search: mcpTool(), web_fetch: mcpTool() },
    firecrawl: { firecrawl_search: mcpTool(), firecrawl_scrape: mcpTool() },
});
const reachableSearch = () =>
    createMCPClient.mockImplementation(async ({ clientName }: { clientName: string }) => {
        const tools = clientName.includes("parallel")
            ? searchServers().parallel
            : searchServers().firecrawl;
        return { tools: async () => tools, close: async () => undefined };
    });

async function ask(overrides: Record<string, unknown> = {}) {
    const { action } = await import("~/routes/api.chat");
    const response = await action({
        request: new Request("http://localhost/api/chat", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                messages: [
                    {
                        id: "u1",
                        role: "user",
                        parts: [{ type: "text", text: "what is gpt luna" }],
                    },
                ],
                model: "gpt-4o-mini",
                provider: "custom",
                apiKey: "sk-test",
                baseUrl,
                openAICompatible: {
                    apiMode: "chat",
                    authMode: "none",
                    reasoningWithTools: "auto",
                    capabilityOverrides: { tools: true },
                },
                chatId: `chat-${Math.random()}`,
                toolSettings: {
                    webSearchEnabled: true,
                    toolAccess: { webSearch: true, mcp: true },
                },
                mcpServers: FREE_SEARCH_MCP_PRESETS,
                ...overrides,
            }),
        }),
        params: {},
        context: {},
    } as never);
    expect(response.status).toBe(200);
    await response.text();
    return offered.at(-1)!;
}

describe("/api/chat web search", () => {
    it("searches with Parallel and Firecrawl for a plain question, and never offers web_search", async () => {
        reachableSearch();
        const { tools, system } = await ask();
        expect(tools).toEqual(
            expect.arrayContaining([
                "mcp_parallel_search_mcp_web_search",
                "mcp_firecrawl_keyless_firecrawl_search",
            ]),
        );
        expect(tools).not.toContain("web_search");
        // Parallel and Firecrawl read pages too, so the free fetcher is not added.
        expect(tools).not.toContain("fetch_url");
        expect(system).not.toMatch(/Live web search is unavailable/);
    });

    it("still searches when MCP access is off, because search rides on web search access", async () => {
        reachableSearch();
        const { tools } = await ask({
            toolSettings: { webSearchEnabled: true, toolAccess: { webSearch: true, mcp: false } },
        });
        expect(tools).toContain("mcp_parallel_search_mcp_web_search");
        expect(tools).not.toContain("web_search");
    });

    it("keeps custom MCP servers behind MCP access", async () => {
        createMCPClient.mockImplementation(async ({ clientName }: { clientName: string }) => ({
            tools: async () =>
                clientName.includes("custom") ? { lookup: mcpTool() } : searchServers().parallel,
            close: async () => undefined,
        }));
        const custom = {
            id: "custom",
            name: "Custom MCP",
            kind: "http",
            url: "https://example.com/mcp",
            enabled: true,
        };
        const withAccess = await ask({ mcpServers: [custom] });
        expect(withAccess.tools).toContain("mcp_custom_mcp_lookup");

        const withoutAccess = await ask({
            mcpServers: [custom],
            toolSettings: { webSearchEnabled: true, toolAccess: { webSearch: true, mcp: false } },
        });
        expect(withoutAccess.tools).not.toContain("mcp_custom_mcp_lookup");
    });

    it("uses a search connector instead of Parallel and Firecrawl when one is enabled", async () => {
        reachableSearch();
        const { tools } = await ask({
            toolSettings: {
                webSearchEnabled: true,
                toolAccess: { webSearch: true, mcp: true, connectors: true },
                connectors: [
                    { id: "c", kind: "tavily", name: "Tavily", enabled: true, apiKey: "tvly-test" },
                ],
            },
        });
        expect(tools).toContain("tavily_search");
        expect(tools).not.toContain("web_search");
        expect(tools.some((name) => name.startsWith("mcp_parallel"))).toBe(false);
        expect(tools.some((name) => name.startsWith("mcp_firecrawl"))).toBe(false);
    });

    it("falls back to fetch_url and says search is unavailable when both services are down", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        createMCPClient.mockRejectedValue(new Error("blocked"));
        const { tools, system } = await ask();
        expect(tools).not.toContain("web_search");
        expect(tools).toContain("fetch_url");
        expect(system).toMatch(/Live web search is unavailable this turn/);
    });

    it("offers no search at all, and no complaint, when web search is turned off", async () => {
        reachableSearch();
        const { tools, system } = await ask({
            toolSettings: { webSearchEnabled: false, toolAccess: { webSearch: false, mcp: true } },
        });
        expect(
            tools.filter((name) => /search|fetch/.test(name) && name !== "knowledge_search"),
        ).toEqual([]);
        expect(system).not.toMatch(/Live web search is unavailable/);
        expect(createMCPClient).not.toHaveBeenCalled();
    });

    it("does not even connect to the search servers for a provider that cannot call tools", async () => {
        reachableSearch();
        const { tools } = await ask({
            openAICompatible: {
                apiMode: "chat",
                authMode: "none",
                reasoningWithTools: "auto",
                capabilityOverrides: { tools: false },
            },
        });
        expect(tools).toEqual([]);
        expect(createMCPClient).not.toHaveBeenCalled();
    });

    it("does not let a client bring web_search back as a forwarded tool", async () => {
        reachableSearch();
        const { tools } = await ask({
            tools: {
                web_search: {
                    description: "Search the web",
                    parameters: { type: "object", properties: { query: { type: "string" } } },
                },
            },
        });
        expect(tools).not.toContain("web_search");
        expect(tools).toContain("mcp_parallel_search_mcp_web_search");
    });
});
