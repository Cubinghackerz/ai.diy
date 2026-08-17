/**
 * Credits auto-fallback — when a provider rejects a chat request because its
 * credits are exhausted, retry once on the next configured provider that has
 * credentials and a tool-capable model. Client-side only.
 */

import {
    DEFAULT_MODELS,
    DEFAULT_SETTINGS,
    type AppSettings,
    type ProviderConfig,
    type ProviderId,
} from "~/lib/types";
import { localProviderKey } from "~/lib/provider-credentials";

export type CreditsFallbackTarget = {
    provider: ProviderId;
    model: string;
    apiKey: string;
    baseUrl?: string;
    openAICompatible?: ProviderConfig["openAICompatible"];
};

/** Name of the window event fired after a successful fallback rerun. */
export const CREDITS_FALLBACK_EVENT = "prismium:credits-fallback";

export function notifyCreditsFallback(from: string, to: string): void {
    console.warn(
        `[credits-fallback] ${from} hit its credit limit; reran the request on ${to}.`,
    );
    if (typeof window === "undefined") return;
    window.dispatchEvent(
        new CustomEvent(CREDITS_FALLBACK_EVENT, {
            detail: { from, to },
        }),
    );
}

/**
 * First configured provider (excluding the current one and login/custom
 * variants) that is enabled, has credentials, and exposes a tool-capable model.
 */
export function findCreditsFallbackTarget(
    settings: AppSettings,
    currentProvider: ProviderId,
): CreditsFallbackTarget | null {
    for (const id of Object.keys(DEFAULT_SETTINGS.providers) as ProviderId[]) {
        if (id === currentProvider) continue;
        // ChatGPT needs a login session; custom proxies use special auth modes.
        if (id === "chatgpt" || id === "custom") continue;
        const cfg = settings.providers[id];
        if (!cfg?.enabled) continue;
        const apiKey = cfg.apiKey?.trim() || localProviderKey(id);
        if (!apiKey) continue;
        const models = DEFAULT_MODELS[id] ?? [];
        const model =
            models.find((m) => m.supportsTools === true) ?? models[0];
        if (!model) continue;
        return {
            provider: id,
            model: model.id,
            apiKey,
            baseUrl: cfg.baseUrl?.trim() || undefined,
            openAICompatible: cfg.openAICompatible,
        };
    }
    return null;
}

/** Apply a fallback target to an outgoing chat request body. */
export function applyCreditsFallback(
    body: Record<string, unknown>,
    target: CreditsFallbackTarget,
): Record<string, unknown> {
    return {
        ...body,
        provider: target.provider,
        model: target.model,
        apiKey: target.apiKey,
        ...(target.baseUrl ? { baseUrl: target.baseUrl } : {}),
        ...(target.openAICompatible
            ? { openAICompatible: target.openAICompatible }
            : {}),
    };
}
