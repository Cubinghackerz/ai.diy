import {
    DEFAULT_MODELS,
    type AppSettings,
    type ProviderId,
} from "~/lib/types";
import { enrichModelInfo } from "~/lib/model-capabilities";
import type { ModelInfo } from "~/lib/types";

/** Providers that run locally and do not require a cloud API key. */
export const LOCAL_PROVIDERS: ProviderId[] = ["ollama", "lmstudio", "custom"];

export function isLocalProvider(id: ProviderId): boolean {
    return LOCAL_PROVIDERS.includes(id);
}

/** True when the provider can make requests (local endpoint or non-empty API key). */
export function isProviderReady(
    settings: AppSettings,
    id: ProviderId = settings.chat.provider,
): boolean {
    const config = settings.providers[id];
    if (!config) return false;
    if (isLocalProvider(id)) return true;
    return Boolean(config.apiKey?.trim());
}

/** All models for a provider (live list merged with defaults, enriched with capabilities). */
export function getModelsForProvider(id: ProviderId): ModelInfo[] {
    return (DEFAULT_MODELS[id] ?? []).map(enrichModelInfo);
}

export function hasAnyReadyProvider(settings: AppSettings): boolean {
    return (Object.keys(settings.providers) as ProviderId[]).some((id) =>
        isProviderReady(settings, id),
    );
}

/** First-run gate: show setup until the user finishes and has a ready provider. */
export function needsSetup(settings: AppSettings): boolean {
    if (!settings.setupComplete) return true;
    return !isProviderReady(settings);
}
