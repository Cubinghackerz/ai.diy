import type { UIMessage } from "ai";
import { getMemoryEntries, saveMemoryEntries } from "~/lib/db";
import type { MemoryEntry } from "~/lib/types";

const STOP_WORDS = new Set(
    "a an and are as at be by for from has have if in into is it its of on or that the their then there these they this to was were will with you your i we our".split(" "),
);

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

function entry(content: string, source: MemoryEntry["source"], sourceId?: string): MemoryEntry | null {
    const text = content.replace(/\s+/g, " ").trim().slice(0, 1600);
    if (text.length < 24) return null;
    if (/(?:api[_ -]?key|access[_ -]?token|secret|password|private[_ -]?key|bearer\s+[a-z0-9._-]{12,})\s*[:=]/i.test(text)) {
        return null;
    }
    const now = Date.now();
    return {
        id: stableId(`${source}:${sourceId ?? ""}:${text}`),
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
    await saveMemoryEntries(entries);
}

export async function buildLocalMemoryContext(query: string): Promise<string> {
    const queryTokens = tokens(query);
    if (queryTokens.length === 0) return "";
    const entries = await getMemoryEntries();
    const ranked = entries
        .map((item) => ({
            item,
            score: item.keywords.reduce(
                (score, keyword) => score + (queryTokens.includes(keyword) ? 1 : 0),
                0,
            ),
        }))
        .filter((value) => value.score > 0)
        .sort((a, b) => b.score - a.score || b.item.updatedAt - a.item.updatedAt)
        .slice(0, 6);
    if (ranked.length === 0) return "";
    return ranked
        .map(({ item }) => `- ${item.content}`)
        .join("\n")
        .slice(0, 4_000);
}

export function importMemoryEntries(payload: unknown): MemoryEntry[] {
    const textValues: string[] = [];
    const walk = (value: unknown, depth = 0) => {
        if (depth > 8 || textValues.length >= 500) return;
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
