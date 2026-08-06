/**
 * Client helpers for TypingMind-style live API key validation.
 * Uses only the key / base URL the user entered — never env vars.
 * Success requires a real provider models API response.
 */

import { DEFAULT_MODELS, type ModelInfo, type ProviderId } from "~/lib/types";
import { isLocalProvider } from "~/lib/setup";
import { enrichModelInfo } from "~/lib/model-capabilities";
import { localProviderKey } from "~/lib/provider-credentials";
import { listClientModels } from "~/lib/client-chat";

export type KeyTestResult = {
    ok: boolean;
    models: ModelInfo[];
    error?: string;
    live?: boolean;
    latencyMs?: number;
    resolvedBaseUrl?: string;
};

/** Soft format hints only — real validity comes from the live provider call. */
export function looksLikeApiKey(provider: ProviderId, key: string): boolean {
    const k = key.trim();
    if (!k) return false;
    if (isLocalProvider(provider)) return true;
    if (provider === "openai" || provider === "deepseek") {
        return k.startsWith("sk-") && k.length > 20;
    }
    if (provider === "groq") {
        return k.startsWith("gsk_") && k.length > 20;
    }
    if (provider === "anthropic") {
        return k.startsWith("sk-ant-") && k.length > 20;
    }
    if (provider === "openrouter") {
        return k.startsWith("sk-or-") || k.length > 20;
    }
    if (provider === "xai") {
        return k.startsWith("xai-") && k.length > 20;
    }
    if (provider === "togetherai") {
        return k.startsWith("tgp_v1_") && k.length > 20;
    }
    if (provider === "huggingface") {
        return k.startsWith("hf_") && k.length > 12;
    }
    if (provider === "bedrock" || provider === "vertex") {
        // Structured JSON credentials (or a plain long key for bearer auth).
        return k.startsWith("{") || k.length >= 16;
    }
    return k.length >= 16;
}

/**
 * Live test: call the provider directly with the exact key + endpoint the user configured.
 * On success, returns provider model list so the UI can unlock model selection.
 * Soft format checks never count as a pass.
 */
export async function testProviderKey(options: {
    provider: ProviderId;
    apiKey: string;
    baseUrl?: string;
    headers?: Record<string, string>;
    timeoutMs?: number;
    maxRetries?: number;
    authMode?: "bearer" | "api-key-header" | "custom-header" | "none";
}): Promise<KeyTestResult> {
    const { provider, apiKey, baseUrl, headers, timeoutMs, maxRetries, authMode } = options;
    const key = apiKey.trim();

    if (!isLocalProvider(provider) && !key) {
        return { ok: false, models: [], error: "Enter an API key to test." };
    }

    if (!isLocalProvider(provider) && !looksLikeApiKey(provider, key)) {
        return {
            ok: false,
            models: [],
            error: "Key format looks off for this provider. Check and try again.",
        };
    }

    const startedAt = performance.now();
    try {
        const live = await listClientModels(
            provider,
            provider === "custom" ? key : key || localProviderKey(provider),
            baseUrl,
            headers,
            timeoutMs,
            maxRetries,
            authMode,
        );
        const models = (live.length > 0 ? live : (DEFAULT_MODELS[provider] ?? [])).map((m) =>
            enrichModelInfo({
                ...m,
                id: m.id,
                name: m.name || m.id,
                provider,
            }),
        );

        if (models.length === 0) {
            return {
                ok: false,
                models: [],
                error: "The provider returned no models for this key.",
            };
        }

        return {
            ok: true,
            models,
            live: live.length > 0,
            latencyMs: Math.round(performance.now() - startedAt),
            resolvedBaseUrl: baseUrl,
        };
    } catch (err) {
        return {
            ok: false,
            models: [],
            error:
                err instanceof Error
                    ? err.message
                    : "Network error while testing the key.",
        };
    }
}
