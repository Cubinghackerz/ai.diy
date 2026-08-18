/**
 * Helpers for ChatGPT subscription model discovery and preference ordering.
 */

import { enrichModelInfo } from "~/lib/model-capabilities";
import type { ModelInfo } from "~/lib/types";

/** Prefer newer Codex / ChatGPT flagships when ranking discovered slugs. */
const PREFERRED_ORDER = [
    "gpt-5.6-luna",
    "gpt-5.6",
    "gpt-5.6-sol",
    "gpt-5.6-terra",
    "gpt-5.5",
    "gpt-5.5-pro",
    "gpt-5.4",
    "gpt-5.4-mini",
    "gpt-5.3-codex",
    "gpt-5.3-codex-spark",
    "gpt-5.2",
    "gpt-5.1",
    "gpt-5-codex",
    "gpt-5",
    "gpt-5-mini",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4o",
    "gpt-4o-mini",
    "o4-mini",
    "o3",
    "o3-mini",
] as const;

function preferenceRank(slug: string): number {
    const lower = slug.toLowerCase();
    const idx = PREFERRED_ORDER.findIndex(
        (id) => lower === id || lower.startsWith(`${id}-`) || lower.includes(id),
    );
    return idx === -1 ? 1_000 : idx;
}

/** Sort account-discovered model slugs with latest preferred first. */
export function sortChatGPTModelSlugs(slugs: string[]): string[] {
    return [...new Set(slugs.map((s) => s.trim()).filter(Boolean))].sort(
        (a, b) =>
            preferenceRank(a) - preferenceRank(b) ||
            b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" }),
    );
}

export function chatgptModelsFromSlugs(slugs: string[]): ModelInfo[] {
    return sortChatGPTModelSlugs(slugs).map((id) =>
        enrichModelInfo({
            id,
            name: id,
            provider: "chatgpt",
            supportsTools: true,
            supportsVision: true,
            supportsStreaming: true,
            supportsReasoning: /gpt-5|o[1-5]|reason|codex/i.test(id),
            ...( /image/i.test(id) ? { supportsImageGeneration: true } : {}),
        }),
    );
}

/** Pick the newest usable chat model (skip dedicated image/tts ids when possible). */
export function pickLatestChatGPTModel(slugs: string[]): string | undefined {
    const sorted = sortChatGPTModelSlugs(slugs);
    const chat = sorted.find(
        (id) => !/image|tts|whisper|embedding|dall/i.test(id),
    );
    return chat ?? sorted[0];
}

export function formatChatGPTReset(resetsInSeconds?: number | null): string | null {
    if (typeof resetsInSeconds !== "number" || !Number.isFinite(resetsInSeconds)) {
        return null;
    }
    const seconds = Math.max(0, Math.round(resetsInSeconds));
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`;
    if (seconds < 86_400) return `${Math.ceil(seconds / 3600)}h`;
    return `${Math.ceil(seconds / 86_400)}d`;
}
