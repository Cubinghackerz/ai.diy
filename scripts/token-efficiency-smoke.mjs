import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vite = await createServer({
    root,
    appType: "custom",
    server: { middlewareMode: true },
    resolve: { alias: { "~": path.join(root, "app") } },
});

let failures = 0;
function check(name, condition, detail = "") {
    if (condition) console.log(`ok - ${name}`);
    else {
        failures++;
        console.error(`FAIL - ${name} ${detail}`);
    }
}

try {
    const compaction = await vite.ssrLoadModule(
        path.join(root, "app/lib/server/context-compaction.ts"),
    );
    const budget = await vite.ssrLoadModule(
        path.join(root, "app/lib/server/prompt-budget.ts"),
    );
    const mcp = await vite.ssrLoadModule(
        path.join(root, "app/lib/server/mcp-tools.ts"),
    );
    const chatTools = await vite.ssrLoadModule(
        path.join(root, "app/lib/server/chat-tools.ts"),
    );

    const balancedTools = await chatTools.buildChatTools(
        {
            tokenMode: "balanced",
            webSearchEnabled: true,
            calculatorEnabled: true,
            pythonEnabled: true,
            linuxEnvironment: true,
            skillsEnabled: true,
            knowledgeEnabled: true,
            memoryAvailable: true,
            toolAccess: {
                webSearch: true,
                calculator: true,
                python: true,
                linux: true,
                npmProject: true,
                fileCreation: true,
                skills: true,
                memory: true,
                knowledge: true,
                connectors: true,
                mcp: true,
                subagents: false,
                currentTime: true,
                askUser: true,
                compaction: true,
            },
        },
        { provider: "openai", messages: [] },
    );
    check("canonical tool remains available", Boolean(balancedTools.fetch_url));
    check("legacy read alias is omitted", !balancedTools.read_url);
    check("legacy Python alias is omitted", !balancedTools.run_code);
    check("legacy file alias is omitted", !balancedTools.generate_file);

    const deniedTools = await chatTools.buildChatTools(
        {
            tokenMode: "balanced",
            toolAccess: {
                webSearch: false,
                calculator: false,
                python: false,
                linux: false,
                npmProject: false,
                fileCreation: false,
                skills: false,
                memory: false,
                knowledge: false,
                connectors: false,
                mcp: false,
                subagents: false,
                currentTime: false,
                askUser: false,
                compaction: false,
            },
        },
        { provider: "openai", messages: [] },
    );
    check("disabled web tools are absent", !deniedTools.web_search && !deniedTools.fetch_url);
    check("disabled code tools are absent", !deniedTools.run_python && !deniedTools.linux_run_command);
    check("disabled file tool is absent", !deniedTools.create_file);
    check("disabled interaction tools are absent", !deniedTools.ask_user && !deniedTools.memory);

    const oldToolOutput = `results ${"x".repeat(2600)} https://example.com/source`;
    const recentToolOutput = `recent ${"y".repeat(900)}`;
    const messages = [
        { role: "user", parts: [{ type: "text", text: "old request" }] },
        {
            role: "assistant",
            parts: [
                {
                    type: "tool-mcp_search",
                    toolName: "mcp_search",
                    output: oldToolOutput,
                },
            ],
        },
        { role: "user", parts: [{ type: "text", text: "recent request" }] },
        {
            role: "assistant",
            parts: [{ type: "tool-web_search", output: recentToolOutput }],
        },
    ];
    const projected = compaction.projectUiMessagesForModel(messages, {
        keepRecent: 2,
        compactToolResults: true,
    });
    check("historical projection keeps message count", projected.length === messages.length);
    check(
        "historical tool output is bounded",
        projected[1].parts[0].output.length < oldToolOutput.length,
    );
    check(
        "historical source URL survives",
        projected[1].parts[0].output.includes("https://example.com/source"),
    );
    check(
        "recent tool output stays untouched",
        projected[3].parts[0].output === recentToolOutput,
    );

    const promptBudget = budget.estimatePromptBudget({
        systemText: "system prompt",
        messages: projected,
        builtInTools: {
            calculator: { description: "exact math", inputSchema: { expression: "string" } },
        },
        mcpTools: {
            mcp_search: { description: "search", inputSchema: { query: "string" } },
        },
    });
    check("prompt budget counts tools", promptBudget.builtInTools === 1 && promptBudget.mcpTools === 1);
    check("prompt budget is additive", promptBudget.totalTokens > promptBudget.historyTokens);

    const bundled = {
        id: "mcp_parallel_search",
        name: "Parallel Search MCP",
        kind: "http",
        url: "https://search.parallel.ai/mcp",
        enabled: true,
    };
    const custom = {
        id: "custom",
        name: "Custom MCP",
        kind: "http",
        url: "https://example.com/mcp",
        enabled: true,
    };
    check(
        "bundled MCP is deferred without search intent",
        mcp.selectMcpServersForRequest([bundled, custom], {
            searchIntent: false,
            activeSearchConnector: false,
            webSearchEnabled: true,
            mcpToolAlreadyUsed: false,
        }).length === 1,
    );
    check(
        "bundled MCP loads for search intent",
        mcp.selectMcpServersForRequest([bundled], {
            searchIntent: true,
            activeSearchConnector: false,
            webSearchEnabled: true,
            mcpToolAlreadyUsed: false,
        }).length === 1,
    );
} finally {
    await vite.close();
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
