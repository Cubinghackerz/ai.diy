/**
 * Chat importer — writes parsed chats into IndexedDB.
 *
 * Imports always create new threads and messages with fresh ids; existing
 * chats are never modified, so re-importing the same file duplicates chats.
 */

import { saveMessageToDB, saveThread } from "~/lib/db";
import type { ImportSummary } from "./types";

function newThreadId(): string {
    return `thread_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export interface ImportResult {
    chats: number;
    messages: number;
}

export async function importChats(summary: ImportSummary): Promise<ImportResult> {
    let chats = 0;
    let messages = 0;
    const base = Date.now();

    for (const chat of summary.chats) {
        const threadId = newThreadId();
        const created = chat.createdAt ?? base;
        const updated = chat.updatedAt ?? created;
        await saveThread({
            id: threadId,
            title: chat.title.trim().slice(0, 200) || "Imported Chat",
            createdAt: created,
            updatedAt: updated,
            systemPrompt: chat.systemPrompt,
            model: chat.model,
            provider: (chat.provider as import("~/lib/types").ProviderId) ?? undefined,
        });

        const msgs = chat.messages;
        for (let index = 0; index < msgs.length; index += 1) {
            const message = msgs[index];
            if (
                message.role !== "user" &&
                message.role !== "assistant" &&
                message.role !== "system"
            ) {
                continue;
            }
            await saveMessageToDB({
                id: `msg_${threadId}_${index}`,
                threadId,
                role: message.role,
                content: message.content,
                createdAt: message.createdAt ?? created + index,
            });
            messages += 1;
        }
        chats += 1;
    }

    return { chats, messages };
}
