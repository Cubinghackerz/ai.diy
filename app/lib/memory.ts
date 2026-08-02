import type { UIMessage } from "ai";
import { getMemoryEntries, saveMemoryEntries } from "~/lib/db";
import type { MemoryEntry } from "~/lib/types";

const STOP_WORDS = new Set(
    "a an and are as at be by for from has have if in into is it its of on or that the their then there these they this to was were will with you your i we our".split(" "),
);

const MAX_MEMORY_ENTRIES = 500;
const MAX_CONTEXT_ENTRIES = 6;
const MAX_CONTEXT_CHARS = 4_000;
const SECRET_PATTERNS = [
    /(?:api[_ -]?key|access[_ -]?token|secret|password|private[_ -]?key|bearer\s+[a-z0-9._-]{12,})\s*[:=]/i,
    /(?:sk-[a-z0-9]{16,}|sk-ant-[a-z0-9_-]{16,}|gsk_[a-z0-9_-]{16,}|xai-[a-z0-9_-]{16,}|hf_[a-z0-9_-]{12,}|gh[pousr]_[a-z0-9_-]{16,})/i,
    /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/i,
];

function tokens(value: string): string[] {
    return [...new Set(
        value
            .toLowerCase()
            .match(/[a-z0-9][a-z0-9_-]{1,}/g)
            ?.filter((word) => !STOP_WORDS.has(word)) ?? [],
    )].slice(0, 30);
}

function stableId(value: string): string {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return `memory_${(hash >>> 0).toString(36)}`;
}

function containsSecret(value: string): boolean {
    return SECRET_PATTERNS.some((pattern) => pattern.test(value));
}

function entry(content: string, source: MemoryEntry["source"], sourceId?: string): MemoryEntry | null {
    const text = content.replace(/\s+/g, " ").trim().slice(0, 1600);
    if (text.length < 24) return null;
    if (containsSecret(text)) {
        return null;
    }
    const now = Date.now();
    return {
        id: stableId(`${source}:${text}`),
        content: text,
        source,
        sourceId,
        keywords: tokens(text),
        createdAt: now,
        updatedAt: now,
    };
}

export async function indexChatMemories(messages: UIMessage[]): Promise<void> {
    const entries = messages
        .filter((message) => message.role === "user")
        .map((message) =>
            entry(
                message.parts
                    .filter((part) => part.type === "text")
                    .map((part) => part.text)
                    .join(" "),
                "chat",
                message.id,
            ),
        )
        .filter((value): value is MemoryEntry => Boolean(value));
    try {
        await saveMemoryEntries(entries);
    } catch {
        // Memory is an enhancement. Storage failures must never break chat.
        console.warn("Local memory could not be saved.");
    }
}

/**
 * Build provider-neutral context for every request. The model should not need
 * to discover or call a tool before it can use approved local memory.
 */
export async function buildLocalMemoryContext(): Promise<string> {
    try {
        const entries = await getMemoryEntries();
        if (entries.length === 0) return "";
        return formatMemoryEntries(entries.slice(0, MAX_CONTEXT_ENTRIES));
    } catch {
        // A blocked or unavailable IndexedDB must fail open to normal chat.
        return "";
    }
}

export async function hasLocalMemoryEntries(): Promise<boolean> {
    try {
        const entries = await getMemoryEntries();
        return entries.length > 0;
    } catch {
        return false;
    }
}

export async function readLocalMemory(query?: string): Promise<string> {
    try {
        const entries = await getMemoryEntries();
        if (entries.length === 0) return "No local memory is stored.";
        const selected = selectMemoryEntries(entries, query, false);
        if (selected.length === 0) return "No relevant local memory matched that query.";
        return formatMemoryEntries(selected);
    } catch {
        return "Local memory is unavailable in this browser session.";
    }
}

function selectMemoryEntries(
    entries: MemoryEntry[],
    query: string | undefined,
    fallbackToRecent: boolean,
): MemoryEntry[] {
    const queryTokens = tokens(query ?? "");
    const ranked = queryTokens.length
        ? entries
              .map((item) => ({
                  item,
                  score: item.keywords.reduce(
                      (score, keyword) => score + (queryTokens.includes(keyword) ? 1 : 0),
                      0,
                  ),
              }))
              .filter((value) => value.score > 0)
              .sort((a, b) => b.score - a.score || b.item.updatedAt - a.item.updatedAt)
              .slice(0, MAX_CONTEXT_ENTRIES)
              .map(({ item }) => item)
        : [];
    if (ranked.length > 0) return ranked;
    return fallbackToRecent ? entries.slice(0, 3) : [];
}

function formatMemoryEntries(entries: MemoryEntry[]): string {
    return entries
        .map((item) => `- ${item.content}`)
        .join("\n")
        .slice(0, MAX_CONTEXT_CHARS);
}

export function importMemoryEntries(payload: unknown): MemoryEntry[] {
    const textValues: string[] = [];
    const walk = (value: unknown, depth = 0) => {
        if (depth > 8 || textValues.length >= MAX_MEMORY_ENTRIES) return;
        if (typeof value === "string") {
            if (value.trim().length >= 24) textValues.push(value);
            return;
        }
        if (Array.isArray(value)) {
            value.forEach((item) => walk(item, depth + 1));
            return;
        }
        if (value && typeof value === "object") {
            Object.values(value).forEach((item) => walk(item, depth + 1));
        }
    };
    walk(payload);
    return textValues
        .map((content, index) => entry(content, "import", `import_${index}`))
        .filter((value): value is MemoryEntry => Boolean(value));
}

export const UNIVERSAL_MEMORY_EXPORT_PROMPT = `Create a portable personal-memory export for a local AI assistant. Return JSON only with this shape: {"version":1,"memories":[{"content":"concise durable fact, preference, project context, or instruction"}]}. Include only information I explicitly shared that is useful in future chats. Exclude passwords, API keys, financial/account identifiers, private third-party information, and raw chat transcripts. Keep each memory under 500 characters and keep the total below 100 entries.`;
