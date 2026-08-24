import type { ToolSet } from "ai";
import type { UIMessage } from "ai";

const WRITE_ACTIONS = new Set([
    "send",
    "create",
    "update",
    "delete",
    "write",
    "post",
    "put",
    "patch",
    "remove",
    "trash",
    "archive",
    "invite",
    "share",
    "publish",
    "upload",
    "edit",
    "modify",
    "insert",
    "replace",
    "rename",
    "assign",
    "merge",
    "approve",
    "reject",
    "block",
    "kick",
    "ban",
    "comment",
    "reply",
    "forward",
    "draft",
    "schedule",
    "add",
    "like",
    "react",
    "follow",
    "unfollow",
    "subscribe",
]);
const READ_ACTIONS = new Set([
    "search",
    "list",
    "get",
    "fetch",
    "read",
    "find",
    "lookup",
    "describe",
    "status",
    "check",
    "count",
    "preview",
    "show",
    "view",
    "browse",
    "retrieve",
]);

export function isMutatingComposioTool(name: string): boolean {
    const n = name.toLowerCase();
    if (!n.startsWith("mcp_composio_")) return false;
    const tokens = n
        .slice("mcp_composio_".length)
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
    const action = tokens.find((token) => READ_ACTIONS.has(token) || WRITE_ACTIONS.has(token));
    // The first verb is the operation; later tokens are usually nouns (for
    // example, "get_posts" and "list_comments"). Unknown operations fail
    // closed and still require confirmation.
    return action ? WRITE_ACTIONS.has(action) : true;
}

function stringifyOutput(value: unknown): string {
    if (typeof value === "string") return value;
    if (value == null) return "";
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

export function lastAskUserAnswer(messages: UIMessage[] | undefined): string | null {
    if (!messages?.length) return null;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const message = messages[i];
        const parts = Array.isArray(message.parts) ? message.parts : [];
        for (let j = parts.length - 1; j >= 0; j -= 1) {
            const part = parts[j] as {
                type?: string;
                toolName?: string;
                state?: string;
                output?: unknown;
                result?: unknown;
            };
            const type = part.type ?? "";
            const isAsk =
                type === "tool-ask_user" ||
                type === "dynamic-tool" && part.toolName === "ask_user" ||
                /ask_user/i.test(type);
            if (!isAsk) continue;
            if (part.state && part.state !== "output-available") continue;
            const raw = stringifyOutput(part.output ?? part.result).trim();
            if (raw) return raw;
        }
    }
    return null;
}

export type ConfirmDecision = "allow" | "always" | "deny" | "ask";

export function resolveComposioConfirmation(
    messages: UIMessage[] | undefined,
    autoApproveWrites: boolean,
): ConfirmDecision {
    if (autoApproveWrites) return "allow";
    const answer = lastAskUserAnswer(messages);
    if (!answer) return "ask";
    const a = answer.toLowerCase();
    if (/don'?t ask|always allow|always/.test(a)) return "always";
    if (/\bno\b|cancel/.test(a)) return "deny";
    if (/\byes\b|proceed|run it|execute/.test(a)) return "allow";
    return "ask";
}

function confirmationOutput(toolName: string): string {
    const action = toolName.replace(/^mcp_composio_/i, "").replace(/_/g, " ");
    return [
        "CONFIRMATION_REQUIRED",
        `This action modifies data (${action}).`,
        "Call ask_user now with:",
        '- question: a one-line summary of the exact action',
        '- questionType: "single"',
        '- options: ["Yes", "No", "Yes, don\'t ask again"]',
        "Do not invent a result. After the user answers, re-call this same tool with the same arguments.",
    ].join("\n");
}

function mcpTextResult(text: string): { content: [{ type: "text"; text: string }] } {
    return { content: [{ type: "text", text }] };
}

export function wrapComposioToolsForConfirmation(
    tools: ToolSet,
    messages: UIMessage[] | undefined,
    autoApproveWrites: boolean,
): ToolSet {
    const decision = resolveComposioConfirmation(messages, autoApproveWrites);
    const next: ToolSet = { ...tools };
    for (const [name, tool] of Object.entries(tools)) {
        if (!isMutatingComposioTool(name)) continue;
        const original = tool as ToolSet[string] & {
            execute?: (...args: unknown[]) => unknown;
        };
        if (typeof original.execute !== "function") continue;
        const execute = original.execute.bind(original);
        next[name] = {
            ...original,
            execute: async (...callArgs: unknown[]) => {
                if (decision === "deny") {
                    return mcpTextResult(
                        "Canceled by the user. Do not retry this write.",
                    );
                }
                if (decision === "ask") {
                    return mcpTextResult(confirmationOutput(name));
                }
                return execute(...callArgs);
            },
        } as ToolSet[string];
    }
    return next;
}
