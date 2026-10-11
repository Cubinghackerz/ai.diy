// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    isMutatingComposioCall,
    isMutatingComposioTool,
    restrictComposioToolsToReads,
    wrapComposioToolsForConfirmation,
} from "~/lib/server/composio-guard";
import { loadMcpTools, resetBundledSearchFailures } from "~/lib/server/mcp-tools";
import { formatActiveToolsReminder } from "~/lib/server/prompt";
import {
    markComposioNeedsResync,
    resetComposioResync,
    resyncComposioSession,
} from "~/lib/composio-session.client";
import { FREE_SEARCH_MCP_PRESETS, type ComposioSettings, type McpServerConfig } from "~/lib/types";

const createMCPClient = vi.hoisted(() => vi.fn());
vi.mock("@ai-sdk/mcp", () => ({ createMCPClient }));
vi.mock("~/lib/server/provider-url", async (original) => ({
    ...(await original<typeof import("~/lib/server/provider-url")>()),
    assertConfiguredHttpUrlResolved: async (value: string) => new URL(value),
}));

const composioServer: McpServerConfig = {
    id: "composio",
    name: "Composio",
    kind: "http",
    url: "https://connect.composio.dev/mcp",
    enabled: true,
};
const fakeClient = (tools: Record<string, unknown>) => ({
    tools: async () => tools,
    close: vi.fn(async () => undefined),
});
const tool = () => ({ inputSchema: {}, execute: async () => "ok" });

beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
    createMCPClient.mockReset();
    resetBundledSearchFailures();
    vi.restoreAllMocks();
});

describe("Composio connection", () => {
    it("retries once when the first connection drops, so the apps are not silently missing", async () => {
        createMCPClient
            .mockRejectedValueOnce(new Error("socket hang up"))
            .mockResolvedValueOnce(fakeClient({ COMPOSIO_SEARCH_TOOLS: tool() }));
        const { tools, failed } = await loadMcpTools([composioServer]);
        expect(createMCPClient).toHaveBeenCalledTimes(2);
        expect(Object.keys(tools)).toEqual(["mcp_composio_COMPOSIO_SEARCH_TOOLS"]);
        expect(failed).toEqual([]);
    });

    it("reports a failure after the retry also fails, instead of hiding it", async () => {
        createMCPClient.mockRejectedValue(new Error("connect ETIMEDOUT"));
        const { tools, failed } = await loadMcpTools([composioServer]);
        expect(createMCPClient).toHaveBeenCalledTimes(2);
        expect(tools).toEqual({});
        expect(failed).toEqual(["composio"]);
    });

    it("does not retry a failure a retry cannot fix", async () => {
        createMCPClient.mockRejectedValue(new Error("HTTP 401 Unauthorized"));
        const { failed } = await loadMcpTools([composioServer]);
        expect(createMCPClient).toHaveBeenCalledTimes(1);
        expect(failed).toEqual(["composio"]);
    });

    it("never counts a cancelled request as a broken server", async () => {
        const controller = new AbortController();
        createMCPClient.mockImplementation(async () => {
            controller.abort();
            throw new Error("aborted");
        });
        const { failed } = await loadMcpTools([composioServer], undefined, controller.signal);
        expect(createMCPClient).toHaveBeenCalledTimes(1);
        expect(failed).toEqual([]);
    });

    it("reports bundled search and custom servers by kind, without retrying them", async () => {
        createMCPClient.mockRejectedValue(new Error("down"));
        const parallel = FREE_SEARCH_MCP_PRESETS[0]!;
        const custom: McpServerConfig = { ...composioServer, id: "mine", name: "Mine" };
        const { failed } = await loadMcpTools([parallel, custom]);
        expect(createMCPClient).toHaveBeenCalledTimes(2);
        expect([...failed].sort()).toEqual(["mcp", "search"]);
    });

    it("tells the model when the apps did not load, and only then", () => {
        const down = formatActiveToolsReminder(["calculator"], { appsUnavailable: true });
        expect(down).toContain("connected apps (Composio)");
        expect(down).toContain("Re-sync session");
        expect(formatActiveToolsReminder(["calculator"])).not.toContain("Composio");
        expect(formatActiveToolsReminder([], { appsUnavailable: true })).toContain(
            "could not be reached",
        );
    });
});

describe("Composio write guard", () => {
    const execute = (slug: string) => ({
        tools: [{ tool_slug: slug, arguments: {} }],
    });

    it("treats lookups and listings as reads and unknown or write actions as writes", () => {
        expect(isMutatingComposioTool("mcp_composio_COMPOSIO_SEARCH_TOOLS")).toBe(false);
        expect(isMutatingComposioTool("mcp_composio_COMPOSIO_GET_TOOL_SCHEMAS")).toBe(false);
        expect(isMutatingComposioTool("mcp_composio_COMPOSIO_MANAGE_CONNECTIONS")).toBe(false);
        expect(isMutatingComposioTool("mcp_composio_COMPOSIO_MULTI_EXECUTE_TOOL")).toBe(true);
        expect(isMutatingComposioTool("mcp_composio_COMPOSIO_REMOTE_WORKBENCH")).toBe(true);
        expect(isMutatingComposioTool("mcp_composio_facebook_create_post")).toBe(true);
        expect(isMutatingComposioTool("calculator")).toBe(false);
    });

    it("judges an execute call by the actions inside it", () => {
        const name = "mcp_composio_COMPOSIO_MULTI_EXECUTE_TOOL";
        expect(isMutatingComposioCall(name, execute("DISCORD_LIST_MY_GUILDS"))).toBe(false);
        expect(isMutatingComposioCall(name, execute("GMAIL_FETCH_EMAILS"))).toBe(false);
        expect(isMutatingComposioCall(name, execute("DISCORD_SEND_MESSAGE"))).toBe(true);
        expect(isMutatingComposioCall(name, execute("SOMEAPP_DO_THING"))).toBe(true);
        expect(
            isMutatingComposioCall(name, {
                tools: [
                    { tool_slug: "DISCORD_LIST_MY_GUILDS" },
                    { tool_slug: "DISCORD_DELETE_MESSAGE" },
                ],
            }),
        ).toBe(true);
        // Cannot read the slugs: fail closed.
        expect(isMutatingComposioCall(name, {})).toBe(true);
        expect(isMutatingComposioCall(name, { tools: [] })).toBe(true);
        expect(isMutatingComposioCall(name, { tools: [{}] })).toBe(true);
        expect(isMutatingComposioCall("mcp_composio_COMPOSIO_SEARCH_TOOLS", {})).toBe(false);
    });

    const spyTool = () => {
        const run = vi.fn(async () => ({ content: [{ type: "text", text: "ran" }] }));
        return { run, tool: { inputSchema: {}, execute: run } };
    };

    it("runs read-only executes without a confirmation prompt", async () => {
        const { run, tool: execTool } = spyTool();
        const wrapped = wrapComposioToolsForConfirmation(
            { mcp_composio_COMPOSIO_MULTI_EXECUTE_TOOL: execTool as never },
            [],
            false,
        );
        const exec = (
            wrapped.mcp_composio_COMPOSIO_MULTI_EXECUTE_TOOL as never as {
                execute: (a: unknown) => Promise<unknown>;
            }
        ).execute;
        await exec(execute("DISCORD_LIST_MY_GUILDS"));
        expect(run).toHaveBeenCalledTimes(1);
        const blocked = JSON.stringify(await exec(execute("DISCORD_SEND_MESSAGE")));
        expect(blocked).toContain("CONFIRMATION_REQUIRED");
        expect(run).toHaveBeenCalledTimes(1);
    });

    it("without a way to ask, keeps the execute tool for reads and declines writes", async () => {
        const { run, tool: execTool } = spyTool();
        const restricted = restrictComposioToolsToReads({
            mcp_composio_COMPOSIO_SEARCH_TOOLS: tool() as never,
            mcp_composio_COMPOSIO_MULTI_EXECUTE_TOOL: execTool as never,
            mcp_composio_COMPOSIO_REMOTE_WORKBENCH: tool() as never,
            mcp_composio_facebook_create_post: tool() as never,
            calculator: tool() as never,
        });
        expect(Object.keys(restricted).sort()).toEqual([
            "calculator",
            "mcp_composio_COMPOSIO_MULTI_EXECUTE_TOOL",
            "mcp_composio_COMPOSIO_SEARCH_TOOLS",
        ]);
        const exec = (
            restricted.mcp_composio_COMPOSIO_MULTI_EXECUTE_TOOL as never as {
                execute: (a: unknown) => Promise<unknown>;
            }
        ).execute;
        await exec(execute("DISCORD_LIST_MY_GUILDS"));
        expect(run).toHaveBeenCalledTimes(1);
        const declined = JSON.stringify(await exec(execute("DISCORD_SEND_MESSAGE")));
        expect(declined).toContain("Write actions are turned off");
        expect(run).toHaveBeenCalledTimes(1);
    });
});

describe("Composio session re-sync", () => {
    const settings: ComposioSettings = {
        enabled: true,
        apiKey: "ck_test",
        userId: "u1",
        sessionId: "s1",
        mcpUrl: "https://mcp.example/old",
        mcpHeaders: { "x-api-key": "ck_test" },
        autoApproveWrites: false,
        tipDismissed: false,
    };
    const respond = (body: unknown, ok = true) =>
        vi.fn(async () => ({ ok, json: async () => body }) as Response);

    beforeEach(() => resetComposioResync());
    afterEach(() => vi.unstubAllGlobals());

    it("checks once per page load, then leaves a verified session alone", async () => {
        const fetchMock = respond({
            ok: true,
            sessionId: "s1",
            mcpUrl: settings.mcpUrl,
            mcpHeaders: settings.mcpHeaders,
            userId: "u1",
        });
        vi.stubGlobal("fetch", fetchMock);
        expect(await resyncComposioSession(settings)).toBeNull();
        expect(await resyncComposioSession(settings)).toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const sent = JSON.parse(
            (fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body,
        );
        expect(sent).toMatchObject({ action: "session", sessionId: "s1", userId: "u1" });
    });

    it("hands back the new endpoint when Composio replaced the session", async () => {
        vi.stubGlobal(
            "fetch",
            respond({
                ok: true,
                sessionId: "s2",
                mcpUrl: "https://mcp.example/new",
                mcpHeaders: { "x-api-key": "k2" },
                userId: "u1",
            }),
        );
        const next = await resyncComposioSession(settings);
        expect(next).toMatchObject({
            sessionId: "s2",
            mcpUrl: "https://mcp.example/new",
            mcpHeaders: { "x-api-key": "k2" },
            apiKey: "ck_test",
        });
    });

    it("re-checks right after the server reports the apps did not load", async () => {
        const fetchMock = respond({
            ok: true,
            sessionId: "s1",
            mcpUrl: settings.mcpUrl,
            mcpHeaders: settings.mcpHeaders,
        });
        vi.stubGlobal("fetch", fetchMock);
        await resyncComposioSession(settings);
        markComposioNeedsResync();
        await resyncComposioSession(settings);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("never blocks or breaks sending: failures keep the saved session", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => {
                throw new Error("offline");
            }),
        );
        expect(await resyncComposioSession(settings)).toBeNull();
        vi.stubGlobal("fetch", respond({ ok: false, error: "nope" }, false));
        expect(await resyncComposioSession(settings)).toBeNull();
    });

    it("does nothing unless Composio is switched on with a key and a session", async () => {
        const fetchMock = respond({});
        vi.stubGlobal("fetch", fetchMock);
        expect(await resyncComposioSession({ ...settings, enabled: false })).toBeNull();
        expect(await resyncComposioSession({ ...settings, apiKey: "" })).toBeNull();
        expect(await resyncComposioSession({ ...settings, sessionId: null })).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
