/**
 * Client helpers for TypingMind-style live API key validation.
 * Uses only the key / base URL the user entered — never env vars.
 * Success requires a real provider models API response.
 */

import { DEFAULT_MODELS, type ModelInfo, type ProviderId } from "~/lib/types";
import { isLocalProvider } from "~/lib/setup";
import { enrichModelInfo } from "~/lib/model-capabilities";

export type KeyTestResult = {
    ok: boolean;
    models: ModelInfo[];
    error?: string;
};

/** Soft format hints only — real validity comes from the live provider call. */
export function looksLikeApiKey(provider: ProviderId, key: string): boolean {
    const k = key.trim();
    if (!k) return false;
    if (isLocalProvider(provider)) return true;
    if (provider === "openai") {
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
}): Promise<KeyTestResult> {
    const { provider, apiKey, baseUrl } = options;
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

    try {
        const res = await fetch("/api/models", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                provider,
                apiKey: key || (provider === "ollama" ? "ollama" : "custom"),
                baseUrl: baseUrl || undefined,
            }),
        });
        const data = (await res.json()) as {
            models?: ModelInfo[];
            error?: string;
            live?: boolean;
        };

        if (!res.ok || data.error) {
            return {
                ok: false,
                models: [],
                error:
                    data.error ||
                    `Provider rejected the key (HTTP ${res.status}).`,
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

        return { ok: true, models };
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
