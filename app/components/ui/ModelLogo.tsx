/**
 * ModelLogo — provider-branded letter badge used for model icons across
 * pickers, hover cards, and usage rows. Deterministic and offline.
 */

import { cn } from "~/lib/utils";
import type { ProviderId } from "~/lib/types";

const BRAND: Record<
    string,
    { letter: string; bg: string; fg: string; label: string }
> = {
    openai: { letter: "O", bg: "#10a37f", fg: "#ffffff", label: "OpenAI" },
    anthropic: { letter: "A", bg: "#d97757", fg: "#ffffff", label: "Anthropic" },
    google: { letter: "G", bg: "#4285f4", fg: "#ffffff", label: "Google" },
    gemini: { letter: "G", bg: "#4285f4", fg: "#ffffff", label: "Gemini" },
    groq: { letter: "G", bg: "#f55036", fg: "#ffffff", label: "Groq" },
    deepseek: { letter: "D", bg: "#4d6bfe", fg: "#ffffff", label: "DeepSeek" },
    "amazon-bedrock": { letter: "B", bg: "#ff9900", fg: "#1a1a1a", label: "Bedrock" },
    bedrock: { letter: "B", bg: "#ff9900", fg: "#1a1a1a", label: "Bedrock" },
    azure: { letter: "A", bg: "#0078d4", fg: "#ffffff", label: "Azure" },
    "google-vertex": { letter: "V", bg: "#4285f4", fg: "#ffffff", label: "Vertex" },
    vertex: { letter: "V", bg: "#4285f4", fg: "#ffffff", label: "Vertex" },
    openrouter: { letter: "O", bg: "#6366f1", fg: "#ffffff", label: "OpenRouter" },
    gateway: { letter: "O", bg: "#6366f1", fg: "#ffffff", label: "Gateway" },
    togetherai: { letter: "T", bg: "#f97316", fg: "#ffffff", label: "Together AI" },
    together: { letter: "T", bg: "#f97316", fg: "#ffffff", label: "Together AI" },
    mistral: { letter: "M", bg: "#fa520f", fg: "#ffffff", label: "Mistral" },
    mistralai: { letter: "M", bg: "#fa520f", fg: "#ffffff", label: "Mistral" },
    huggingface: { letter: "H", bg: "#ffd21e", fg: "#1a1a1a", label: "Hugging Face" },
    lmstudio: { letter: "L", bg: "#8b5cf6", fg: "#ffffff", label: "LM Studio" },
    xai: { letter: "X", bg: "#111111", fg: "#ffffff", label: "xAI" },
    ollama: { letter: "O", bg: "#2563eb", fg: "#ffffff", label: "Ollama" },
    custom: { letter: "C", bg: "#64748b", fg: "#ffffff", label: "Custom" },
};

/** Resolve brand from an app provider + (optionally) a qualified model id. */
export function resolveBrand(
    provider: ProviderId | string,
    modelId?: string,
): { letter: string; bg: string; fg: string; label: string } {
    if (modelId && modelId.includes("/")) {
        const qualifier = modelId.split("/")[0].toLowerCase();
        const direct = BRAND[qualifier];
        if (direct) return direct;
        // e.g. "moonshotai/Kimi-K3" → moonshot
        const fuzzy = Object.entries(BRAND).find(
            ([key]) => key.includes(qualifier) || qualifier.includes(key),
        );
        if (fuzzy) return fuzzy[1];
    }
    return BRAND[provider] ?? { letter: "?", bg: "#64748b", fg: "#ffffff", label: String(provider) };
}

export function ModelLogo({
    provider,
    modelId,
    size = 16,
    className,
}: {
    provider: ProviderId | string;
    modelId?: string;
    size?: number;
    className?: string;
}) {
    const brand = resolveBrand(provider, modelId);
    return (
        <span
            title={brand.label}
            aria-label={brand.label}
            style={{
                backgroundColor: brand.bg,
                color: brand.fg,
                width: size,
                height: size,
                fontSize: Math.max(7, Math.round(size * 0.55)),
                lineHeight: `${size}px`,
            }}
            className={cn(
                "inline-flex shrink-0 select-none items-center justify-center rounded-[5px] font-bold",
                className,
            )}
        >
            {brand.letter}
        </span>
    );
}
