/**
 * Plain-language names for Composio's tools. Composio exposes a handful of
 * meta-tools (COMPOSIO_SEARCH_TOOLS, COMPOSIO_MULTI_EXECUTE_TOOL, ...) and the
 * app an action belongs to is only visible in the action slug inside the
 * arguments (DISCORD_LIST_MY_GUILDS → Discord).
 */
const PREFIX = /^mcp_composio_/i;

export function isComposioToolName(name: string | null | undefined): boolean {
    return typeof name === "string" && PREFIX.test(name.trim());
}

/** Human name of the app behind an action slug, e.g. DISCORD_LIST_MY_GUILDS → "Discord". */
export function composioToolkitFromSlug(slug: string): string | null {
    const first = slug.trim().split("_")[0] ?? "";
    if (!first || /^composio$/i.test(first)) return null;
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function parseArgs(argsText: string | undefined): Record<string, unknown> | null {
    if (!argsText) return null;
    try {
        const parsed = JSON.parse(argsText) as unknown;
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : null;
    } catch {
        return null;
    }
}

/** Apps an execute call touches, in order, without duplicates. */
export function composioAppsFromArgs(argsText: string | undefined): string[] {
    const args = parseArgs(argsText);
    const tools = args?.tools;
    if (!Array.isArray(tools)) return [];
    const apps: string[] = [];
    for (const entry of tools) {
        const slug = (entry as { tool_slug?: unknown } | null)?.tool_slug;
        const app = typeof slug === "string" ? composioToolkitFromSlug(slug) : null;
        if (app && !apps.includes(app)) apps.push(app);
    }
    return apps;
}

export type ComposioLabel = {
    name: string;
    live: string;
    past: string;
    /** Which group a run summary counts it in. */
    app: string | null;
};

function joinApps(apps: string[]): string {
    if (apps.length <= 1) return apps[0] ?? "";
    return `${apps.slice(0, -1).join(", ")} and ${apps[apps.length - 1]}`;
}

/** Label for any `mcp_composio_*` tool, using the arguments when they name the app. */
export function composioToolLabel(toolName: string, argsText?: string): ComposioLabel {
    const action = toolName.trim().replace(PREFIX, "").toLowerCase();
    if (action === "composio_search_tools" || action === "composio_get_tool_schemas") {
        return {
            name: "Connected apps",
            live: "Finding the right app action…",
            past: "Looked up app actions",
            app: null,
        };
    }
    if (action === "composio_manage_connections") {
        return {
            name: "Connected apps",
            live: "Checking app connections…",
            past: "Checked app connections",
            app: null,
        };
    }
    if (action === "composio_remote_workbench" || action === "composio_remote_bash_tool") {
        return {
            name: "Connected apps",
            live: "Processing app data…",
            past: "Processed app data",
            app: null,
        };
    }
    const apps =
        action === "composio_multi_execute_tool"
            ? composioAppsFromArgs(argsText)
            : [composioToolkitFromSlug(action.toUpperCase())].filter((a): a is string =>
                  Boolean(a),
              );
    const names = joinApps(apps);
    return names
        ? { name: names, live: `Using ${names}…`, past: `Used ${names}`, app: names }
        : {
              name: "Connected apps",
              live: "Using a connected app…",
              past: "Used a connected app",
              app: "connected apps",
          };
}
