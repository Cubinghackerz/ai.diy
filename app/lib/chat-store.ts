/**
 * Chat message persistence — store/restore AI SDK UIMessages in IndexedDB.
 */

import type { UIMessage } from "ai";
import { getThreadMessages, putMessagesBatch } from "~/lib/db";
import type { MessageData } from "~/lib/types";

const savedUiSnapshots = new Map<string, Map<string, string>>();

function uiSnapshot(row: MessageData): string {
    return JSON.stringify(row.uiMessage ?? null);
}

function textFromUIMessage(msg: UIMessage): string {
    const parts = msg.parts ?? [];
    return parts
        .map((p) => {
            if (p.type === "text" && "text" in p) return String(p.text ?? "");
            return "";
        })
        .join("")
        .trim();
}

export function uiMessagesToStored(
    threadId: string,
    messages: UIMessage[],
    known?: Map<string, number>,
): MessageData[] {
    let lastKnown = 0;
    if (known) {
        for (const createdAt of known.values()) {
            if (createdAt > lastKnown) lastKnown = createdAt;
        }
    }
    let stamp = Math.max(lastKnown + 1, Date.now());
    return messages.map((msg, i) => {
        const id = msg.id || `msg_${threadId}_${i}`;
        const knownAt = known?.get(id);
        return {
            id,
            threadId,
            role: (msg.role === "user" || msg.role === "assistant" || msg.role === "system"
                ? msg.role
                : "assistant") as MessageData["role"],
            content: textFromUIMessage(msg),
            createdAt: knownAt === undefined ? stamp++ : knownAt,
            uiMessage: msg as unknown as Record<string, unknown>,
        };
    });
}

const INTERRUPTED_TOOL_ERROR = "Interrupted: the page closed before this finished.";
const PENDING_TOOL_STATES = new Set(["input-streaming", "input-available", "approval-requested"]);

export function sanitizeRestoredMessages(messages: UIMessage[]): UIMessage[] {
    return messages.map((message) => {
        const parts = message.parts;
        if (!parts?.length) return message;
        let changed = false;
        const nextParts = parts.map((part) => {
            if (
                (part.type === "text" || part.type === "reasoning") &&
                "state" in part &&
                part.state === "streaming"
            ) {
                changed = true;
                return { ...part, state: "done" as const };
            }
            const type = part.type ?? "";
            if (
                (type === "dynamic-tool" || type.startsWith("tool-")) &&
                "state" in part &&
                typeof part.state === "string" &&
                PENDING_TOOL_STATES.has(part.state)
            ) {
                changed = true;
                const next: Record<string, unknown> = {
                    ...part,
                    state: "output-error",
                    errorText: INTERRUPTED_TOOL_ERROR,
                };
                delete next.output;
                return next as typeof part;
            }
            return part;
        });
        return changed ? { ...message, parts: nextParts } : message;
    });
}

export function storedToUIMessages(stored: MessageData[]): UIMessage[] {
    return stored
        .slice()
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((row) => {
            if (row.uiMessage && typeof row.uiMessage === "object") {
                const ui = row.uiMessage as unknown as UIMessage;
                if (ui.id && ui.role && Array.isArray(ui.parts)) return ui;
            }
            // Legacy plain-text rows
            return {
                id: row.id,
                role: row.role === "tool" ? "assistant" : row.role,
                parts: [{ type: "text", text: row.content || "" }],
            } satisfies UIMessage;
        });
}

export async function replaceThreadMessages(
    threadId: string,
    messages: UIMessage[],
    metadata?: { model?: string; provider?: import("~/lib/types").ProviderId },
): Promise<void> {
    const existing = await getThreadMessages(threadId);
    const known = new Map(existing.map((row) => [row.id, row.createdAt]));
    const next = uiMessagesToStored(threadId, messages, known);
    const nextIds = new Set(next.map((row) => row.id));
    const deleteIds = existing.filter((row) => !nextIds.has(row.id)).map((row) => row.id);
    const previous = savedUiSnapshots.get(threadId);
    const toWrite = next.filter((row) => previous?.get(row.id) !== uiSnapshot(row));
    const nextSnapshots = new Map(next.map((row) => [row.id, uiSnapshot(row)]));

    try {
        const committed = await putMessagesBatch(threadId, toWrite, deleteIds, {
            ...metadata,
            updatedAt: Date.now(),
        });
        if (!committed) {
            savedUiSnapshots.delete(threadId);
            return;
        }
        savedUiSnapshots.set(threadId, nextSnapshots);
    } catch (error) {
        savedUiSnapshots.delete(threadId);
        throw error;
    }
}

export async function loadThreadUIMessages(threadId: string): Promise<UIMessage[]> {
    const stored = await getThreadMessages(threadId);
    return sanitizeRestoredMessages(storedToUIMessages(stored));
}
