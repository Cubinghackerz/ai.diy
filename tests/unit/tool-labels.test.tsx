import { describe, expect, it } from "vitest";
import { toolHumanLabel, toolRunSummary } from "~/components/assistant-ui/work-summary";
import { composioAppsFromArgs, composioToolkitFromSlug } from "~/lib/composio-labels";

const execArgs = (...slugs: string[]) =>
    JSON.stringify({ tools: slugs.map((tool_slug) => ({ tool_slug, arguments: {} })) });

describe("tool labels", () => {
    it("names Composio's lookup tool for what it does, not as a web search", () => {
        const label = toolHumanLabel("mcp_composio_COMPOSIO_SEARCH_TOOLS", '{"queries":[]}');
        expect(label.name).toBe("Connected apps");
        expect(label.past).toBe("Looked up app actions");
        expect(label.live).not.toMatch(/web/i);
    });

    it("names the app behind an execute call", () => {
        const label = toolHumanLabel(
            "mcp_composio_COMPOSIO_MULTI_EXECUTE_TOOL",
            execArgs("DISCORD_LIST_MY_GUILDS"),
        );
        expect(label).toMatchObject({
            name: "Discord",
            past: "Used Discord",
            live: "Using Discord…",
        });
        expect(
            toolHumanLabel(
                "mcp_composio_COMPOSIO_MULTI_EXECUTE_TOOL",
                execArgs("GMAIL_FETCH_EMAILS", "SLACK_LIST_CHANNELS"),
            ).past,
        ).toBe("Used Gmail and Slack");
        expect(toolHumanLabel("mcp_composio_COMPOSIO_MULTI_EXECUTE_TOOL", "{").past).toBe(
            "Used a connected app",
        );
        expect(toolHumanLabel("mcp_composio_github_get_repo").past).toBe("Used Github");
    });

    it("labels the math tools plainly", () => {
        expect(toolHumanLabel("graph_function").past).toBe("Drew a graph");
        expect(toolHumanLabel("math_analyze").past).toBe("Worked it out");
        expect(toolHumanLabel("calculator").past).toBe("Calculated");
    });

    it("summarises a run in one plain sentence", () => {
        const summary = toolRunSummary([
            { name: "mcp_composio_COMPOSIO_SEARCH_TOOLS" },
            {
                name: "mcp_composio_COMPOSIO_MULTI_EXECUTE_TOOL",
                argsText: execArgs("DISCORD_LIST_MY_GUILDS"),
            },
        ]);
        expect(summary).toBe("Used Discord");
        expect(toolRunSummary([{ name: "mcp_composio_COMPOSIO_SEARCH_TOOLS" }])).toBe(
            "Used connected apps",
        );
        expect(
            toolRunSummary([
                "mcp_parallel_search_mcp_web_search",
                "mcp_parallel_search_mcp_web_fetch",
            ]),
        ).toBe("Ran a search · Read a page");
        expect(toolRunSummary(["graph_function"])).toBe("Drew a graph");
        expect(toolRunSummary(["graph_function", "calculator"])).toBe("Used 2 tools");
        expect(toolRunSummary([])).toBe("Used tools");
    });

    it("reads apps from slugs", () => {
        expect(composioToolkitFromSlug("DISCORDBOT_GET_GUILD")).toBe("Discordbot");
        expect(composioToolkitFromSlug("COMPOSIO_SEARCH_TOOLS")).toBeNull();
        expect(composioAppsFromArgs(execArgs("A_B", "A_C", "D_E"))).toEqual(["A", "D"]);
        expect(composioAppsFromArgs(undefined)).toEqual([]);
    });
});
