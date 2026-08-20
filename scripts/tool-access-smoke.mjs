import {
    DEFAULT_TOOL_ACCESS,
    normalizeToolAccess,
    toolAccessKeyForTool,
    toolAccessAllows,
} from "../app/lib/tool-access.ts";

let failures = 0;
function check(name, condition, detail = "") {
    if (condition) console.log(`ok - ${name}`);
    else {
        failures++;
        console.error(`FAIL - ${name} ${detail}`);
    }
}

const migrated = normalizeToolAccess(undefined, {
    ...DEFAULT_TOOL_ACCESS,
    python: false,
    linux: false,
});
check("legacy settings migration", migrated.python === false && migrated.linux === false);

const selected = normalizeToolAccess({
    webSearch: false,
    npmProject: false,
    subagents: true,
});
check("explicit selection", selected.webSearch === false && selected.npmProject === false);
check("tool id web mapping", toolAccessKeyForTool("fetch_url") === "webSearch");
check("tool id npm mapping", toolAccessKeyForTool("npm_project") === "npmProject");
check("tool id alias mapping", toolAccessKeyForTool("run_code") === "python");
check("knowledge does not inherit web gate", toolAccessKeyForTool("knowledge_search") === "knowledge");
check("disabled tools are rejected", !toolAccessAllows(selected, "fetch_url"));
check("enabled tools are allowed", toolAccessAllows(selected, "calculator"));
check("mcp tools use the MCP gate", toolAccessKeyForTool("mcp_server_search") === "mcp");

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
