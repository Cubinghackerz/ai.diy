/**
 * Model modality detection — tools, vision, documents/PDF.
 */

import { DEFAULT_MODELS, type ModelInfo, type ProviderId } from "~/lib/types";
import {
    inferModelSupportsTools,
    inferModelSupportsImageGeneration,
} from "~/lib/model-capabilities";
import { modelSupportsReasoning } from "~/lib/reasoning";

export type ModelModalities = {
    tools: boolean;
    vision: boolean;
    /** PDF / binary document file parts (not plain text). */
    documents: boolean;
    /** Model emits reasoning / thinking parts. */
    reasoning: boolean;
    /** Model generates images rather than only text. */
    imageGeneration: boolean;
};

export function inferModelSupportsVision(
    modelId: string,
    provider?: ProviderId,
): boolean {
    const id = modelId.toLowerCase();

    if (
        /(?:^|[/:\-_])(text-embedding|embedding|whisper|tts-|dall-e|moderation)/.test(
            id,
        )
    ) {
        return false;
    }

    if (
        /gpt-4o|gpt-4\.1|gpt-5|chatgpt|o[1-4]|claude|gemini|gemma-4|llava|bakllava|moondream|minicpm-v|vision|pixtral|qwen[^/]*vl|llama-4|grok-2-vision|nova-(?:lite|pro)|command-a-vision/.test(
            id,
        )
    ) {
        return true;
    }

    // Grok's current 3/4 chat families accept image parts through the
    // OpenAI-compatible subscription proxy; code and mini variants remain text-only.
    if (
        provider === "grok" &&
        /grok-(?:3|4)(?:[.\-]|$)/.test(id) &&
        !/(?:mini|code)/.test(id)
    ) {
        return true;
    }

    if (provider) {
        const known = (DEFAULT_MODELS[provider] ?? []).find(
            (m) => m.id === modelId,
        );
        if (known?.supportsVision === true) return true;
        if (known?.supportsVision === false) return false;
    }

    return false;
}

/** Most multimodal chat models that accept images also accept PDF/file parts. */
export function inferModelSupportsDocuments(
    modelId: string,
    provider?: ProviderId,
): boolean {
    // The Grok Build proxy accepts image parts, while PDF/binary parts are
    // more portable when extracted to text locally before sending.
    if (provider === "grok") return false;
    const id = modelId.toLowerCase();
    if (/claude|gpt-4o|gpt-4\.1|gpt-5|gemini|o[1-4]/.test(id)) return true;
    return inferModelSupportsVision(modelId, provider);
}

export function getModelModalities(
    modelId: string,
    provider: ProviderId,
): ModelModalities {
    return {
        tools: inferModelSupportsTools(modelId, provider),
        vision: inferModelSupportsVision(modelId, provider),
        documents: inferModelSupportsDocuments(modelId, provider),
        reasoning: modelSupportsReasoning(provider, modelId),
        imageGeneration: inferModelSupportsImageGeneration(modelId, provider),
    };
}

export function enrichModelModalities(model: ModelInfo): ModelInfo {
    return {
        ...model,
        supportsTools:
            model.supportsTools ??
            inferModelSupportsTools(model.id, model.provider),
        supportsVision:
            model.supportsVision ??
            inferModelSupportsVision(model.id, model.provider),
        supportsReasoning:
            model.supportsReasoning ??
            modelSupportsReasoning(model.provider, model.id),
    };
}
