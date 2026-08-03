/**
 * ai.diy export parser — both the full backup JSON and per-chat JSON.
 *
 * Backup format (from exportLocalBackup): `{ version: 1, threads, messages,
 * artifacts, previewSessions, memories, projects }` where messages carry
 * `threadId`. Per-chat format: `{ format: "ai-diy-chat", version, exportedAt,
 * chat, messages }` with the thread fields flattened onto `chat`.
 */

import type { ThreadData, MessageData } from "~/lib/types";
import type { InteropChat, InteropMessage } from "../types";

type BackupPayload = {
    version?: number;
    threads?: ThreadData[];
    messages?: MessageData[];
};

type ChatPayload = {
    format?: string;
    chat?: ThreadData;
    messages?: MessageData[];
};

function messageFromRow(row: MessageData): InteropMessage | null {
    if (row.role === "tool") return null;
    if (row.role !== "user" && row.role !== "assistant" && row.role !== "system") {
        return null;
    }
    const content = String(row.content ?? "").trim();
    if (!content) return null;
    return {
        role: row.role,
        content,
        createdAt: row.createdAt,
    };
}

export function parseAiDiyExport(data: unknown): InteropChat[] {
    if (!data || typeof data !== "object") return [];
    const payload = data as BackupPayload & ChatPayload;
    const chats: InteropChat[] = [];

    if (Array.isArray(payload.threads) && Array.isArray(payload.messages)) {
        const messagesByThread = new Map<string, MessageData[]>();
        for (const message of payload.messages) {
            const list = messagesByThread.get(message.threadId) ?? [];
            list.push(message);
            messagesByThread.set(message.threadId, list);
        }
        for (const thread of payload.threads) {
            const rows = (messagesByThread.get(thread.id) ?? []).sort(
                (a, b) => a.createdAt - b.createdAt,
            );
            const messages = rows
                .map(messageFromRow)
                .filter((m): m is InteropMessage => m !== null);
            if (messages.length === 0 && !thread.title.trim()) continue;
            chats.push({
                title: thread.title.trim() || "Imported Chat",
                createdAt: thread.createdAt,
                updatedAt: thread.updatedAt,
                model: thread.model,
                provider: thread.provider,
                systemPrompt: thread.systemPrompt,
                messages,
            });
        }
        return chats;
    }

    if (payload.format === "ai-diy-chat" && payload.chat) {
        const rows = Array.isArray(payload.messages)
            ? payload.messages.sort((a, b) => a.createdAt - b.createdAt)
            : [];
        const messages = rows
            .map(messageFromRow)
            .filter((m): m is InteropMessage => m !== null);
        chats.push({
            title: payload.chat.title.trim() || "Imported Chat",
            createdAt: payload.chat.createdAt,
            updatedAt: payload.chat.updatedAt,
            model: payload.chat.model,
            provider: payload.chat.provider,
            systemPrompt: payload.chat.systemPrompt,
            messages,
        });
    }

    return chats;
}

export function looksLikeAiDiy(data: unknown): boolean {
    if (!data || typeof data !== "object") return false;
    const payload = data as BackupPayload & ChatPayload;
    if (Array.isArray(payload.threads) && Array.isArray(payload.messages)) {
        return true;
    }
    return payload.format === "ai-diy-chat" && typeof payload.chat === "object";
}
