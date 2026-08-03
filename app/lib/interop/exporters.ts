/**
 * Chat exporters — per-chat Markdown, per-chat ai.diy JSON, and a ZIP bundle
 * of every chat as Markdown. The Markdown format is the documented round-trip
 * format parsed by `importers/markdown.ts`.
 */

import { zipSync } from "fflate";
import type { ThreadData, MessageData } from "~/lib/types";

export interface ExportChat {
    thread: ThreadData;
    messages: MessageData[];
}

function roleLabel(role: MessageData["role"]): string {
    if (role === "user") return "User";
    if (role === "system") return "System";
    return "Assistant";
}

function escapeFrontmatter(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function chatToMarkdown(chat: ExportChat): string {
    const { thread, messages } = chat;
    const sorted = [...messages].sort((a, b) => a.createdAt - b.createdAt);
    const lines: string[] = [];
    lines.push("---");
    lines.push(`title: "${escapeFrontmatter(thread.title)}"`);
    if (thread.createdAt) lines.push(`created: ${new Date(thread.createdAt).toISOString()}`);
    if (thread.model) lines.push(`model: ${escapeFrontmatter(thread.model)}`);
    if (thread.provider) lines.push(`provider: ${escapeFrontmatter(thread.provider)}`);
    lines.push("---");
    lines.push(`# ${thread.title}`);
    lines.push("");
    for (const message of sorted) {
        if (message.role === "tool") continue;
        const content = String(message.content ?? "").trim();
        if (!content) continue;
        lines.push(`## ${roleLabel(message.role)}`);
        lines.push("");
        lines.push(content);
        lines.push("");
    }
    return lines.join("\n").trimEnd() + "\n";
}

export function chatToAiDiyJson(chat: ExportChat): string {
    const { thread, messages } = chat;
    const sorted = [...messages].sort((a, b) => a.createdAt - b.createdAt);
    return JSON.stringify(
        {
            format: "ai-diy-chat",
            version: 1,
            exportedAt: new Date().toISOString(),
            chat: {
                id: thread.id,
                title: thread.title,
                createdAt: thread.createdAt,
                updatedAt: thread.updatedAt,
                systemPrompt: thread.systemPrompt,
                model: thread.model,
                provider: thread.provider,
            },
            messages: sorted.map((message) => ({
                id: message.id,
                role: message.role,
                content: message.content,
                createdAt: message.createdAt,
                toolCalls: message.toolCalls,
                toolResults: message.toolResults,
            })),
        },
        null,
        2,
    );
}

export function safeFilename(title: string): string {
    const cleaned = title
        .trim()
        .replace(/[\\/:*?"<>|]/g, "-")
        .replace(/\s+/g, " ")
        .replace(/^\.+/, "")
        .replace(/(^[-.]+|[-.]+$)/g, "")
        .slice(0, 80);
    return cleaned || "chat";
}

export function chatMarkdownFilename(chat: ExportChat): string {
    return `${safeFilename(chat.thread.title)}.md`;
}

function encodeText(text: string): Uint8Array {
    return new TextEncoder().encode(text);
}

/** ZIP archive of one Markdown file per chat, named by chat title. */
export function markdownBundleZip(chats: ExportChat[]): Uint8Array<ArrayBuffer> {
    const files: Record<string, Uint8Array> = {};
    const usedNames = new Set<string>();
    for (const chat of chats) {
        let filename = chatMarkdownFilename(chat);
        if (usedNames.has(filename)) {
            const base = filename.replace(/\.md$/i, "");
            let suffix = 2;
            while (usedNames.has(`${base}-${suffix}.md`)) suffix += 1;
            filename = `${base}-${suffix}.md`;
        }
        usedNames.add(filename);
        files[filename] = encodeText(chatToMarkdown(chat));
    }
    const zipped = zipSync(files, { level: 6 });
    const bytes = new Uint8Array(zipped.byteLength);
    bytes.set(zipped);
    return bytes;
}

/** Trigger a browser download for a text blob. */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
    downloadBlob(new Blob([content], { type: mimeType }), filename);
}
