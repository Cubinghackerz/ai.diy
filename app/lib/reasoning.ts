/**
 * Reasoning / thinking effort — detect support and map to provider options.
 */

import type { ProviderId, ReasoningEffort } from "~/lib/types";

export type { ReasoningEffort };

export const REASONING_EFFORT_OPTIONS: {
    id: ReasoningEffort;
    label: string;
}[] = [
    { id: "off", label: "Think off" },
    { id: "low", label: "Think low" },
    { id: "medium", label: "Think med" },
    { id: "high", label: "Think high" },
];

/** Heuristic: does this model accept a reasoning / thinking effort control? */
export function modelSupportsReasoning(
    provider: ProviderId,
    modelId: string,
): boolean {
    const id = modelId.toLowerCase();

    if (
        /(?:^|[/:-])(o1|o3|o4)(?:[-/:]|$)/.test(id) ||
        /o[1-4]-(mini|pro)|gpt-5/.test(id)
    ) {
        return true;
    }

    if (
        /claude.*(3-7|3\.7|opus-4|sonnet-4|haiku-4|thinking)/.test(id) ||
        /claude-(opus|sonnet|haiku)-4/.test(id)
    ) {
        return true;
    }

    if (/gemini-2\.5|gemini-3|flash-thinking|thinking-exp/.test(id)) {
        return true;
    }

    if (
        /deepseek-r1|deepseek-reasoner|qwq|qwen3|reasoner|r1[-:]/.test(id)
    ) {
        return true;
    }

    // Local / custom endpoints often expose reasoning models under short names
    if (
        (provider === "ollama" || provider === "custom") &&
        /r1|qwq|reason|think/.test(id)
    ) {
        return true;
    }

    return false;
}

const ANTHROPIC_BUDGET: Record<Exclude<ReasoningEffort, "off">, number> = {
    low: 2048,
    medium: 8000,
    high: 16000,
};

/**
 * Build AI SDK `providerOptions` for the selected effort.
 * Returns undefined when effort is off or the model doesn't use these knobs.
 */
export function buildReasoningProviderOptions(
    provider: ProviderId,
    modelId: string,
    effort: ReasoningEffort | undefined,
): Record<string, Record<string, unknown>> | undefined {
    if (!effort || effort === "off") {
        if (
            provider === "anthropic" &&
            modelSupportsReasoning(provider, modelId)
        ) {
            return { anthropic: { thinking: { type: "disabled" } } };
        }
        return undefined;
    }

    if (!modelSupportsReasoning(provider, modelId)) return undefined;

    switch (provider) {
        case "openai":
        case "openrouter":
        case "groq":
        case "ollama":
        case "custom":
            return {
                openai: {
                    reasoningEffort: effort,
                    reasoningSummary: "auto",
                },
            };
        case "anthropic":
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
        default:
            return undefined;
    }
}
