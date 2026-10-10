/**
 * Helpers for ChatGPT subscription model discovery and preference ordering.
 *
 * Live account slugs are the source of truth. Ranking is version-aware so a
 * newly returned GPT-6 (or later) series outranks older flagships without a
 * catalog edit. Named variants only break ties inside the same version.
 */

import { enrichModelInfo } from "~/lib/model-capabilities";
import type { ModelInfo } from "~/lib/types";

/**
 * The model used until the account's live catalog says what it can run. It is
 * the long-standing default that every ChatGPT plan (including Free and Go) has
 * had; a newer id taken from the bundled fallback list could be one the signed-in
 * account is not entitled to.
 */
export const CHATGPT_SAFE_DEFAULT = "gpt-5.6-luna";

/** Previous auto-selected default. Upgrade only this id when a newer series appears. */
export const CHATGPT_STALE_DEFAULTS = [CHATGPT_SAFE_DEFAULT] as const;

const VARIANT_RANK: Array<[RegExp, number]> = [
    [/(?:^|-)astra$/, -1],
    [/(?:^|-)(?:luna|sol|terra)$/, 0],
    [/(?:^|-)pro$/, 1],
    [/(?:^|-)(?:mini|nano)$/, 4],
];

type GptSeries = { major: number; minor: number };

function gptSeries(slug: string): GptSeries | null {
    const match = slug.toLowerCase().match(/(?:^|[/:\s])gpt-(\d+)(?:\.(\d+))?/);
    if (!match) return null;
    return { major: Number(match[1]), minor: Number(match[2] ?? 0) };
}

function variantRank(slug: string): number {
    const lower = slug.toLowerCase();
    const series = gptSeries(lower);
    if (!series) return 50;
    const suffix = lower.replace(/^.*gpt-\d+(?:\.\d+)?/, "");
    if (!suffix || suffix === "") return 2;
    for (const [pattern, rank] of VARIANT_RANK) {
        if (pattern.test(suffix)) return rank;
    }
    return 3;
}

/** Higher GPT major/minor first; codenames only break ties. Non-GPT ids sort after. */
export function compareChatGPTSlugs(a: string, b: string): number {
    const left = gptSeries(a);
    const right = gptSeries(b);
    if (left && !right) return -1;
    if (!left && right) return 1;
    if (left && right) {
        if (left.major !== right.major) return right.major - left.major;
        if (left.minor !== right.minor) return right.minor - left.minor;
        const variant = variantRank(a) - variantRank(b);
        if (variant !== 0) return variant;
    }
    return b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" });
}

/** Sort account-discovered model slugs with the newest GPT series first. */
export function sortChatGPTModelSlugs(slugs: string[]): string[] {
    return [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))].sort(compareChatGPTSlugs);
}

export function formatChatGPTModelName(slug: string): string {
    const id = slug.trim();
    const match = id.match(/^gpt-(\d+(?:\.\d+)?)(?:-(.+))?$/i);
    if (!match) return id;
    const variant = match[2]
        ? ` ${match[2].replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())}`
        : "";
    return `GPT-${match[1]}${variant}`;
}

export function chatgptModelsFromSlugs(slugs: string[]): ModelInfo[] {
    return sortChatGPTModelSlugs(slugs).map((id) =>
        enrichModelInfo({
            id,
            name: formatChatGPTModelName(id),
            provider: "chatgpt",
            supportsTools: !/image|tts|whisper|embedding|dall/i.test(id),
            supportsVision: !/tts|whisper|embedding/i.test(id),
            supportsStreaming: true,
            supportsReasoning: !/image|tts|whisper|embedding|dall/i.test(id),
            ...(/image/i.test(id) ? { supportsImageGeneration: true } : {}),
        }),
    );
}

/** Pick the newest usable chat model (skip dedicated image/tts ids when possible). */
export function pickLatestChatGPTModel(slugs: string[]): string | undefined {
    const sorted = sortChatGPTModelSlugs(slugs);
    const chat = sorted.find((id) => !/image|tts|whisper|embedding|dall/i.test(id));
    return chat ?? sorted[0];
}

/**
 * Keep an explicit user pick. Replace a missing id, or the previous auto
 * default, when the account catalog now includes a newer GPT series.
 */
export function preferDiscoveredChatGPTModel(
    current: string | undefined,
    slugs: string[],
): string | undefined {
    const latest = pickLatestChatGPTModel(slugs);
    if (!latest) return current;
    const selected = current?.trim() ?? "";
    if (!selected) return latest;
    if (!slugs.some((slug) => slug === selected)) return latest;
    const stale = (CHATGPT_STALE_DEFAULTS as readonly string[]).includes(selected);
    if (!stale) return selected;
    const selectedSeries = gptSeries(selected);
    const latestSeries = gptSeries(latest);
    if (
        selectedSeries &&
        latestSeries &&
        (latestSeries.major > selectedSeries.major ||
            (latestSeries.major === selectedSeries.major &&
                latestSeries.minor > selectedSeries.minor))
    ) {
        return latest;
    }
    return selected;
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
