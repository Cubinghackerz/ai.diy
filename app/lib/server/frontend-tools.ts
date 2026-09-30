import { jsonSchema, tool, type Tool } from "ai";

/** Shape of the client-forwarded `tools` field on the chat request body. */
export type FrontendToolPayload = Record<
    string,
    { description?: string; parameters?: unknown; providerOptions?: unknown }
>;

const FRONTEND_TOOL_NAME = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const MAX_FRONTEND_TOOLS = 16;
const MAX_FRONTEND_SCHEMA_CHARS = 32_768;
const MAX_FRONTEND_DESCRIPTION_CHARS = 2_000;
const MAX_MODEL_INSTRUCTIONS_CHARS = 64_000;

/** OpenUI Lang frontend tools — gated by the Generative UI tool-access key. */
const GENERATIVE_UI_TOOL_NAMES = new Set(["present_openui", "prompt_openui"]);

/**
 * Sanitize client-forwarded tool schemas into no-execute `tool()` defs.
 * These only describe what the model may call — the client executes them —
 * so a bad or hostile payload degrades to "tool dropped", never a server
 * action. Names that collide with server tools are dropped so a client
 * cannot shadow a real tool with a call that silently never runs.
 */
export function frontendToolsFromBody(
    raw: FrontendToolPayload | undefined,
    reservedNames: ReadonlySet<string>,
    generativeUiEnabled: boolean,
): Record<string, Tool> {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out: Record<string, Tool> = {};
    for (const [name, def] of Object.entries(raw).slice(
        0,
        MAX_FRONTEND_TOOLS * 4,
    )) {
        if (Object.keys(out).length >= MAX_FRONTEND_TOOLS) break;
        if (!FRONTEND_TOOL_NAME.test(name) || reservedNames.has(name)) continue;
        if (!generativeUiEnabled && GENERATIVE_UI_TOOL_NAMES.has(name)) continue;
        if (!def || typeof def !== "object") continue;
        const parameters = def.parameters;
        if (!parameters || typeof parameters !== "object") continue;
        let schemaJson: string;
        try {
            schemaJson = JSON.stringify(parameters);
        } catch {
            continue;
        }
        if (schemaJson.length > MAX_FRONTEND_SCHEMA_CHARS) continue;
        const description =
            typeof def.description === "string"
                ? def.description.slice(0, MAX_FRONTEND_DESCRIPTION_CHARS)
                : "";
        try {
            out[name] = tool({
                description,
                inputSchema: jsonSchema(JSON.parse(schemaJson)),
            });
        } catch {
            continue;
        }
    }
    return out;
}

export function sanitizeModelInstructions(raw: unknown): string {
    if (typeof raw !== "string") return "";
    return raw
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
        .slice(0, MAX_MODEL_INSTRUCTIONS_CHARS)
        .trim();
}
