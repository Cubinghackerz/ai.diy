import {
    isMutatingComposioTool,
    wrapComposioToolsForConfirmation,
} from "../app/lib/server/composio-guard.ts";

const cases = [
    ["mcp_composio_facebook_get_posts", false],
    ["mcp_composio_facebook_list_comments", false],
    ["mcp_composio_instagram_search_media", false],
    ["mcp_composio_youtube_search_videos", false],
    ["mcp_composio_facebook_create_post", true],
    ["mcp_composio_instagram_publish_media", true],
    ["mcp_composio_facebook_send_message", true],
    ["mcp_composio_unknown_operation", true],
    ["calculator", false],
];

for (const [name, expected] of cases) {
    const actual = isMutatingComposioTool(name);
    if (actual !== expected) {
        throw new Error(`${name}: expected ${expected}, received ${actual}`);
    }
    console.log(`ok - ${name}`);
}

console.log("\nAll Composio guard checks passed.");

const mcpOutputAdapter = ({ output }) => {
    if (
        !output ||
        typeof output !== "object" ||
        !("content" in output) ||
        !Array.isArray(output.content)
    ) {
        throw new Error("MCP output must contain content[]");
    }
    return output;
};

const fakeMcpTool = {
    inputSchema: {},
    toModelOutput: mcpOutputAdapter,
    execute: async () => "raw tool output",
};
const guarded = wrapComposioToolsForConfirmation(
    { mcp_composio_gmail_send_email: fakeMcpTool },
    undefined,
    false,
);
const confirmation = await guarded.mcp_composio_gmail_send_email.execute({});
mcpOutputAdapter({ output: confirmation });
if (!confirmation.content[0]?.text?.startsWith("CONFIRMATION_REQUIRED")) {
    throw new Error("Confirmation result was not preserved as MCP text");
}
console.log("ok - MCP confirmation result envelope");
