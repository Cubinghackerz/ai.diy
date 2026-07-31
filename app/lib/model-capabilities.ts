/**
 * Infer which models support tool / function calling and filter pickers.
 */

import { DEFAULT_MODELS, type ModelInfo, type ProviderId } from "~/lib/types";
import { modelSupportsReasoning } from "~/lib/reasoning";

export type ModelCapabilities = {
    textGeneration: boolean;
    tools: boolean;
    vision: boolean;
    reasoning: boolean;
    structuredOutputs: boolean;
    audio: boolean;
    imageGeneration: boolean;
    streaming: boolean;
};

/** Heuristic: does this model id look like a chat model with tool support? */
export function inferModelSupportsTools(
    modelId: string,
    provider?: ProviderId,
): boolean {
    const id = modelId.toLowerCase();

    if (
        /(?:^|[/:\-_])(text-embedding|embedding|embeddings|nomic-embed|bge-|mxbai-embed|jina-embed)/.test(
            id,
        ) ||
        /(?:^|[/:\-_])(whisper|tts-|speech-|transcribe|audio-preview)/.test(
            id,
        ) ||
        /(?:^|[/:\-_])(dall-e|stable-diffusion|flux-|imagen|gpt-image|image-alpha)/.test(
            id,
        ) ||
        /moderation|omni-moderation|rerank|classify|content-filter|guardrail/.test(
            id,
        ) ||
        /(?:^|[/:\-_])(davinci-00|babbage-00|text-curie|text-babbage|text-ada)/.test(
            id,
        )
    ) {
        return false;
    }

    // Reasoning-only models often reject or ignore tools on many providers.
    if (
        /deepseek-r1|deepseek-reasoner|qwq-|phi4-reasoning|reasoner(?!.*chat)/.test(
            id,
        )
    ) {
        return false;
    }

    if (provider === "ollama" || provider === "custom") {
        if (/llava|bakllava|moondream|minicpm-v|embed/.test(id)) {
            return false;
        }
    }

    if (
        /gpt-|chatgpt|o[1-4]|claude|gemini|llama|mistral|mixtral|qwen|deepseek-chat|deepseek-v|command-|phi-|granite|nemotron|sonar|grok|instruct|versatile|command-r/.test(
            id,
        )
    ) {
        return true;
    }

    if (provider) {
        const known = (DEFAULT_MODELS[provider] ?? []).find(
            (m) => m.id === modelId,
        );
        if (known?.supportsTools === true) return true;
        if (known?.supportsTools === false) return false;
    }

    return false;
}

export function enrichModelInfo(model: ModelInfo): ModelInfo {
    const supportsTools =
        model.supportsTools ??
        inferModelSupportsTools(model.id, model.provider);
    const supportsVision =
        model.supportsVision ?? inferModelSupportsVision(model.id, model.provider);
    const supportsReasoning =
        model.supportsReasoning ?? modelSupportsReasoning(model.provider, model.id);
    const id = model.id.toLowerCase();
    return {
        ...model,
        supportsTools,
        supportsVision,
        supportsReasoning,
        supportsStructuredOutputs:
            model.supportsStructuredOutputs ??
            (supportsTools && /gpt-|claude|gemini|qwen|mistral|llama/.test(id)),
        supportsAudio:
            model.supportsAudio ?? /audio|realtime|gpt-4o/.test(id),
        supportsImageGeneration:
            model.supportsImageGeneration ??
            /dall-e|gpt-image|imagen|stable-diffusion|flux/.test(id),
        supportsStreaming: model.supportsStreaming ?? true,
    };
}

export function inferModelSupportsVision(
    modelId: string,
    provider?: ProviderId,
): boolean {
    const id = modelId.toLowerCase();
    if (/(?:^|[/_:-])(embedding|whisper|tts|moderation|rerank)/.test(id)) {
        return false;
    }
    if (
        /gpt-4o|gpt-4\.1|gpt-5|chatgpt|o[1-4]|claude|gemini|llava|bakllava|moondream|minicpm-v|vision|pixtral|qwen.*vl|llama-4|grok.*vision/.test(
            id,
        )
    ) {
        return true;
    }
    const known = provider
        ? (DEFAULT_MODELS[provider] ?? []).find((model) => model.id === modelId)
        : undefined;
    return known?.supportsVision === true;
}

export function getModelCapabilities(
    modelId: string,
    provider: ProviderId,
): ModelCapabilities {
    const info = enrichModelInfo({ id: modelId, name: modelId, provider });
    return {
        textGeneration: !/(embedding|moderation|rerank|tts|whisper)/i.test(modelId),
        tools: info.supportsTools === true,
        vision: info.supportsVision === true,
        reasoning: info.supportsReasoning === true,
        structuredOutputs: info.supportsStructuredOutputs === true,
        audio: info.supportsAudio === true,
        imageGeneration: info.supportsImageGeneration === true,
        streaming: info.supportsStreaming !== false,
    };
}

export function resolveModel(
    provider: ProviderId,
    preferredId?: string,
    models?: ModelInfo[],
): string {
    const pool = models ?? DEFAULT_MODELS[provider] ?? [];
    if (preferredId && pool.some((model) => model.id === preferredId)) {
        return preferredId;
    }
    return pool[0]?.id ?? preferredId ?? "";
}

export function filterToolCapableModels(models: ModelInfo[]): ModelInfo[] {
    return models
        .map(enrichModelInfo)
        .filter((m) => m.supportsTools === true);
}

/** Pick a tool-capable model, preferring `preferredId` when valid. */
export function resolveToolCapableModel(
    provider: ProviderId,
    preferredId?: string,
    models?: ModelInfo[],
): string {
    const pool = filterToolCapableModels(
        models ?? DEFAULT_MODELS[provider] ?? [],
    );
    if (preferredId && pool.some((m) => m.id === preferredId)) {
        return preferredId;
    }
    return pool[0]?.id ?? preferredId ?? "";
}
