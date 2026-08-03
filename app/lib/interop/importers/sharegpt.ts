/**
 * ShareGPT / OpenAI JSONL chat parser.
 *
 * Each line is one message: `{"from": "human"|"gpt"|"system", "value": "..."}`
 * (ShareGPT convention) or `{"role": "user"|"assistant"|"system", "content":
 * "..."}` (OpenAI chat format). A JSON array of such objects is also accepted.
 */

import type { InteropChat, InteropMessage } from "../types";

function roleFor(role: unknown): InteropMessage["role"] | null {
    const value = String(role ?? "").toLowerCase();
    if (value === "human" || value === "user") return "user";
    if (value === "gpt" || value === "assistant" || value === "ai") {
        return "assistant";
    }
    if (value === "system") return "system";
    return null;
}

function messageFromRecord(record: Record<string, unknown>): InteropMessage | null {
    const role = roleFor(record.from ?? record.role ?? record.author);
    if (!role) return null;
    const raw =
        typeof record.value === "string"
            ? record.value
            : typeof record.content === "string"
              ? record.content
              : typeof record.text === "string"
                ? record.text
                : "";
    const content = raw.trim();
    if (!content) return null;
    return { role, content };
}

export function parseShareGPT(data: unknown, notes: string[]): InteropChat[] {
    let records: Record<string, unknown>[] = [];
    if (Array.isArray(data)) {
        records = data.filter(
            (entry): entry is Record<string, unknown> =>
                Boolean(entry && typeof entry === "object"),
        );
    } else if (typeof data === "string") {
        for (const line of data.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
                const parsed = JSON.parse(trimmed) as unknown;
                if (parsed && typeof parsed === "object") {
                    records.push(parsed as Record<string, unknown>);
                }
            } catch {
                notes.push("Skipped a line that was not valid JSON.");
            }
        }
    }

    const messages: InteropMessage[] = [];
    for (const record of records) {
        const message = messageFromRecord(record);
        if (message) messages.push(message);
    }
    if (messages.length === 0) return [];
    return [
        {
            title: "Imported Chat",
            messages,
        },
    ];
}

export function looksLikeShareGPT(data: unknown): boolean {
    const records = Array.isArray(data)
        ? data
        : typeof data === "string"
          ? data
                .split("\n")
                .map((line) => {
                    try {
                        return JSON.parse(line.trim()) as unknown;
                    } catch {
                        return null;
                    }
                })
                .filter(Boolean)
          : [];
    if (records.length === 0) return false;
    const first = records[0] as Record<string, unknown>;
    return (
        typeof first === "object" &&
        (("from" in first && "value" in first) ||
            ("role" in first && "content" in first))
    );
}
