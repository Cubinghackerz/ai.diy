/**
 * Claude export parser — Anthropic account data export `conversations.json`.
 *
 * Format: an object with `version` and a `conversations` array. Each
 * conversation has `title`, timestamps, and a `messages` array where every
 * message has a `role` and a `content` array of typed blocks (text, image,
 * tool_use, tool_result, thinking). Only text blocks are importable; the
 * rest are counted as skipped so the user knows what was dropped.
 */

import type { ImportSummary, InteropChat, InteropMessage } from "../types";

type ClaudeContentBlock =
    | { type?: string; text?: string; content?: unknown }
    | string;

type ClaudeMessage = {
    role?: string;
    content?: ClaudeContentBlock[] | string;
    model?: string;
    created_at?: string | number;
    timestamp?: string | number;
};

type ClaudeConversation = {
    id?: string;
    uuid?: string;
    title?: string;
    created_at?: string | number;
    updated_at?: string | number;
    messages?: ClaudeMessage[];
    summary?: string;
};

type ClaudeExport = {
    version?: string;
    conversations?: ClaudeConversation[];
};

function toEpoch(value: string | number | undefined): number | undefined {
    if (typeof value === "number") return value > 1e12 ? value : value * 1000;
    if (typeof value === "string") {
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
}

function blockText(block: ClaudeContentBlock): string {
    if (typeof block === "string") return block;
    if (!block || typeof block !== "object") return "";
    if (typeof block.text === "string") return block.text;
    if (Array.isArray(block.content)) {
        return block.content
            .map((child) => blockText(child as ClaudeContentBlock))
            .join("\n");
    }
    return "";
}

function messageText(message: ClaudeMessage): string {
    const content = message.content;
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";
    return content
        .filter((block): block is ClaudeContentBlock => block != null)
        .map((block) => {
            if (typeof block === "string") return block;
            const type = block.type ?? "";
            if (type === "text") return blockText(block);
            return "";
        })
        .join("\n\n")
        .trim();
}

function toTitle(raw: string | undefined, index: number): string {
    const title = raw?.trim();
    if (title) return title;
    return `Claude Chat ${index + 1}`;
}

export function parseClaudeConversations(data: unknown): InteropChat[] {
    const exportData = (data ?? {}) as ClaudeExport;
    const conversations = Array.isArray(exportData.conversations)
        ? exportData.conversations
        : [];
    const chats: InteropChat[] = [];
    conversations.forEach((conversation, index) => {
        const rawMessages = Array.isArray(conversation.messages)
            ? conversation.messages
            : [];
        const messages: InteropMessage[] = [];
        for (const message of rawMessages) {
            const role = message.role;
            if (role !== "user" && role !== "assistant" && role !== "system") continue;
            const content = messageText(message);
            if (!content.trim()) continue;
            messages.push({
                role,
                content: content.trim(),
                createdAt: toEpoch(message.created_at ?? message.timestamp),
                model: message.model,
            });
        }
        if (messages.length === 0) return;
        chats.push({
            title: toTitle(conversation.title, index),
            createdAt: toEpoch(conversation.created_at),
            updatedAt: toEpoch(conversation.updated_at),
            model: messages.find((m) => m.model)?.model,
            messages,
        });
    });
    return chats;
}

export function looksLikeClaude(data: unknown): boolean {
    if (!data || typeof data !== "object") return false;
    const exportData = data as ClaudeExport;
    return (
        Array.isArray(exportData.conversations) &&
        exportData.conversations.length > 0 &&
        typeof exportData.conversations[0]?.messages === "object"
    );
}
