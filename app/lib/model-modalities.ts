/**
 * Model modality detection — tools, vision, documents/PDF.
 */

import { DEFAULT_MODELS, type ModelInfo, type ProviderId } from "~/lib/types";
import { inferModelSupportsTools } from "~/lib/model-capabilities";

export type ModelModalities = {
    tools: boolean;
    vision: boolean;
    /** PDF / binary document file parts (not plain text). */
    documents: boolean;
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
        /gpt-4o|gpt-4\.1|gpt-5|chatgpt|o[1-4]|claude|gemini|llava|bakllava|moondream|minicpm-v|vision|pixtral|qwen2\.5-vl|qwen-vl|llama-4|grok-2-vision/.test(
            id,
        )
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
    };
}
