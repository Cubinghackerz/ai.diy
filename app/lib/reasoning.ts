/**
 * Reasoning / thinking effort — detect support and map to provider options.
 */

import { DEFAULT_MODELS, type ProviderId, type ReasoningEffort } from "~/lib/types";
import type { SharedV4ProviderOptions } from "@ai-sdk/provider";

export type { ReasoningEffort };

export type ReasoningEffortOption = {
    id: ReasoningEffort;
    label: string;
    /** When true the model is forced to think (e.g. OpenAI "none" = disabled). */
    disabled?: boolean;
};

/** Full canonical list of reasoning effort values known to this app. */
export const REASONING_EFFORT_OPTIONS: ReasoningEffortOption[] = [
    { id: "off", label: "Think off" },
    { id: "minimal", label: "Think minimal" },
    { id: "low", label: "Think low" },
    { id: "medium", label: "Think med" },
    { id: "high", label: "Think high" },
];

/**
 * The discrete effort values a given provider/model actually accepts.
 * Different vendors expose different knobs:
 *  - OpenAI / OpenRouter / Groq / ollama / custom (openai-compatible):
 *    `reasoning_effort` ∈ minimal | low | medium | high | (none disables)
 *  - xAI (Grok): `reasoning_effort` ∈ none | low | medium | high
 *  - Google (Gemini): `thinkingConfig.thinkingLevel` ∈ minimal | low | medium | high
 *  - Anthropic (Claude): enabled/disabled + a numeric thinking budget
 */
const OPENAI_EFFORTS: ReasoningEffort[] = ["minimal", "low", "medium", "high"];
const XAI_EFFORTS: ReasoningEffort[] = ["off", "low", "medium", "high"];
const GEMINI_EFFORTS: ReasoningEffort[] = ["off", "minimal", "low", "medium", "high"];
const ANTHROPIC_EFFORTS: ReasoningEffort[] = ["off", "low", "medium", "high"];
const OLLAMA_EFFORTS: ReasoningEffort[] = ["off", "low", "medium", "high"];
const DEEPSEEK_EFFORTS: ReasoningEffort[] = ["off", "low", "medium", "high"];
const BEDROCK_EFFORTS: ReasoningEffort[] = ["off", "low", "medium", "high"];
const MISTRAL_EFFORTS: ReasoningEffort[] = ["off", "high"];
/** Providers that expose no reasoning-effort knob via providerOptions. */
const NO_EFFORT_PROVIDERS: ProviderId[] = [
    "vertex",
    "azure",
    "togetherai",
    "gateway",
    "huggingface",
];

export function getReasoningEffortOptions(
    provider: ProviderId,
    modelId: string,
): ReasoningEffortOption[] {
    if (!modelSupportsReasoning(provider, modelId)) return [];
    let ids: ReasoningEffort[];
    switch (provider) {
        case "openai":
        case "openrouter":
        case "groq":
        case "lmstudio":
            ids = OPENAI_EFFORTS;
            break;
        case "xai":
            ids = XAI_EFFORTS;
            break;
        case "gemini":
            ids = GEMINI_EFFORTS;
            break;
        case "anthropic":
            ids = ANTHROPIC_EFFORTS;
            break;
        case "ollama":
        case "custom":
            ids = OLLAMA_EFFORTS;
            break;
        case "deepseek":
            ids = DEEPSEEK_EFFORTS;
            break;
        case "bedrock":
            ids = BEDROCK_EFFORTS;
            break;
        case "mistral":
            ids = MISTRAL_EFFORTS;
            break;
        default:
            if (NO_EFFORT_PROVIDERS.includes(provider)) return [];
            ids = OPENAI_EFFORTS;
    }
    return REASONING_EFFORT_OPTIONS.filter((o) => ids.includes(o.id));
}

/** Heuristic: does this model accept a reasoning / thinking effort control? */
export function modelSupportsReasoning(
    provider: ProviderId,
    modelId: string,
): boolean {
    // Registry metadata wins when present (e.g. grok-2 declares it explicitly).
    const known = (DEFAULT_MODELS[provider] ?? []).find(
        (m) => m.id === modelId,
    );
    if (known?.supportsReasoning != null) return known.supportsReasoning;

    const id = modelId.toLowerCase();

    if (
        /(?:^|[/:-])(o[1-5])(?:[-/:]|$)/.test(id) ||
        /o[1-5]-(mini|pro)|gpt-5(\.\d+)?|chatgpt/.test(id)
    ) {
        return true;
    }

    if (
        /claude.*(3-7|3\.7|opus-4|sonnet-4|haiku-4|thinking)/.test(id) ||
        /claude-(opus|sonnet|haiku)-(4|4-5|4-6)/.test(id)
    ) {
        return true;
    }

    if (/gemini-2\.5|gemini-3|flash-thinking|thinking-exp/.test(id)) {
        return true;
    }

    if (/grok-3|grok-4|grok-2.*thinking|grok-1\.5.*vision.*thinking/.test(id)) {
        return true;
    }

    if (
        /deepseek-r1|deepseek-reasoner|deepseek-v4|qwq|qwen3|reasoner|r1[-:]/.test(
            id,
        )
    ) {
        return true;
    }

    if (/mistral-(medium|large|small)-latest|magistral/.test(id)) {
        return true;
    }

    // Local / custom endpoints often expose reasoning models under short names
    if (
        (provider === "ollama" ||
            provider === "custom" ||
            provider === "lmstudio") &&
        /r1|qwq|reason|think|oss/.test(id)
    ) {
        return true;
    }

    return false;
}

const ANTHROPIC_BUDGET: Record<"low" | "medium" | "high", number> = {
    low: 2048,
    medium: 8000,
    high: 16000,
};

function isAnthropicBudgetEff(
    effort: ReasoningEffort,
): effort is "low" | "medium" | "high" {
    return effort === "low" || effort === "medium" || effort === "high";
}

/**
 * Build AI SDK `providerOptions` for the selected effort, using the effort
 * values each vendor actually supports (`getReasoningEffortOptions`).
 */
export function buildReasoningProviderOptions(
    provider: ProviderId,
    modelId: string,
    effort: ReasoningEffort | undefined,
): SharedV4ProviderOptions | undefined {
    if (!modelSupportsReasoning(provider, modelId)) return undefined;

    if (!effort || effort === "off") {
        if (provider === "anthropic") {
            return { anthropic: { thinking: { type: "disabled" } } };
        }
        if (provider === "xai") {
            return { xai: { reasoningEffort: "none" } };
        }
        if (
            provider === "openai" ||
            provider === "openrouter" ||
            provider === "groq" ||
            provider === "lmstudio"
        ) {
            return { openai: { reasoningEffort: "none" } };
        }
        if (provider === "deepseek") {
            return { deepseek: { thinking: { type: "disabled" } } };
        }
        if (provider === "bedrock") {
            return { bedrock: { reasoningConfig: { type: "disabled" } } };
        }
        if (provider === "mistral") {
            return { mistral: { reasoningEffort: "none" } };
        }
        // ollama / custom / gemini: omit => provider defaults
        return undefined;
    }

    switch (provider) {
        case "openai":
        case "openrouter":
        case "groq":
        case "lmstudio":
            return {
                openai: {
                    reasoningEffort: effort,
                    reasoningSummary: "auto",
                },
            };
        case "xai":
            return {
                xai: {
                    reasoningEffort: effort,
                    reasoningSummary: "auto",
                },
            };
        case "anthropic":
            if (!isAnthropicBudgetEff(effort)) {
                // Only low/medium/high map to a Claude thinking budget.
                return undefined;
            }
            return {
                anthropic: {
                    thinking: {
                        type: "enabled",
                        budgetTokens: ANTHROPIC_BUDGET[effort],
                    },
                },
            };
        case "gemini":
            return {
                google: {
                    thinkingConfig: {
                        thinkingLevel: effort,
                        includeThoughts: true,
                    },
                },
            };
        case "deepseek":
            return {
                deepseek: {
                    thinking: { type: "enabled" },
                    reasoningEffort: effort,
                },
            };
        case "bedrock":
            return {
                bedrock: {
                    reasoningConfig: {
                        type: "enabled",
                        maxReasoningEffort: effort,
                    },
                },
            };
        case "mistral":
            // Mistral only accepts none | high.
            return { mistral: { reasoningEffort: "high" } };
        default:
            return undefined;
    }
}
