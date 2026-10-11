// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { isBundledSearchMcpServer, mcpServersForRequest } from "~/lib/mcp-servers";
import { buildChatTools } from "~/lib/server/chat-tools";
import {
    loadMcpTools,
    resetBundledSearchFailures,
    selectMcpServersForRequest,
} from "~/lib/server/mcp-tools";
import { buildChatSystemPromptParts, formatActiveToolsReminder } from "~/lib/server/prompt";
import {
    isBundledLiveSearchToolName,
    isLiveSearchToolName,
    normalizeToolAccess,
    toolAccessKeyForTool,
} from "~/lib/tool-access";
import { FREE_SEARCH_MCP_PRESETS, type ConnectorConfig, type McpServerConfig } from "~/lib/types";

const createMCPClient = vi.hoisted(() => vi.fn());
vi.mock("@ai-sdk/mcp", () => ({ createMCPClient }));
// The real check resolves DNS; the test only cares about what happens after it.
vi.mock("~/lib/server/provider-url", async (original) => ({
    ...(await original<typeof import("~/lib/server/provider-url")>()),
    assertConfiguredHttpUrlResolved: async (value: string) => new URL(value),
}));

afterEach(() => {
    createMCPClient.mockReset();
    resetBundledSearchFailures();
});

const parallel = FREE_SEARCH_MCP_PRESETS.find((server) => server.id === "mcp_parallel_search")!;
const firecrawl = FREE_SEARCH_MCP_PRESETS.find((server) => server.id === "mcp_firecrawl_keyless")!;
const custom: McpServerConfig = {
    id: "custom",
    name: "Custom MCP",
    kind: "http",
    url: "https://example.com/mcp",
    enabled: true,
};
const tavily: ConnectorConfig = {
    id: "connector_tavily",
    kind: "tavily",
    name: "Tavily",
    enabled: true,
    apiKey: "tvly-test",
};

describe("the model has no built-in web_search tool", () => {
    it("registers no web_search with web search on, with or without a connector", async () => {
        const plain = await buildChatTools(
            { webSearchEnabled: true, toolAccess: { webSearch: true } },
            { provider: "openai", messages: [] },
        );
        expect(plain.web_search).toBeUndefined();
        // Without Parallel/Firecrawl loaded, only the page-fetch fallback remains:
        // nothing registered can search the live web.
        expect(Object.keys(plain).filter(isLiveSearchToolName)).toEqual([]);
        expect(plain.fetch_url).toBeDefined();

        const withConnector = await buildChatTools(
            { webSearchEnabled: true, toolAccess: { webSearch: true }, connectors: [tavily] },
            { provider: "openai", messages: [] },
        );
        expect(withConnector.web_search).toBeUndefined();
        expect(withConnector.tavily_search).toBeDefined();
    });

    it("does not add a search tool for a disabled or keyless connector", async () => {
        const tools = await buildChatTools(
            {
                webSearchEnabled: true,
                toolAccess: { webSearch: true },
                connectors: [
                    { ...tavily, enabled: false },
                    { ...tavily, kind: "brave", id: "connector_brave", apiKey: "" },
                ],
            },
            { provider: "openai", messages: [] },
        );
        expect(tools.tavily_search).toBeUndefined();
        expect(tools.brave_search).toBeUndefined();
        expect(tools.web_search).toBeUndefined();
    });

    it("leaves page reading to Parallel/Firecrawl when they are loaded", async () => {
        const tools = await buildChatTools(
            { webSearchEnabled: true, toolAccess: { webSearch: true } },
            { provider: "openai", messages: [], bundledSearchLoaded: true },
        );
        expect(tools.web_search).toBeUndefined();
        expect(tools.fetch_url).toBeUndefined();
    });

    it("exposes no web tools when web search access is off", async () => {
        const tools = await buildChatTools(
            { webSearchEnabled: true, toolAccess: { webSearch: false }, connectors: [tavily] },
            { provider: "openai", messages: [] },
        );
        expect(tools.web_search).toBeUndefined();
        expect(tools.tavily_search).toBeUndefined();
        expect(tools.fetch_url).toBeUndefined();
    });

    it("keeps a connector search failure inside the tool result, with no web_search fallback", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response("nope", { status: 401 })),
        );
        try {
            const tools = await buildChatTools(
                { webSearchEnabled: true, toolAccess: { webSearch: true }, connectors: [tavily] },
                { provider: "openai", messages: [] },
            );
            const result = await (
                tools.tavily_search as { execute: (input: unknown, options: unknown) => unknown }
            ).execute({ query: "gpt luna" }, { toolCallId: "t", messages: [] });
            expect(String(result)).toMatch(/Search unavailable/);
            expect(String(result)).not.toMatch(/built-in/i);
        } finally {
            vi.unstubAllGlobals();
        }
    });
});

describe("which MCP servers load for search", () => {
    it("loads Parallel and Firecrawl whenever web search is on, whatever the user typed", () => {
        const selected = selectMcpServersForRequest([parallel, firecrawl, custom], {
            activeSearchConnector: false,
            webSearchEnabled: true,
        });
        expect(selected.map((server) => server.id)).toEqual([
            "mcp_parallel_search",
            "mcp_firecrawl_keyless",
            "custom",
        ]);
    });

    it("drops them when web search is off or a search connector replaces them", () => {
        expect(
            selectMcpServersForRequest([parallel, firecrawl, custom], {
                activeSearchConnector: false,
                webSearchEnabled: false,
            }).map((server) => server.id),
        ).toEqual(["custom"]);
        expect(
            selectMcpServersForRequest([parallel, firecrawl, custom], {
                activeSearchConnector: true,
                webSearchEnabled: true,
            }).map((server) => server.id),
        ).toEqual(["custom"]);
    });

    it("respects a server the user switched off", () => {
        expect(
            selectMcpServersForRequest([{ ...parallel, enabled: false }, firecrawl], {
                activeSearchConnector: false,
                webSearchEnabled: true,
            }).map((server) => server.id),
        ).toEqual(["mcp_firecrawl_keyless"]);
    });

    it("recognizes a keyed Firecrawl endpoint as a bundled search server", () => {
        expect(
            isBundledSearchMcpServer({
                ...custom,
                id: "mine",
                url: "https://mcp.firecrawl.dev/fc-key/v2/mcp",
            }),
        ).toBe(true);
        expect(isBundledSearchMcpServer(custom)).toBe(false);
    });
});

describe("what the client sends", () => {
    const servers = [parallel, firecrawl, custom];
    const ids = (list: McpServerConfig[]) => list.map((server) => server.id);

    it("sends the search servers on web search access even when MCP access is off", () => {
        expect(
            ids(
                mcpServersForRequest(
                    servers,
                    normalizeToolAccess({ mcp: false, webSearch: true }),
                    true,
                ),
            ),
        ).toEqual(["mcp_parallel_search", "mcp_firecrawl_keyless"]);
    });

    it("sends custom servers only with MCP access, and nothing for search when it is off", () => {
        expect(
            ids(
                mcpServersForRequest(
                    servers,
                    normalizeToolAccess({ mcp: true, webSearch: false }),
                    true,
                ),
            ),
        ).toEqual(["custom"]);
        expect(
            ids(
                mcpServersForRequest(
                    servers,
                    normalizeToolAccess({ mcp: true, webSearch: true }),
                    false,
                ),
            ),
        ).toEqual(["custom"]);
    });
});

describe("tool access for the search tools", () => {
    it("treats Parallel and Firecrawl tools as web search, not MCP", () => {
        expect(toolAccessKeyForTool("mcp_parallel_search_mcp_web_search")).toBe("webSearch");
        expect(toolAccessKeyForTool("mcp_firecrawl_keyless_firecrawl_search")).toBe("webSearch");
        expect(toolAccessKeyForTool("mcp_custom_thing")).toBe("mcp");
        expect(toolAccessKeyForTool("mcp_composio_gmail_send")).toBe("composio");
    });

    it("tells live search tools apart from fetch tools and from web_search", () => {
        for (const name of [
            "mcp_parallel_search_mcp_web_search",
            "mcp_firecrawl_keyless_firecrawl_search",
            "tavily_search",
            "parallel_search",
        ]) {
            expect(isLiveSearchToolName(name), name).toBe(true);
        }
        for (const name of [
            "web_search",
            "fetch_url",
            "mcp_parallel_search_mcp_web_fetch",
            "duckduckgo_instant_answer",
        ]) {
            expect(isLiveSearchToolName(name), name).toBe(false);
        }
        expect(isBundledLiveSearchToolName("mcp_parallel_search_mcp_web_fetch")).toBe(true);
        expect(isBundledLiveSearchToolName("web_search")).toBe(false);
    });
});

describe("loadMcpTools", () => {
    const fakeClient = (tools: Record<string, unknown>, delayMs = 0) => ({
        tools: async () => {
            // No timer at all when there is no delay, so fake-timer tests do not hang.
            if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
            return tools;
        },
        close: vi.fn(async () => undefined),
    });
    const tool = () => ({ inputSchema: {}, execute: async () => "ok" });

    it("connects to every server at once and keeps tools in configured order", async () => {
        createMCPClient.mockImplementation(async ({ clientName }: { clientName: string }) =>
            clientName.includes("parallel")
                ? fakeClient({ web_search: tool() }, 40)
                : fakeClient({ firecrawl_search: tool() }, 0),
        );
        const started = Date.now();
        const { tools, clients } = await loadMcpTools([parallel, firecrawl]);
        expect(Object.keys(tools)).toEqual([
            "mcp_parallel_search_mcp_web_search",
            "mcp_firecrawl_keyless_firecrawl_search",
        ]);
        expect(clients).toHaveLength(2);
        // Both servers were asked for before either answered.
        expect(createMCPClient).toHaveBeenCalledTimes(2);
        expect(Date.now() - started).toBeLessThan(2_000);
    });

    it("still returns the other server's tools when one fails to connect", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        createMCPClient.mockImplementation(async ({ clientName }: { clientName: string }) => {
            if (clientName.includes("parallel")) throw new Error("connection refused");
            return fakeClient({ firecrawl_search: tool() });
        });
        const { tools, clients } = await loadMcpTools([parallel, firecrawl]);
        expect(Object.keys(tools)).toEqual(["mcp_firecrawl_keyless_firecrawl_search"]);
        expect(clients).toHaveLength(1);
    });

    it("skips a bundled search server that just failed, then tries it again later", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        vi.useFakeTimers();
        try {
            createMCPClient.mockRejectedValue(new Error("blocked"));
            await loadMcpTools([parallel]);
            expect(createMCPClient).toHaveBeenCalledTimes(1);

            // Within the minute: no new connection attempt, so chat is not slowed down.
            await loadMcpTools([parallel]);
            expect(createMCPClient).toHaveBeenCalledTimes(1);

            vi.setSystemTime(Date.now() + 61_000);
            createMCPClient.mockResolvedValue(fakeClient({ web_search: tool() }));
            const { tools } = await loadMcpTools([parallel]);
            expect(Object.keys(tools)).toEqual(["mcp_parallel_search_mcp_web_search"]);
            expect(createMCPClient).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });

    it("does not penalize a search server when the request itself was cancelled", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const cancelled = AbortSignal.abort();
        createMCPClient.mockRejectedValue(new Error("aborted"));
        await loadMcpTools([parallel], undefined, cancelled);
        createMCPClient.mockResolvedValue(fakeClient({ web_search: tool() }));
        const { tools } = await loadMcpTools([parallel]);
        expect(Object.keys(tools)).toEqual(["mcp_parallel_search_mcp_web_search"]);
    });

    it("never skips a custom MCP server because of an earlier failure", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        createMCPClient.mockRejectedValue(new Error("down"));
        await loadMcpTools([custom]);
        createMCPClient.mockResolvedValue(fakeClient({ lookup: tool() }));
        const { tools } = await loadMcpTools([custom]);
        expect(Object.keys(tools)).toEqual(["mcp_custom_mcp_lookup"]);
    });

    it("closes a client whose tool listing never answers instead of stalling the chat", async () => {
        vi.useFakeTimers();
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        try {
            const stuck = {
                tools: () => new Promise<never>(() => {}),
                close: vi.fn(async () => undefined),
            };
            createMCPClient.mockResolvedValue(stuck);
            const pending = loadMcpTools([parallel]);
            await vi.advanceTimersByTimeAsync(9_000);
            const { tools, clients } = await pending;
            expect(tools).toEqual({});
            expect(clients).toHaveLength(0);
            expect(stuck.close).toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });
});

/** Prompt text with the explicit "there is no web_search tool" sentences removed. */
function withoutNegations(prompt: string): string {
    return prompt.replace(
        /There is no (?:tool named )?web_search(?: tool)?; never call one\./g,
        "",
    );
}
const STANDALONE_WEB_SEARCH = /(?<![A-Za-z0-9_])web_search(?![A-Za-z0-9_])/;

describe("prompts", () => {
    it("never offers web_search as a callable tool, in any token mode", () => {
        for (const mode of ["efficient", "balanced", "caching", "full"] as const) {
            const prompt = buildChatSystemPromptParts(undefined, "", [], "main", "", false, mode, [
                "mcp_parallel_search_mcp_web_search",
            ]).full;
            expect(withoutNegations(prompt), mode).not.toMatch(STANDALONE_WEB_SEARCH);
            expect(prompt, mode).toMatch(/Parallel|Firecrawl|mcp_/);
        }
    });

    it("tells the model outright that web_search does not exist (full and balanced prompts)", () => {
        for (const mode of ["balanced", "full"] as const) {
            const prompt = buildChatSystemPromptParts(
                undefined,
                "",
                [],
                "main",
                "",
                false,
                mode,
            ).full;
            expect(prompt, mode).toMatch(/no (?:tool named )?web_search(?: tool)?; never call one/);
        }
    });

    it("maps a portable skill's web_search to the real search tool", () => {
        const withSkill = (content: string) =>
            buildChatSystemPromptParts(
                undefined,
                "",
                [{ name: "web-research", content }],
                "main",
                "",
                false,
                "balanced",
                ["mcp_parallel_search_mcp_web_search"],
            ).volatile;
        const note = withSkill("## Tool rules\n- Run `web_search` for each angle.");
        expect(note).toMatch(/`web_search` means your live search tool/);
        expect(note).toMatch(/call only the exact names in ACTIVE TOOLS/);
        // A skill that never mentions search does not pay for the note.
        expect(withSkill("## Tool rules\n- Use `calculator`.")).not.toMatch(
            /means your live search tool/,
        );
    });

    it("lists the exact search tools that loaded", () => {
        const reminder = formatActiveToolsReminder(
            ["mcp_parallel_search_mcp_web_search", "mcp_firecrawl_keyless_firecrawl_search"],
            { searchExpected: true },
        );
        expect(reminder).toContain("mcp_parallel_search_mcp_web_search");
        expect(reminder).not.toMatch(/unavailable this turn/);
    });

    it("says plainly when search is on but nothing could load", () => {
        const reminder = formatActiveToolsReminder(["fetch_url", "calculator"], {
            searchExpected: true,
        });
        expect(reminder).toMatch(/Live web search is unavailable this turn/);
        expect(reminder).toMatch(/do not call or invent a search tool/i);
        expect(reminder).toMatch(/fetch_url/);
        expect(formatActiveToolsReminder([], { searchExpected: true })).toMatch(
            /unavailable this turn/,
        );
    });

    it("does not blame search when the user turned it off", () => {
        const prompt = buildChatSystemPromptParts(
            undefined,
            "",
            [],
            "main",
            "",
            false,
            "balanced",
            ["calculator"],
            { webSearch: false },
        ).full;
        expect(prompt).not.toMatch(/unavailable this turn/);
    });
});
