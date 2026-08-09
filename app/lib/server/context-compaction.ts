/**
 * Context compaction — shared by the /Compaction skill and auto-compact when
 * the conversation approaches the model context window.
 *
 * Contract (Compaction skill):
 * - Preserve goals, decisions, open threads, citations/URLs, and hard constraints
 * - Drop redundant chat, long tool dumps, and repeated failed attempts
 * - Never invent facts; mark uncertain items as unresolved
 */

import type { UIMessage } from "ai";
import { DEFAULT_MODELS, type ProviderId } from "~/lib/types";

export type CompactablePart = {
    type?: string;
    text?: string;
    output?: unknown;
    result?: unknown;
    toolName?: string;
    state?: string;
};

export type CompactableMessage = {
    id?: string;
    role?: string;
    parts?: CompactablePart[];
    content?: string | Array<{ type?: string; text?: string }>;
};

export type CompactionResult = {
    messages: UIMessage[];
    compacted: boolean;
    summary: string;
    beforeTokens: number;
    afterTokens: number;
    droppedMessages: number;
};

const DEFAULT_CONTEXT_WINDOW = 128_000;
/** Leave headroom for system prompt, tools, and the upcoming reply. */
const CONTEXT_SOFT_RATIO = 0.72;
const KEEP_RECENT_MESSAGES = 8;
const MAX_SUMMARY_CHARS = 3_500;
const MAX_TURN_EXTRACT_CHARS = 420;
const MAX_TOOL_EXTRACT_CHARS = 180;
const SEARCH_TOOL_COMPACT_CHARS = 180;
const SEARCH_TOOL_RECENT_THRESHOLD = 400;
const FETCH_TOOL_TRUNCATE_THRESHOLD = 800;
const FETCH_TOOL_TRUNCATE_CHARS = 600;

function classifyCompactionToolKind(toolName: string): "search" | "fetch" | "other" {
    const name = toolName.toLowerCase();
    if (
        /search|instant_answer|find/.test(name) &&
        !/scrape|fetch|crawl|parse|read_url|extract/.test(name)
    ) {
        return "search";
    }
    if (/fetch|read_url|scrape|crawl|parse|extract/.test(name)) {
        return "fetch";
    }
    return "other";
}

function compactSearchListingText(text: string, maxChars = SEARCH_TOOL_COMPACT_CHARS): string {
    const urls = Array.from(
        new Set(
            (text.match(/https?:\/\/[^\s)\]>'"]+/gi) ?? []).map((url) =>
                url.replace(/[.,;:]+$/, ""),
            ),
        ),
    );
    if (urls.length > 0) {
        const urlBlock = urls.map((url) => `- ${url}`).join("\n");
        const header = "Search hits (URLs only):\n";
        const combined = `${header}${urlBlock}`;
        if (combined.length <= maxChars) return combined;
    }
    const normalized = text.replace(/\s+/g, " ").trim();
    if (normalized.length <= maxChars) return normalized;
    return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

export function estimateTokensFromText(text: string): number {
    // Conservative char→token estimate; slightly over so we compact early.
    return Math.ceil(Math.max(0, text.length) / 3.5);
}

export function resolveModelContextWindow(
    provider: ProviderId | string | undefined,
    model: string | undefined,
): number {
    if (!provider || !model) return DEFAULT_CONTEXT_WINDOW;
    const list = DEFAULT_MODELS[provider as ProviderId] ?? [];
    const exact = list.find((entry) => entry.id === model);
    if (exact?.contextWindow) return exact.contextWindow;
    const loose = list.find(
        (entry) =>
            entry.id.endsWith(`/${model}`) ||
            entry.id === model ||
            model.endsWith(entry.id),
    );
    return loose?.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
}

export function extractMessageText(message: CompactableMessage): string {
    const chunks: string[] = [];
    if (Array.isArray(message.parts)) {
        for (const part of message.parts) {
            if (!part || typeof part !== "object") continue;
            if (part.type === "text" && typeof part.text === "string") {
                chunks.push(part.text);
                continue;
            }
            const isTool =
                typeof part.type === "string" &&
                (part.type.startsWith("tool-") || part.type === "dynamic-tool");
            if (isTool) {
                const name =
                    (typeof part.toolName === "string" && part.toolName) ||
                    (typeof part.type === "string"
                        ? part.type.replace(/^tool-/, "")
                        : "tool");
                const output = part.output ?? part.result;
                const body =
                    typeof output === "string"
                        ? output
                        : output != null
                          ? JSON.stringify(output)
                          : "";
                if (body) {
                    const kind = classifyCompactionToolKind(name);
                    const extract =
                        kind === "search"
                            ? compactSearchListingText(body, MAX_TOOL_EXTRACT_CHARS)
                            : body.replace(/\s+/g, " ").trim().slice(0, MAX_TOOL_EXTRACT_CHARS);
                    chunks.push(`[tool:${name}] ${extract}`);
                }
            }
        }
    } else if (typeof message.content === "string") {
        chunks.push(message.content);
    } else if (Array.isArray(message.content)) {
        for (const part of message.content) {
            if (part?.type === "text" && typeof part.text === "string") {
                chunks.push(part.text);
            }
        }
    }
    return chunks.join("\n").replace(/\s+/g, " ").trim();
}

export function estimateMessagesTokens(
    messages: CompactableMessage[],
    extraText = "",
): number {
    let total = estimateTokensFromText(extraText);
    for (const message of messages) {
        total += 8; // role / framing overhead
        total += estimateTokensFromText(extractMessageText(message));
    }
    return total;
}

/** Build the Compaction-skill summary from older turns. */
export function buildCompactionSummary(
    older: CompactableMessage[],
    options: { focus?: string; reason?: string } = {},
): string {
    const turns = older
        .map((message) => {
            const role = message.role || "unknown";
            const text = extractMessageText(message).slice(0, MAX_TURN_EXTRACT_CHARS);
            return text ? `${role}: ${text}` : "";
        })
        .filter(Boolean);

    const urls = Array.from(
        new Set(
            turns
                .join("\n")
                .match(/https?:\/\/[^\s)\]>'"]+/gi)
                ?.map((url) => url.replace(/[.,;:]+$/, "")) ?? [],
        ),
    ).slice(0, 12);

    const goals = turns
        .filter((line) => line.startsWith("user:"))
        .slice(0, 6)
        .map((line) => `- ${line.slice(5).trim()}`)
        .join("\n");

    const assistantBits = turns
        .filter((line) => line.startsWith("assistant:"))
        .slice(-8)
        .map((line) => `- ${line.slice(10).trim()}`)
        .join("\n");

    const focus = options.focus?.trim();
    const reason = options.reason?.trim() || "context budget";

    return [
        "# Compacted prior context",
        `Source: Compaction skill (${reason}).`,
        "Do not invent details that are not present below. Prefer the recent messages after this block when they conflict.",
        focus ? `Focus: ${focus}` : "",
        "",
        "## Goals / requests",
        goals || "- (none captured)",
        "",
        "## Carry-forward notes",
        assistantBits || "- (none captured)",
        "",
        "## Cited / retrieved URLs",
        urls.length ? urls.map((url) => `- ${url}`).join("\n") : "- (none)",
        "",
        "## Raw turn digest (truncated)",
        turns
            .slice(0, 24)
            .map((line) => `- ${line}`)
            .join("\n") || "- (empty)",
    ]
        .filter((line) => line !== "")
        .join("\n")
        .slice(0, MAX_SUMMARY_CHARS);
}

export function compactionSkillGuide(input: {
    focus?: string;
    reason?: string;
    summary: string;
    beforeTokens: number;
    afterTokens: number;
    droppedMessages: number;
}): string {
    return `# Compaction Skill

Focus: ${input.focus?.trim() || "general continuity"}
Reason: ${input.reason?.trim() || "manual /Compaction"}
Tokens: ~${input.beforeTokens} → ~${input.afterTokens} (dropped ${input.droppedMessages} older messages)

## Mission
Compress prior conversation into a faithful carry-forward brief so the model can continue without reloading full history or long tool dumps.

## Rules
1. Keep goals, decisions, constraints, open questions, and retrieved URLs.
2. Drop chatter, duplicated tool output, and failed dead-ends unless they change the plan.
3. Never invent facts, URLs, or conclusions not present in the source turns.
4. After compaction, answer from the compacted brief + the recent uncompacted messages.
5. Tools remain available — do not forget search, Python, files, or other active tools.

## Compacted brief
${input.summary}

## Next step
Acknowledge compaction briefly only if the user asked for /Compaction. Then continue the user's latest request using the brief above.`;
}

/**
 * Compact UI messages when forced or when estimated tokens exceed the soft
 * context budget. Recent turns stay intact; older turns become one summary.
 */
export function compactUiMessages(
    messages: UIMessage[],
    options: {
        contextWindow: number;
        reserveTokens?: number;
        systemTokens?: number;
        force?: boolean;
        focus?: string;
        reason?: string;
        keepRecent?: number;
    },
): CompactionResult {
    const reserve = options.reserveTokens ?? 4_096;
    const systemTokens = options.systemTokens ?? 0;
    const keepRecent = Math.max(2, options.keepRecent ?? KEEP_RECENT_MESSAGES);
    const budget = Math.max(
        4_000,
        Math.floor(options.contextWindow * CONTEXT_SOFT_RATIO) - reserve - systemTokens,
    );

    const beforeTokens = estimateMessagesTokens(messages);
    if (!options.force && beforeTokens <= budget) {
        return {
            messages,
            compacted: false,
            summary: "",
            beforeTokens,
            afterTokens: beforeTokens,
            droppedMessages: 0,
        };
    }

    if (messages.length <= keepRecent + 1) {
        // Still over budget with few messages: strip bulky tool parts in place.
        const stripped = messages.map((message) =>
            stripBulkyToolParts(message),
        ) as UIMessage[];
        const afterTokens = estimateMessagesTokens(stripped);
        return {
            messages: stripped,
            compacted: afterTokens < beforeTokens,
            summary: "",
            beforeTokens,
            afterTokens,
            droppedMessages: 0,
        };
    }

    const older = messages
        .slice(0, -keepRecent)
        .map((message) => stripBulkyToolParts(message, { aggressive: true }));
    const recent = messages
        .slice(-keepRecent)
        .map((message) => stripBulkyToolParts(message, { aggressive: false }));
    const summary = buildCompactionSummary(older, {
        focus: options.focus,
        reason: options.reason ?? (options.force ? "forced compaction" : "auto context limit"),
    });

    const bridge: UIMessage[] = [
        {
            id: `compacted-${Date.now()}`,
            role: "user",
            parts: [
                {
                    type: "text",
                    text: `${summary}\n\n(End compacted prior context. Continue from the recent messages that follow.)`,
                },
            ],
        } as UIMessage,
        {
            id: `compacted-ack-${Date.now()}`,
            role: "assistant",
            parts: [
                {
                    type: "text",
                    text: "Prior context compacted. I will continue from that brief and the recent messages, and I still have the active tools for this turn.",
                },
            ],
        } as UIMessage,
    ];

    // Ensure the recent block still ends with the latest user turn when possible.
    const next = [...bridge, ...recent] as UIMessage[];
    const afterTokens = estimateMessagesTokens(next);
    return {
        messages: next,
        compacted: true,
        summary,
        beforeTokens,
        afterTokens,
        droppedMessages: older.length,
    };
}

function stripBulkyToolParts(
    message: UIMessage,
    options: { aggressive?: boolean } = {},
): UIMessage {
    if (!Array.isArray(message.parts)) return message;
    const aggressive = options.aggressive === true;
    const parts = message.parts.map((part) => {
        if (!part || typeof part !== "object") return part;
        const type = "type" in part ? String(part.type) : "";
        if (!type.startsWith("tool-") && type !== "dynamic-tool") return part;
        const toolName =
            ("toolName" in part && typeof part.toolName === "string" && part.toolName) ||
            type.replace(/^tool-/, "");
        const output =
            "output" in part
                ? part.output
                : "result" in part
                  ? (part as { result?: unknown }).result
                  : undefined;
        const text =
            typeof output === "string"
                ? output
                : output != null
                  ? JSON.stringify(output)
                  : "";
        if (!text) return part;

        const kind = classifyCompactionToolKind(toolName);
        if (kind === "search") {
            const threshold = aggressive ? 0 : SEARCH_TOOL_RECENT_THRESHOLD;
            if (text.length > threshold) {
                return {
                    ...part,
                    output: compactSearchListingText(
                        text,
                        aggressive ? SEARCH_TOOL_COMPACT_CHARS : FETCH_TOOL_TRUNCATE_CHARS,
                    ),
                };
            }
            return part;
        }
        if (kind === "fetch" && text.length > FETCH_TOOL_TRUNCATE_THRESHOLD) {
            return {
                ...part,
                output: `${text.slice(0, FETCH_TOOL_TRUNCATE_CHARS)}\n\n[Truncated tool output for context compaction]`,
            };
        }
        return part;
    });
    return { ...message, parts } as UIMessage;
}
