/**
 * Local usage analytics — aggregates real provider-reported token usage
 * captured on assistant message metadata ({ usage, model, provider }).
 * Pure functions only (node-safe, tested by scripts/usage-smoke.mjs).
 */

import type { MessageData, UsageLimitsConfig } from "./types.ts";
import type { ModelCatalogEntry } from "./model-catalog.ts";

export interface UsageTokens {
    inputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    cachedInputTokens: number;
    totalTokens: number;
}

export interface MessageUsageRecord {
    usage: UsageTokens;
    model: string;
    provider?: string;
    threadId: string;
}

export const EMPTY_USAGE: UsageTokens = {
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    cachedInputTokens: 0,
    totalTokens: 0,
};

function asNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) && value >= 0
        ? value
        : undefined;
}

/** Normalize the AI SDK usage shape (or provider raw usage) to counts. */
export function normalizeUsage(usage: unknown): UsageTokens | null {
    if (!usage || typeof usage !== "object" || Array.isArray(usage)) return null;
    const record = usage as Record<string, unknown>;
    const input = asNumber(record.inputTokens) ?? asNumber(record.promptTokens);
    const output =
        asNumber(record.outputTokens) ?? asNumber(record.completionTokens);
    const reasoning = asNumber(record.reasoningTokens);
    const cached =
        asNumber(record.cachedInputTokens) ?? asNumber(record.cachedInput);
    if (input == null && output == null) return null;
    const inTokens = input ?? 0;
    const outTokens = output ?? 0;
    const total = asNumber(record.totalTokens) ?? inTokens + outTokens;
    return {
        inputTokens: inTokens,
        outputTokens: outTokens,
        reasoningTokens: reasoning ?? 0,
        cachedInputTokens: cached ?? 0,
        totalTokens: total ?? inTokens + outTokens,
    };
}

/** Extract usage + attribution from a persisted assistant message. */
export function usageFromStoredMessage(
    message: MessageData,
): MessageUsageRecord | null {
    const ui = message.uiMessage;
    if (!ui || typeof ui !== "object") return null;
    const metadata = (ui as { metadata?: unknown }).metadata;
    if (!metadata || typeof metadata !== "object") return null;
    const record = metadata as {
        usage?: unknown;
        model?: unknown;
        provider?: unknown;
    };
    const usage = normalizeUsage(record.usage);
    if (!usage) return null;
    return {
        usage,
        model: typeof record.model === "string" && record.model ? record.model : "unknown",
        provider:
            typeof record.provider === "string" ? record.provider : undefined,
        threadId: message.threadId,
    };
}

/**
 * Estimated cost in USD for a usage record given a catalog entry
 * (models.dev per-1M prices). Returns null when pricing is unknown.
 */
export function estimateCost(
    usage: UsageTokens,
    entry?: ModelCatalogEntry,
): number | null {
    const cost = entry?.cost;
    if (!cost || (cost.input == null && cost.output == null)) return null;
    const inputPrice = cost.input ?? 0;
    const outputPrice = cost.output ?? 0;
    const cacheReadPrice = cost.cacheRead ?? inputPrice;
    const reasoningPrice = cost.reasoning ?? inputPrice;
    const input = Math.max(usage.inputTokens - usage.cachedInputTokens, 0);
    return (
        (input * inputPrice +
            usage.cachedInputTokens * cacheReadPrice +
            usage.outputTokens * outputPrice +
            usage.reasoningTokens * reasoningPrice) /
        1_000_000
    );
}

export function addUsage(a: UsageTokens, b: UsageTokens): UsageTokens {
    return {
        inputTokens: a.inputTokens + b.inputTokens,
        outputTokens: a.outputTokens + b.outputTokens,
        reasoningTokens: a.reasoningTokens + b.reasoningTokens,
        cachedInputTokens: a.cachedInputTokens + b.cachedInputTokens,
        totalTokens: a.totalTokens + b.totalTokens,
    };
}

export interface ModelUsageRow {
    model: string;
    provider: string;
    usage: UsageTokens;
    cost: number | null;
}

export interface ThreadUsageRow {
    threadId: string;
    title: string;
    usage: UsageTokens;
    cost: number | null;
    model?: string;
}

export interface UsageAggregate {
    totals: UsageTokens;
    totalCost: number | null;
    messagesWithUsage: number;
    assistantMessages: number;
    chatThreads: number;
    byModel: ModelUsageRow[];
    byProvider: ModelUsageRow[];
    threads: ThreadUsageRow[];
}

export function aggregateUsage(
    records: MessageUsageRecord[],
    lookupEntry: (model: string, provider?: string) => ModelCatalogEntry | undefined,
    options?: {
        threadMeta?: Map<string, { title: string }>;
        assistantMessages?: number;
        chatThreads?: number;
    },
): UsageAggregate {
    const threadMeta = options?.threadMeta ?? new Map();
    let totals = { ...EMPTY_USAGE };
    const byModel = new Map<string, ModelUsageRow>();
    const byProvider = new Map<string, ModelUsageRow>();
    const threads = new Map<string, ThreadUsageRow>();
    let totalCost = 0;
    let costKnown = 0;

    for (const record of records) {
        const entry = lookupEntry(record.model, record.provider);
        const cost = estimateCost(record.usage, entry);
        totals = addUsage(totals, record.usage);
        if (cost != null) {
            totalCost += cost;
            costKnown++;
        }

        const modelKey = `${record.provider ?? "unknown"}/${record.model}`;
        const existingModel = byModel.get(modelKey);
        if (existingModel) {
            existingModel.usage = addUsage(existingModel.usage, record.usage);
            if (cost != null) existingModel.cost = (existingModel.cost ?? 0) + cost;
        } else {
            byModel.set(modelKey, {
                model: record.model,
                provider: record.provider ?? "unknown",
                usage: { ...record.usage },
                cost: cost ?? null,
            });
        }

        const providerKey = record.provider ?? "unknown";
        const existingProvider = byProvider.get(providerKey);
        if (existingProvider) {
            existingProvider.usage = addUsage(existingProvider.usage, record.usage);
            if (cost != null) {
                existingProvider.cost = (existingProvider.cost ?? 0) + cost;
            }
        } else {
            byProvider.set(providerKey, {
                model: providerKey,
                provider: providerKey,
                usage: { ...record.usage },
                cost: cost ?? null,
            });
        }

        const existingThread = threads.get(record.threadId);
        if (existingThread) {
            existingThread.usage = addUsage(existingThread.usage, record.usage);
            if (cost != null) existingThread.cost = (existingThread.cost ?? 0) + cost;
        } else {
            threads.set(record.threadId, {
                threadId: record.threadId,
                title: threadMeta.get(record.threadId)?.title ?? "Untitled chat",
                usage: { ...record.usage },
                cost: cost ?? null,
                model: record.model,
            });
        }
    }

    return {
        totals,
        totalCost: costKnown > 0 ? totalCost : null,
        messagesWithUsage: records.length,
        assistantMessages: options?.assistantMessages ?? records.length,
        chatThreads: options?.chatThreads ?? threads.size,
        byModel: [...byModel.values()].sort(
            (a, b) => b.usage.totalTokens - a.usage.totalTokens,
        ),
        byProvider: [...byProvider.values()].sort(
            (a, b) => b.usage.totalTokens - a.usage.totalTokens,
        ),
        threads: [...threads.values()].sort(
            (a, b) => b.usage.totalTokens - a.usage.totalTokens,
        ),
    };
}

export function formatTokens(count: number): string {
    if (count >= 1_000_000) {
        return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    }
    if (count >= 1_000) {
        return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
    }
    return String(count);
}

export function formatCost(usd: number | null | undefined): string {
    if (usd == null || !Number.isFinite(usd)) return "—";
    if (usd === 0) return "$0.00";
    if (usd < 0.01) return `$${usd.toFixed(4)}`;
    if (usd < 100) return `$${usd.toFixed(2)}`;
    return `$${Math.round(usd).toLocaleString("en-US")}`;
}

// ─── Usage ledger & limits (node-safe) ───────────────────────────

export type UsageEventSource =
    | "chat"
    | "title"
    | "preview"
    | "subagent"
    | "other";

export interface UsageEvent {
    id: string;
    keyFingerprint: string;
    provider: string;
    model?: string;
    inputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    cachedInputTokens: number;
    totalTokens: number;
    estimatedCostUsd?: number;
    source: UsageEventSource;
    createdAt: number;
}

export interface UsageRollup {
    totalTokens: number;
    totalCostUsd: number;
    eventCount: number;
    requestsInLastMinute: number;
}

export interface UsageLimitCheckResult {
    ok: boolean;
    warn: boolean;
    blocked: boolean;
    message?: string;
    tokenPercent?: number;
    spendPercent?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60_000;

/** Sync-friendly hex encoding for byte arrays (no Web Crypto). */
export function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function rollupUsageForFingerprint(
    events: UsageEvent[],
    windowMs = DAY_MS,
    now = Date.now(),
): UsageRollup {
    const since = now - windowMs;
    const minuteSince = now - MINUTE_MS;
    let totalTokens = 0;
    let totalCostUsd = 0;
    let eventCount = 0;
    let requestsInLastMinute = 0;

    for (const event of events) {
        if (event.createdAt < since) continue;
        eventCount++;
        totalTokens += event.totalTokens;
        totalCostUsd += event.estimatedCostUsd ?? 0;
        if (event.createdAt >= minuteSince) {
            requestsInLastMinute++;
        }
    }

    return { totalTokens, totalCostUsd, eventCount, requestsInLastMinute };
}

function percentUsed(used: number, cap: number | null | undefined): number | undefined {
    if (cap == null || cap <= 0) return undefined;
    return (used / cap) * 100;
}

export function checkUsageLimits(
    config: UsageLimitsConfig,
    rollup: UsageRollup,
): UsageLimitCheckResult {
    if (!config.enabled) {
        return { ok: true, warn: false, blocked: false };
    }

    const warnAt = config.warnAtPercent ?? 80;
    const block = config.blockWhenExceeded !== false;
    const tokenPercent = percentUsed(rollup.totalTokens, config.dailyTokenCap);
    const spendPercent = percentUsed(rollup.totalCostUsd, config.dailySpendCapUsd);
    const rpm = config.requestsPerMinute;

    const tokenExceeded =
        config.dailyTokenCap != null &&
        config.dailyTokenCap > 0 &&
        rollup.totalTokens >= config.dailyTokenCap;
    const spendExceeded =
        config.dailySpendCapUsd != null &&
        config.dailySpendCapUsd > 0 &&
        rollup.totalCostUsd >= config.dailySpendCapUsd;
    const rpmExceeded =
        rpm != null && rpm > 0 && rollup.requestsInLastMinute >= rpm;

    if (block && (tokenExceeded || spendExceeded || rpmExceeded)) {
        let message = "Usage limit reached.";
        if (tokenExceeded) {
            message = `Daily token cap reached (${formatTokens(rollup.totalTokens)} / ${formatTokens(config.dailyTokenCap!)})`;
        } else if (spendExceeded) {
            message = `Daily spend cap reached (${formatCost(rollup.totalCostUsd)} / ${formatCost(config.dailySpendCapUsd!)})`;
        } else if (rpmExceeded) {
            message = `Request rate limit reached (${rollup.requestsInLastMinute} / ${rpm} per minute)`;
        }
        return {
            ok: false,
            warn: false,
            blocked: true,
            message,
            tokenPercent,
            spendPercent,
        };
    }

    const tokenWarn =
        tokenPercent != null && tokenPercent >= warnAt && !tokenExceeded;
    const spendWarn =
        spendPercent != null && spendPercent >= warnAt && !spendExceeded;

    if (tokenWarn || spendWarn) {
        return {
            ok: true,
            warn: true,
            blocked: false,
            message: tokenWarn
                ? `Approaching daily token cap (${Math.round(tokenPercent!)}%)`
                : `Approaching daily spend cap (${Math.round(spendPercent!)}%)`,
            tokenPercent,
            spendPercent,
        };
    }

    return { ok: true, warn: false, blocked: false, tokenPercent, spendPercent };
}
