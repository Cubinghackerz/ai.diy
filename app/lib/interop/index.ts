/**
 * Import format detection & parsing entry point.
 *
 * Accepts plain JSON/JSONL/Markdown files and ChatGPT/Claude account-export
 * ZIP archives (which both contain a `conversations.json`). Format detection
 * inspects file content rather than trusting extensions.
 */

import { unzipSync } from "fflate";
import { looksLikeAiDiy, parseAiDiyExport } from "./importers/ai-diy";
import { looksLikeChatGPT, parseChatGPTConversations } from "./importers/chatgpt";
import { looksLikeClaude, parseClaudeConversations } from "./importers/claude";
import { looksLikeMarkdown, parseMarkdownChat } from "./importers/markdown";
import { looksLikeShareGPT, parseShareGPT } from "./importers/sharegpt";
import type { ImportFormat, ImportSummary } from "./types";
import { IMPORT_FORMAT_LABELS } from "./types";

const MAX_FILE_BYTES = 100 * 1024 * 1024;

function decodeUtf8(bytes: Uint8Array): string {
    try {
        return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    } catch {
        return "";
    }
}

function summary(
    format: ImportFormat,
    chats: ImportSummary["chats"],
    notes: string[] = [],
): ImportSummary {
    let skippedMessages = 0;
    // Only count notes about skipped content; parser-level skips are counted
    // by parsers that report them through notes.
    return {
        format,
        formatLabel: IMPORT_FORMAT_LABELS[format],
        chats,
        skippedMessages,
        notes,
    };
}

function parseJsonPayload(
    data: unknown,
    filename: string,
    notes: string[],
): ImportSummary | null {
    if (looksLikeChatGPT(data)) {
        return summary("chatgpt", parseChatGPTConversations(data), notes);
    }
    if (looksLikeClaude(data)) {
        return summary("claude", parseClaudeConversations(data), notes);
    }
    if (looksLikeAiDiy(data)) {
        return summary("ai-diy", parseAiDiyExport(data), notes);
    }
    if (looksLikeShareGPT(data)) {
        return summary("sharegpt", parseShareGPT(data, notes), notes);
    }
    // A bare array of {role, content} objects is treated as ShareGPT-style.
    if (Array.isArray(data)) {
        const records = data.filter((entry): entry is Record<string, unknown> =>
            Boolean(entry && typeof entry === "object"),
        );
        if (records.length > 0) {
            const chats = parseShareGPT(data, notes);
            if (chats.length > 0) return summary("sharegpt", chats, notes);
        }
    }
    void filename;
    return null;
}

export async function detectAndParseFile(file: File): Promise<ImportSummary> {
    const notes: string[] = [];
    const name = file.name.toLowerCase();

    if (file.size > MAX_FILE_BYTES) {
        throw new Error("File is larger than the 100 MiB import limit.");
    }

    // ─── ZIP archives (ChatGPT / Claude account exports) ─────────────
    if (name.endsWith(".zip")) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let entries: Record<string, Uint8Array>;
        try {
            entries = unzipSync(bytes);
        } catch {
            throw new Error("Could not read the ZIP archive. Try the conversations.json file inside it.");
        }
        const conversationsEntry = Object.keys(entries).find(
            (entry) => entry.toLowerCase().endsWith("conversations.json"),
        );
        if (!conversationsEntry) {
            throw new Error("This ZIP does not contain a conversations.json export.");
        }
        const text = decodeUtf8(entries[conversationsEntry]);
        let data: unknown;
        try {
            data = JSON.parse(text) as unknown;
        } catch {
            throw new Error("conversations.json inside the ZIP is not valid JSON.");
        }
        const parsed = parseJsonPayload(data, conversationsEntry, notes);
        if (!parsed) {
            throw new Error("conversations.json was not recognized as ChatGPT, Claude, or ai.diy data.");
        }
        return parsed;
    }

    // ─── Plain text files ────────────────────────────────────────────
    const text = await file.text();

    if (name.endsWith(".md") || looksLikeMarkdown(text)) {
        const chat = parseMarkdownChat(text, file.name);
        if (!chat) {
            throw new Error(
                "No messages found in the Markdown file. Use ## User / ## Assistant headings.",
            );
        }
        return summary("markdown", [chat]);
    }

    if (name.endsWith(".jsonl")) {
        const chats = parseShareGPT(text, notes);
        if (chats.length === 0) {
            throw new Error("No ShareGPT/JSONL messages found in the file.");
        }
        return summary("sharegpt", chats, notes);
    }

    // ─── JSON files ───────────────────────────────────────────────────
    let data: unknown;
    try {
        data = JSON.parse(text) as unknown;
    } catch {
        throw new Error(
            "The file is neither JSON, JSONL, nor Markdown. Supported imports: ChatGPT ZIP, Claude ZIP, ai.diy backup JSON, ShareGPT JSONL, Markdown.",
        );
    }
    const parsed = parseJsonPayload(data, file.name, notes);
    if (!parsed) {
        throw new Error(
            "The JSON file was not recognized. Supported imports: ChatGPT conversations.json, Claude conversations.json, ai.diy backup or chat JSON, ShareGPT chat JSON.",
        );
    }
    return parsed;
}
