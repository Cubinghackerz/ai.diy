/**
 * Client-side usage ledger — Web Crypto fingerprinting + IndexedDB persistence.
 */

import type { UIMessage } from "ai";
import {
    appendUsageEventToDB,
    getUsageEventsSinceFromDB,
} from "~/lib/db";
import type { AppSettings, ProviderId } from "~/lib/types";
import { localProviderKey } from "~/lib/provider-credentials";
import {
    bytesToHex,
    checkUsageLimits,
    estimateCost,
    normalizeUsage,
    rollupUsageForFingerprint,
    type UsageEvent,
    type UsageEventSource,
    type UsageLimitCheckResult,
} from "~/lib/usage";
import { lookupFallbackEntry } from "~/lib/model-catalog";

const DAY_MS = 24 * 60 * 60 * 1000;

/** SHA-256 fingerprint of provider + API key (never stores the raw key). */
export async function fingerprintKey(
    provider: string,
    apiKey: string,
): Promise<string> {
    const material = `${provider}:${apiKey}`;
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(material),
    );
    return bytesToHex(new Uint8Array(digest));
}

export async function appendUsageEvent(event: UsageEvent): Promise<void> {
    await appendUsageEventToDB(event);
}

export async function getUsageEventsSince(
    keyFingerprint: string,
    sinceMs: number,
): Promise<UsageEvent[]> {
    return getUsageEventsSinceFromDB(keyFingerprint, sinceMs);
}

function resolveApiKey(
    provider: ProviderId,
    settings: AppSettings,
): string {
    const providerConfig = settings.providers[provider];
    const apiKey = providerConfig?.apiKey?.trim() || "";
    if (
        provider === "custom" &&
        providerConfig?.openAICompatible?.authMode &&
        providerConfig.openAICompatible.authMode !== "bearer"
    ) {
        return "";
    }
    return apiKey || localProviderKey(provider);
}

export async function checkClientUsageGate(
    settings: AppSettings,
    provider: ProviderId,
    apiKey?: string,
): Promise<UsageLimitCheckResult> {
    const limits = settings.usageLimits ?? { enabled: false };
    if (!limits.enabled) {
        return { ok: true, warn: false, blocked: false };
    }

    const resolvedKey = apiKey ?? resolveApiKey(provider, settings);
    const fingerprint = await fingerprintKey(provider, resolvedKey);
    const since = Date.now() - DAY_MS;
    const events = await getUsageEventsSince(fingerprint, since);
    const rollup = rollupUsageForFingerprint(events);
    return checkUsageLimits(limits, rollup);
}

export function warnIfUsageNearLimit(result: UsageLimitCheckResult): void {
    if (result.warn && result.message) {
        console.warn("[usage-limits]", result.message);
    }
}

export async function assertClientUsageAllowed(
    settings: AppSettings,
    provider: ProviderId,
    apiKey?: string,
): Promise<void> {
    const result = await checkClientUsageGate(settings, provider, apiKey);
    if (result.blocked) {
        throw new Error(result.message ?? "Usage limit reached.");
    }
    warnIfUsageNearLimit(result);
}

export async function recordUsageFromUIMessage(
    message: UIMessage,
    keyFingerprint: string,
    source: UsageEventSource,
    provider: string,
    model?: string,
): Promise<void> {
    const metadata = (message as { metadata?: unknown }).metadata;
    if (!metadata || typeof metadata !== "object") return;
    const record = metadata as {
        usage?: unknown;
        model?: unknown;
        provider?: unknown;
    };
    const usage = normalizeUsage(record.usage);
    if (!usage) return;

    const resolvedModel =
        typeof record.model === "string" && record.model
            ? record.model
            : model ?? "unknown";
    const resolvedProvider =
        typeof record.provider === "string" ? record.provider : provider;
    const entry = lookupFallbackEntry(
        resolvedProvider as ProviderId,
        resolvedModel,
    );
    const estimatedCostUsd = estimateCost(usage, entry) ?? undefined;

    await appendUsageEvent({
        id: message.id,
        keyFingerprint,
        provider: resolvedProvider,
        model: resolvedModel,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        reasoningTokens: usage.reasoningTokens,
        cachedInputTokens: usage.cachedInputTokens,
        totalTokens: usage.totalTokens,
        estimatedCostUsd,
        source,
        createdAt: Date.now(),
    });
}

export async function recordUsageFromMessages(
    messages: UIMessage[],
    settings: AppSettings,
    source: UsageEventSource,
    provider?: ProviderId,
    apiKey?: string,
): Promise<void> {
    const resolvedProvider = provider ?? settings.chat.provider;
    const resolvedKey = apiKey ?? resolveApiKey(resolvedProvider, settings);
    const fingerprint = await fingerprintKey(resolvedProvider, resolvedKey);

    for (const message of messages) {
        if (message.role !== "assistant") continue;
        await recordUsageFromUIMessage(
            message,
            fingerprint,
            source,
            resolvedProvider,
            settings.chat.model,
        );
    }
}
