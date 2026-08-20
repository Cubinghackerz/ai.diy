/**
 * User-controlled capability gates. These are deliberately broader than
 * individual tool ids so setup stays understandable while server and client
 * enforcement remain centralized.
 */

export const TOOL_ACCESS_KEYS = [
    "webSearch",
    "calculator",
    "python",
    "linux",
    "npmProject",
    "fileCreation",
    "skills",
    "memory",
    "knowledge",
    "connectors",
    "mcp",
    "subagents",
    "currentTime",
    "askUser",
    "compaction",
] as const;

export type ToolAccessKey = (typeof TOOL_ACCESS_KEYS)[number];
export type ToolAccessSettings = Record<ToolAccessKey, boolean>;

export type ToolAccessOption = {
    key: ToolAccessKey;
    label: string;
    description: string;
};

export const TOOL_ACCESS_OPTIONS: ToolAccessOption[] = [
    {
        key: "webSearch",
        label: "Web research",
        description: "Search, page fetching, YouTube transcripts, and URL audits",
    },
    {
        key: "calculator",
        label: "Calculator",
        description: "Deterministic arithmetic, units, and trigonometry",
    },
    {
        key: "python",
        label: "Python analysis",
        description: "Browser Pyodide for data work, charts, and specialized files",
    },
    {
        key: "linux",
        label: "Linux environment",
        description: "Client-side CheerpX Debian shell, files, and processes",
    },
    {
        key: "npmProject",
        label: "NPM projects",
        description: "Browser-local WebContainer projects and safe package installs",
    },
    {
        key: "fileCreation",
        label: "File creation",
        description: "Create downloadable files and Canvas previews",
    },
    {
        key: "skills",
        label: "Skills",
        description: "Optional workflow contracts for research, design, documents, and prompts",
    },
    {
        key: "memory",
        label: "Local memory",
        description: "Attach and retrieve user-approved memories stored in this browser",
    },
    {
        key: "knowledge",
        label: "Knowledge base",
        description: "Search uploaded documents with private browser-local retrieval",
    },
    {
        key: "connectors",
        label: "Connected apps",
        description: "Inspect and call explicitly configured integrations",
    },
    {
        key: "mcp",
        label: "MCP servers",
        description: "Load enabled external Model Context Protocol servers",
    },
    {
        key: "subagents",
        label: "Subagents",
        description: "Delegate approved tasks to separate assistant sessions",
    },
    {
        key: "currentTime",
        label: "Current time",
        description: "Return an exact time for an IANA timezone",
    },
    {
        key: "askUser",
        label: "Ask user",
        description: "Let the assistant ask a focused clarification when needed",
    },
    {
        key: "compaction",
        label: "Context compaction",
        description: "Compress older conversation into a carry-forward brief",
    },
];

export const DEFAULT_TOOL_ACCESS: ToolAccessSettings = {
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
};

export function normalizeToolAccess(
    value: unknown,
    fallback: Partial<ToolAccessSettings> = {},
): ToolAccessSettings {
    const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const result = { ...DEFAULT_TOOL_ACCESS, ...fallback };
    for (const key of TOOL_ACCESS_KEYS) {
        if (typeof input[key] === "boolean") result[key] = input[key] as boolean;
    }
    return result;
}

/** Map both canonical and legacy ids to the setup capability that owns them. */
export function toolAccessKeyForTool(toolName: string): ToolAccessKey | null {
    const name = toolName.trim().toLowerCase();
    if (!name) return null;
    if (
        name.startsWith("mcp_")
    ) return "mcp";
    if (name.startsWith("knowledge_")) return "knowledge";
    if (
        /search|fetch_url|read_url|youtube|url_doctor|research_skill|duckduckgo/.test(name)
    ) return "webSearch";
    if (name === "calculator" || name === "calculate") return "calculator";
    if (name === "run_python" || name === "run_code" || name === "python_file_creation_skill") {
        return "python";
    }
    if (
        name === "linux_environment_skill" ||
        name.startsWith("linux_") ||
        name === "run_command" ||
        name === "read_file"
    ) return "linux";
    if (name === "npm_project" || name === "npm_project_skill") return "npmProject";
    if (name === "create_file" || name === "generate_file") return "fileCreation";
    if (name === "memory") return "memory";
    if (name === "connector_guide" || name === "connect_request" || name === "list_connections") {
        return "connectors";
    }
    if (name === "spawn_subagent" || name === "spawn_subagents") return "subagents";
    if (name === "get_current_time") return "currentTime";
    if (name === "ask_user") return "askUser";
    if (name === "compaction_skill") return "compaction";
    if (
        name.endsWith("_skill") ||
        name === "html_craft" ||
        name === "create_skill" ||
        name === "skill_architect" ||
        name === "prompt_architect" ||
        name === "create_prompt" ||
        name === "frontend_design_skill" ||
        name === "ultimate_frontend_ui" ||
        name === "word_doc_skill" ||
        name === "file_creation_skill"
    ) return "skills";
    return null;
}

export function toolAccessAllows(
    access: Partial<ToolAccessSettings> | undefined,
    toolName: string,
): boolean {
    const key = toolAccessKeyForTool(toolName);
    return key == null || access?.[key] !== false;
}
