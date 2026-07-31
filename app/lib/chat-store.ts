/**
 * Chat message persistence — store/restore AI SDK UIMessages in IndexedDB.
 */

import type { UIMessage } from "ai";
import {
    getThreadMessages,
    saveMessageToDB,
    saveThread,
    getAllThreads,
    deleteMessageFromDB,
} from "~/lib/db";
import type { MessageData } from "~/lib/types";

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
): MessageData[] {
    const now = Date.now();
    return messages.map((msg, i) => ({
        id: msg.id || `msg_${threadId}_${i}`,
        threadId,
        role: (msg.role === "user" ||
        msg.role === "assistant" ||
        msg.role === "system"
            ? msg.role
            : "assistant") as MessageData["role"],
        content: textFromUIMessage(msg),
        createdAt: now + i,
        uiMessage: msg as unknown as Record<string, unknown>,
    }));
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

/** Replace all messages for a thread (atomic-ish: delete then put). */
export async function replaceThreadMessages(
    threadId: string,
    messages: UIMessage[],
): Promise<void> {
    const existing = await getThreadMessages(threadId);
    const next = uiMessagesToStored(threadId, messages);
    const nextIds = new Set(next.map((m) => m.id));

    // Delete removed messages
    for (const old of existing) {
        if (!nextIds.has(old.id)) {
            await deleteMessageFromDB(old.id);
        }
    }

    for (const msg of next) {
        await saveMessageToDB(msg);
    }

    const threads = await getAllThreads();
    const thread = threads.find((t) => t.id === threadId);
    if (thread) {
        await saveThread({ ...thread, updatedAt: Date.now() });
    }
}

export async function loadThreadUIMessages(
    threadId: string,
): Promise<UIMessage[]> {
    const stored = await getThreadMessages(threadId);
    return storedToUIMessages(stored);
}
