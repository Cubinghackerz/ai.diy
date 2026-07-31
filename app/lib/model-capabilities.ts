/**
 * Infer which models support tool / function calling and filter pickers.
 */

import { DEFAULT_MODELS, type ModelInfo, type ProviderId } from "~/lib/types";

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
    return { ...model, supportsTools };
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
