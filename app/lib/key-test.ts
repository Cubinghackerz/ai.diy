/**
 * Client helpers for TypingMind-style live API key validation.
 * Uses only the key / base URL the user entered — never env vars.
 * Success requires a real provider models API response.
 */

import { DEFAULT_MODELS, type ModelInfo, type ProviderId } from "~/lib/types";
import { isLocalProvider } from "~/lib/setup";
import { enrichModelInfo } from "~/lib/model-capabilities";
import { localProviderKey } from "~/lib/provider-credentials";
import { formatProviderError } from "~/lib/provider-errors";

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
 * Live test: POST /api/models with the exact key + endpoint the user configured.
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
        return {
            ok: false,
            models: [],
            error: formatProviderError("API key required", {
                provider,
                context: "setup",
            }),
        };
    }

    if (!isLocalProvider(provider) && !looksLikeApiKey(provider, key)) {
        return {
            ok: false,
            models: [],
            error: formatProviderError(
                "Invalid API key format for this provider",
                { provider, context: "setup" },
            ),
        };
    }

    const startedAt = performance.now();
    try {
        const res = await fetch("/api/models", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                provider,
                    apiKey:
                        provider === "custom"
                            ? key
                            : key || localProviderKey(provider),
                    baseUrl: baseUrl || undefined,
                    headers,
                    timeoutMs,
                    maxRetries,
                    authMode,
            }),
        });
        const data = (await res.json()) as {
            models?: ModelInfo[];
            error?: string;
            live?: boolean;
            resolvedBaseUrl?: string;
        };

        if (!res.ok || data.error) {
            return {
                ok: false,
                models: [],
                error:
                    data.error ||
                    formatProviderError(
                        `Provider rejected the key (HTTP ${res.status})`,
                        { provider, status: res.status, context: "setup" },
                    ),
                live: data.live,
                latencyMs: Math.round(performance.now() - startedAt),
                resolvedBaseUrl: data.resolvedBaseUrl,
            };
        }

        const models = (
            data.models && data.models.length > 0
                ? data.models
                : (DEFAULT_MODELS[provider] ?? [])
        ).map((m) =>
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
            live: data.live,
            latencyMs: Math.round(performance.now() - startedAt),
            resolvedBaseUrl: data.resolvedBaseUrl,
        };
    } catch (err) {
        return {
            ok: false,
            models: [],
            error: formatProviderError(
                err instanceof Error ? err : "Network error while testing the key",
                { provider, context: "setup" },
            ),
        };
    }
}
