/**
 * ChatGPT export parser — OpenAI data export `conversations.json`.
 *
 * Format: an array of conversations. Each conversation contains a `mapping`
 * object of message nodes linked by `parent`/`children` ids. Only the chain
 * from the root node to the current (or last) leaf is a real conversation;
 * sibling branches are drafts and are skipped.
 */

import type { ImportSummary, InteropChat, InteropMessage } from "../types";

type ChatGPTNode = {
    id?: string;
    message?: {
        author?: { role?: string };
        create_time?: number | null;
        content?: {
            content_type?: string;
            parts?: unknown[];
            text?: unknown;
        };
        metadata?: {
            model_slug?: string;
        };
    } | null;
    parent?: string | null;
    children?: string[];
};

type ChatGPTConversation = {
    id?: string;
    title?: string;
    create_time?: number | null;
    update_time?: number | null;
    mapping?: Record<string, ChatGPTNode>;
    current_node?: string | null;
};

function messageText(node: ChatGPTNode): string {
    const content = node.message?.content;
    if (!content) return "";
    const parts = Array.isArray(content.parts) ? content.parts : [];
    const textParts = parts
        .map((part) => {
            if (typeof part === "string") return part;
            if (part && typeof part === "object") {
                const sub = (part as { parts?: unknown[] }).parts;
                if (Array.isArray(sub)) {
                    return sub
                        .filter((p): p is string => typeof p === "string")
                        .join("\n");
                }
            }
            return "";
        })
        .filter(Boolean);
    if (textParts.length > 0) return textParts.join("\n");
    if (typeof content.text === "string") return content.text;
    return "";
}

function walkConversation(conversation: ChatGPTConversation): InteropMessage[] {
    const mapping = conversation.mapping ?? {};
    const startId = conversation.current_node ?? null;

    const nodes = Object.values(mapping);
    const parentOf = new Map<string, string | null>();
    const childrenOf = new Map<string, string[]>();
    for (const node of nodes) {
        if (!node.id) continue;
        parentOf.set(node.id, node.parent ?? null);
        childrenOf.set(node.id, node.children ?? []);
    }

    const roots = nodes.filter((n) => !n.parent && n.id);
    if (roots.length === 0) return [];

    let pathIds: string[];
    if (startId && parentOf.has(startId)) {
        pathIds = [];
        let current: string | null = startId;
        while (current && parentOf.has(current)) {
            pathIds.unshift(current);
            current = parentOf.get(current) ?? null;
        }
    } else {
        const root = roots[0];
        const rootId = root.id!;
        pathIds = [rootId];
        let current = rootId;
        while (true) {
            const kids = (childrenOf.get(current) ?? []).filter(
                (kid) => mapping[kid]?.message && !isDraft(mapping[kid]!),
            );
            const next = kids[kids.length - 1];
            if (!next || !mapping[next]?.id) break;
            pathIds.push(next);
            current = next;
        }
    }

    const messages: InteropMessage[] = [];
    for (const id of pathIds) {
        const node = mapping[id];
        if (!node?.message) continue;
        const role = node.message.author?.role;
        const text = messageText(node);
        if (role !== "user" && role !== "assistant" && role !== "system") continue;
        if (!text.trim()) continue;
        const createdAt = typeof node.message.create_time === "number"
            ? node.message.create_time * 1000
            : undefined;
        messages.push({
            role,
            content: text.trim(),
            createdAt,
            model: node.message.metadata?.model_slug,
        });
    }
    return messages;
}

function isDraft(node: ChatGPTNode): boolean {
    const content = node.message?.content;
    if (!content) return true;
    if (Array.isArray(content.parts)) return content.parts.length === 0;
    return !content.text;
}

function toTitle(raw: string | undefined, index: number): string {
    const title = raw?.trim();
    if (title && title !== "New chat" && title !== "Untitled") return title;
    return `ChatGPT Chat ${index + 1}`;
}

export function parseChatGPTConversations(data: unknown): InteropChat[] {
    if (!Array.isArray(data)) return [];
    const chats: InteropChat[] = [];
    data.forEach((entry, index) => {
        const conversation = (entry ?? {}) as ChatGPTConversation;
        const messages = walkConversation(conversation);
        if (messages.length === 0) return;
        chats.push({
            title: toTitle(conversation.title, index),
            createdAt:
                typeof conversation.create_time === "number"
                    ? conversation.create_time * 1000
                    : undefined,
            updatedAt:
                typeof conversation.update_time === "number"
                    ? conversation.update_time * 1000
                    : undefined,
            model: messages.find((m) => m.model)?.model,
            messages,
        });
    });
    return chats;
}

export function looksLikeChatGPT(data: unknown): boolean {
    return (
        Array.isArray(data) &&
        data.length > 0 &&
        typeof data[0] === "object" &&
        data[0] !== null &&
        typeof (data[0] as ChatGPTConversation).mapping === "object"
    );
}
