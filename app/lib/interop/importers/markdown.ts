/**
 * Markdown chat parser — round-trips ai.diy's Markdown export and accepts
 * common variants.
 *
 * Format: optional YAML-ish frontmatter (`---` delimited: title, created,
 * model, provider), then messages as `## User` / `## Assistant` / `## System`
 * headings followed by the message body. The `**User:**` bold-label variant
 * is also accepted.
 */

import type { InteropChat, InteropMessage } from "../types";

function parseFrontmatter(text: string): {
    rest: string;
    meta: Record<string, string>;
} {
    const meta: Record<string, string> = {};
    if (!text.startsWith("---")) return { rest: text, meta };
    const end = text.indexOf("\n---", 3);
    if (end === -1) return { rest: text, meta };
    const block = text.slice(3, end);
    for (const line of block.split("\n")) {
        const colon = line.indexOf(":");
        if (colon === -1) continue;
        const key = line.slice(0, colon).trim().toLowerCase();
        const value = line.slice(colon + 1).trim().replace(/^["']|["']$/g, "");
        if (key) meta[key] = value;
    }
    return { rest: text.slice(end + 4), meta };
}

function splitSections(rest: string): Array<{ role: InteropMessage["role"]; body: string }> {
    const sections: Array<{ role: InteropMessage["role"]; body: string }> = [];
    const lines = rest.split("\n");
    let currentRole: InteropMessage["role"] | null = null;
    let buffer: string[] = [];

    const flush = () => {
        if (currentRole) {
            const body = buffer.join("\n").trim();
            if (body) sections.push({ role: currentRole, body });
        }
        buffer = [];
    };

    const headingRe = /^#{1,4}\s+(user|assistant|system)\s*$/i;
    const boldRe = /^\*\*(user|assistant|system)\s*:\*\*\s*$/i;

    for (const line of lines) {
        const heading = line.match(headingRe);
        const bold = line.match(boldRe);
        if (heading) {
            flush();
            currentRole = heading[1].toLowerCase() as InteropMessage["role"];
            continue;
        }
        if (bold) {
            flush();
            currentRole = bold[1].toLowerCase() as InteropMessage["role"];
            continue;
        }
        if (currentRole) buffer.push(line);
    }
    flush();
    return sections;
}

export function parseMarkdownChat(text: string, titleFromFile?: string): InteropChat | null {
    const { rest, meta } = parseFrontmatter(text);
    const sections = splitSections(rest);
    if (sections.length === 0) return null;

    const messages: InteropMessage[] = sections.map((section) => ({
        role: section.role,
        content: section.body,
    }));
    const created = meta.created ? Date.parse(meta.created) : undefined;

    return {
        title: meta.title?.trim() || titleFromFile?.replace(/\.md$/i, "").trim() || "Imported Chat",
        createdAt: Number.isNaN(created as number) ? undefined : created,
        model: meta.model || undefined,
        provider: meta.provider || undefined,
        messages,
    };
}

export function looksLikeMarkdown(text: string): boolean {
    return /(^|\n)#{1,4}\s+(user|assistant|system)\s*$/im.test(text) ||
        /(^|\n)\*\*(user|assistant|system)\s*:\*\*/im.test(text);
}
