/**
 * ModelLogo — provider brand icon. Renders the real brand mark (Simple Icons
 * SVG path, bundled offline) where available, falling back to a brand-colored
 * letter badge for providers without an icon.
 */

import { cn } from "~/lib/utils";
import type { ProviderId } from "~/lib/types";
import { BRAND_LOGO_PATHS } from "~/lib/model-logos";

const BRAND: Record<
    string,
    { logo?: string; letter: string; bg: string; fg: string; label: string }
> = {
    openai: { logo: "openai", letter: "O", bg: "#10a37f", fg: "#ffffff", label: "OpenAI" },
    chatgpt: { logo: "openai", letter: "C", bg: "#10a37f", fg: "#ffffff", label: "ChatGPT" },
    anthropic: { logo: "anthropic", letter: "A", bg: "#d97757", fg: "#ffffff", label: "Anthropic" },
    google: { logo: "google", letter: "G", bg: "#4285f4", fg: "#ffffff", label: "Google" },
    gemini: { logo: "gemini", letter: "G", bg: "#4285f4", fg: "#ffffff", label: "Gemini" },
    groq: { letter: "G", bg: "#f55036", fg: "#ffffff", label: "Groq" },
    deepseek: { logo: "deepseek", letter: "D", bg: "#4d6bfe", fg: "#ffffff", label: "DeepSeek" },
    "amazon-bedrock": { logo: "amazonwebservices", letter: "B", bg: "#ff9900", fg: "#1a1a1a", label: "Bedrock" },
    bedrock: { logo: "amazonwebservices", letter: "B", bg: "#ff9900", fg: "#1a1a1a", label: "Bedrock" },
    azure: { letter: "A", bg: "#0078d4", fg: "#ffffff", label: "Azure" },
    "google-vertex": { logo: "googlecloud", letter: "V", bg: "#4285f4", fg: "#ffffff", label: "Vertex" },
    vertex: { logo: "googlecloud", letter: "V", bg: "#4285f4", fg: "#ffffff", label: "Vertex" },
    openrouter: { logo: "openrouter", letter: "O", bg: "#6366f1", fg: "#ffffff", label: "OpenRouter" },
    gateway: { logo: "openrouter", letter: "O", bg: "#6366f1", fg: "#ffffff", label: "Gateway" },
    togetherai: { letter: "T", bg: "#f97316", fg: "#ffffff", label: "Together AI" },
    together: { letter: "T", bg: "#f97316", fg: "#ffffff", label: "Together AI" },
    mistral: { letter: "M", bg: "#fa520f", fg: "#ffffff", label: "Mistral" },
    mistralai: { letter: "M", bg: "#fa520f", fg: "#ffffff", label: "Mistral" },
    huggingface: { logo: "huggingface", letter: "H", bg: "#ffd21e", fg: "#1a1a1a", label: "Hugging Face" },
    lmstudio: { logo: "lmstudio", letter: "L", bg: "#8b5cf6", fg: "#ffffff", label: "LM Studio" },
    xai: { logo: "x", letter: "X", bg: "#111111", fg: "#ffffff", label: "xAI" },
    ollama: { logo: "ollama", letter: "O", bg: "#2563eb", fg: "#ffffff", label: "Ollama" },
    custom: { letter: "C", bg: "#64748b", fg: "#ffffff", label: "Custom" },
};

/** Resolve brand from an app provider + (optionally) a qualified model id. */
export function resolveBrand(
    provider: ProviderId | string,
    modelId?: string,
): { logo?: string; letter: string; bg: string; fg: string; label: string } {
    if (modelId && modelId.includes("/")) {
        const qualifier = modelId.split("/")[0].toLowerCase();
        const direct = BRAND[qualifier];
        if (direct) return direct;
        // e.g. "moonshotai/Kimi-K3" → moonshot (no icon, letter fallback)
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
    const path = brand.logo ? BRAND_LOGO_PATHS[brand.logo] : undefined;

    if (path) {
        return (
            <svg
                role="img"
                aria-label={brand.label}
                viewBox="0 0 24 24"
                width={size}
                height={size}
                fill={brand.bg}
                className={cn(
                    "inline-block shrink-0 select-none",
                    className,
                )}
            >
                <title>{brand.label}</title>
                <path d={path} />
            </svg>
        );
    }

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
