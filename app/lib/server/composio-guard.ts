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
    if (tokens.some((token) => WRITE_ACTIONS.has(token))) return true;
    if (tokens.some((token) => READ_ACTIONS.has(token))) return false;
    // Unknown and mixed operations fail closed.
    return true;
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

function canonicalize(value: unknown, seen = new WeakSet<object>()): string {
    if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "undefined";
    if (seen.has(value)) return '"[Circular]"';
    seen.add(value);
    if (Array.isArray(value)) {
        return `[${value.map((item) => canonicalize(item, seen)).join(",")}]`;
    }
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key], seen)}`)
        .join(",")}}`;
}

export function composioCallFingerprint(toolName: string, args: unknown): string {
    const input = `${toolName}\n${canonicalize(args)}`;
    let hash = 0x811c9dc5;
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
}

type ComposioApproval = {
    toolName: string;
    fingerprint: string;
    decision: "allow" | "deny";
};

function latestComposioApproval(messages: UIMessage[] | undefined): ComposioApproval | null {
    if (!messages?.length) return null;
    const message = messages[messages.length - 1];
    if (message?.role !== "assistant" || !Array.isArray(message.parts)) return null;

    let marker: Omit<ComposioApproval, "decision"> | null = null;
    let approval: ComposioApproval | null = null;
    let consumed = false;
    for (const rawPart of message.parts) {
        const part = rawPart as {
            type?: string;
            toolName?: string;
            state?: string;
            output?: unknown;
            result?: unknown;
        };
        const output = stringifyOutput(part.output ?? part.result);
        const type = part.type ?? "";
        const match = output.match(
            /COMPOSIO_CONFIRMATION\s+tool=([a-zA-Z0-9_-]+)\s+fingerprint=([a-f0-9]{8})/,
        );
        const partIsNamedTool = (toolName: string) =>
            type === `tool-${toolName}` ||
            (type === "dynamic-tool" && part.toolName === toolName);
        if (match && partIsNamedTool(match[1]!)) {
            marker = { toolName: match[1]!, fingerprint: match[2]! };
            continue;
        }
        const consumedMatch = output.match(
            /COMPOSIO_CONFIRMATION_CONSUMED\s+tool=([a-zA-Z0-9_-]+)\s+fingerprint=([a-f0-9]{8})/,
        );
        if (
            consumedMatch &&
            partIsNamedTool(consumedMatch[1]!) &&
            marker?.toolName === consumedMatch[1] &&
            marker.fingerprint === consumedMatch[2]
        ) {
            consumed = true;
            continue;
        }
        const isAsk =
            type === "tool-ask_user" ||
            (type === "dynamic-tool" && part.toolName === "ask_user") ||
            /ask_user/i.test(type);
        if (!marker || !isAsk || (part.state && part.state !== "output-available")) continue;
        const answer = output.trim().toLowerCase();
        if (/\bno\b|cancel/.test(answer)) {
            approval = { ...marker, decision: "deny" };
            continue;
        }
        if (/\byes\b|proceed|run it|execute/.test(answer)) {
            approval = { ...marker, decision: "allow" };
        }
    }
    return consumed ? null : approval;
}

function confirmationOutput(toolName: string, fingerprint: string): string {
    const action = toolName.replace(/^mcp_composio_/i, "").replace(/_/g, " ");
    return [
        "CONFIRMATION_REQUIRED",
        `COMPOSIO_CONFIRMATION tool=${toolName} fingerprint=${fingerprint}`,
        `This action modifies data (${action}).`,
        "Call ask_user now with:",
        '- question: a one-line summary of the exact action',
        '- questionType: "single"',
        '- options: ["Yes", "No"]',
        "Do not invent a result. After the user answers, re-call this same tool with the same arguments.",
    ].join("\n");
}

function mcpTextResult(text: string): { content: [{ type: "text"; text: string }] } {
    return { content: [{ type: "text", text }] };
}

function markApprovalConsumed(
    value: unknown,
    toolName: string,
    fingerprint: string,
): { content: Array<{ type: "text"; text: string }> } {
    const marker = `COMPOSIO_CONFIRMATION_CONSUMED tool=${toolName} fingerprint=${fingerprint}`;
    if (
        value &&
        typeof value === "object" &&
        Array.isArray((value as { content?: unknown }).content)
    ) {
        return {
            ...(value as object),
            content: [
                ...((value as { content: Array<{ type: "text"; text: string }> }).content),
                { type: "text", text: marker },
            ],
        };
    }
    return {
        content: [
            { type: "text", text: stringifyOutput(value) },
            { type: "text", text: marker },
        ],
    };
}

export function wrapComposioToolsForConfirmation(
    tools: ToolSet,
    messages: UIMessage[] | undefined,
    autoApproveWrites: boolean,
): ToolSet {
    const approval = latestComposioApproval(messages);
    let approvalConsumed = false;
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
                if (autoApproveWrites) return execute(...callArgs);
                const fingerprint = composioCallFingerprint(name, callArgs[0]);
                const matchesApproval =
                    !approvalConsumed &&
                    approval?.toolName === name &&
                    approval.fingerprint === fingerprint;
                if (matchesApproval && approval.decision === "deny") {
                    approvalConsumed = true;
                    return mcpTextResult(
                        "Canceled by the user. Do not retry this write.",
                    );
                }
                if (matchesApproval && approval.decision === "allow") {
                    approvalConsumed = true;
                    return markApprovalConsumed(
                        await execute(...callArgs),
                        name,
                        fingerprint,
                    );
                }
                return mcpTextResult(confirmationOutput(name, fingerprint));
            },
        } as ToolSet[string];
    }
    return next;
}
