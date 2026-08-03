/**
 * Import/Export Interop — shared types for chat import & export formats.
 *
 * Parsed chats are intentionally plain: role/content/timestamps/model. This
 * keeps foreign formats (ChatGPT, Claude, ShareGPT, Markdown) representable
 * and makes the import path robust to schema drift in the source apps.
 */

export type InteropRole = "user" | "assistant" | "system";

export interface InteropMessage {
    role: InteropRole;
    content: string;
    createdAt?: number;
    model?: string;
}

export interface InteropChat {
    title: string;
    createdAt?: number;
    updatedAt?: number;
    model?: string;
    provider?: string;
    systemPrompt?: string;
    messages: InteropMessage[];
}

export type ImportFormat =
    | "chatgpt"
    | "claude"
    | "ai-diy"
    | "sharegpt"
    | "markdown";

export const IMPORT_FORMAT_LABELS: Record<ImportFormat, string> = {
    chatgpt: "ChatGPT export",
    claude: "Claude export",
    "ai-diy": "ai.diy backup",
    sharegpt: "ShareGPT / JSONL chat",
    markdown: "Markdown chat",
};

export interface ImportSummary {
    format: ImportFormat | null;
    formatLabel: string;
    chats: InteropChat[];
    /** Messages skipped for unsupported roles or empty content. */
    skippedMessages: number;
    /** Non-fatal notes to surface in the preview (e.g. unsupported parts). */
    notes: string[];
}
