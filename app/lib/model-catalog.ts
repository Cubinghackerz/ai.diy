/**
 * Model catalog — metadata and pricing sourced from models.dev (OpenRouter's
 * open model dataset, https://models.dev). Pure functions only (node-safe).
 */

import type { ModelInfo, ProviderId } from "./types.ts";
import { FALLBACK_CATALOG, type FallbackCatalog } from "./model-catalog-fallback.ts";

/** App ProviderId → models.dev provider key. */
export const PROVIDER_MAP: Partial<Record<ProviderId, string>> = {
    openai: "openai",
    anthropic: "anthropic",
    gemini: "google",
    groq: "groq",
    deepseek: "deepseek",
    bedrock: "amazon-bedrock",
    azure: "azure",
    vertex: "google-vertex",
    gateway: "openrouter",
    togetherai: "togetherai",
    mistral: "mistral",
    huggingface: "huggingface",
    lmstudio: "lmstudio",
    xai: "xai",
};

export interface CatalogCost {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    /** Per-1M price for reasoning tokens when billed separately. */
    reasoning?: number;
}

export interface ModelCatalogEntry {
    /** models.dev-qualified id, e.g. "openai/gpt-5". */
    id: string;
    name: string;
    description?: string;
    family?: string;
    toolCall?: boolean;
    reasoning?: boolean;
    structuredOutput?: boolean;
    vision?: boolean;
    context?: number;
    maxOutput?: number;
    cost?: CatalogCost;
    knowledge?: string;
}

export interface ModelCatalog {
    entries: Record<string, ModelCatalogEntry>;
    /** Lowercased last id segment → qualified entry ids. */
    byId: Record<string, string[]>;
}

/** Raw shape from models.dev/api.json. */
export interface RawModelCatalog {
    [providerId: string]: {
        id?: string;
        models?: Record<
            string,
            {
                id?: string;
                name?: string;
                description?: string;
                family?: string;
                tool_call?: boolean;
                reasoning?: boolean;
                structured_output?: boolean;
                attachment?: boolean;
                knowledge?: string;
                modalities?: { input?: string[]; output?: string[] };
                limit?: { context?: number; input?: number; output?: number };
                cost?: {
                    input?: number;
                    output?: number;
                    cache_read?: number;
                    cache_write?: number;
                    reasoning?: number;
                    context_over_200k?: number;
                };
            }
        >;
    };
}

export function normalizeCatalog(raw: RawModelCatalog): ModelCatalog {
    const entries: Record<string, ModelCatalogEntry> = {};
    const byId: Record<string, string[]> = {};
    for (const [mdProvider, providerBlock] of Object.entries(raw)) {
        const models = providerBlock?.models ?? {};
        for (const [modelId, m] of Object.entries(models)) {
            if (!m?.id) continue;
            const qualified = m.id.includes("/") ? m.id : `${mdProvider}/${m.id}`;
            const last = m.id.split("/").pop()?.toLowerCase() ?? "";
            const entry: ModelCatalogEntry = {
                id: qualified,
                name: m.name || m.id,
                description: m.description,
                family: m.family,
                toolCall: m.tool_call === true,
                reasoning: m.reasoning === true,
                structuredOutput: m.structured_output === true,
                vision:
                    m.attachment === true ||
                    (Array.isArray(m.modalities?.input) &&
                        m.modalities.input.includes("image")),
                context: m.limit?.context,
                maxOutput: m.limit?.output,
                cost:
                    m.cost && (m.cost.input != null || m.cost.output != null)
                        ? {
                              input: m.cost.input,
                              output: m.cost.output,
                              cacheRead: m.cost.cache_read,
                              cacheWrite: m.cost.cache_write,
                              reasoning: m.cost.reasoning,
                          }
                        : undefined,
                knowledge: m.knowledge,
            };
            entries[qualified] = entry;
            if (last) {
                (byId[last] ??= []).push(qualified);
            }
        }
    }
    return { entries, byId };
}

/** Qualify an app (provider, modelId) pair against the models.dev namespace. */
export function catalogKey(
    provider: ProviderId,
    modelId: string,
): string | undefined {
    const md = PROVIDER_MAP[provider];
    if (!md) return undefined;
    if (modelId.includes("/")) return modelId;
    return `${md}/${modelId}`;
}

export function lookupCatalogEntry(
    catalog: ModelCatalog,
    provider: ProviderId,
    modelId: string,
): ModelCatalogEntry | undefined {
    const key = catalogKey(provider, modelId);
    if (key) {
        const direct = catalog.entries[key];
        if (direct) return direct;
    }
    const last = modelId.split("/").pop()?.toLowerCase();
    if (!last) return undefined;
    const candidates = catalog.byId[last] ?? [];
    for (const candidate of candidates) {
        const entry = catalog.entries[candidate];
        if (entry) return entry;
    }
    return undefined;
}

/** Lookup against the bundled fallback snapshot (offline / first run). */
export function lookupFallbackEntry(
    provider: ProviderId,
    modelId: string,
): ModelCatalogEntry | undefined {
    const key = catalogKey(provider, modelId);
    if (key) {
        const direct = (FALLBACK_CATALOG as FallbackCatalog)[key];
        if (direct) return direct;
    }
    const last = modelId.split("/").pop()?.toLowerCase();
    if (!last) return undefined;
    for (const [k, entry] of Object.entries(FALLBACK_CATALOG as FallbackCatalog)) {
        if (k.split("/").pop()?.toLowerCase() === last) return entry;
    }
    return undefined;
}

export function fallbackCatalogAsCatalog(): ModelCatalog {
    return normalizeCatalog({
        // Wrap the flat fallback into the raw provider shape.
        fallback: {
            models: Object.fromEntries(
                Object.entries(FALLBACK_CATALOG as FallbackCatalog).map(
                    ([k, v]) => [
                        k,
                        {
                            id: v.id,
                            name: v.name,
                            description: v.description,
                            family: v.family,
                            tool_call: v.toolCall,
                            reasoning: v.reasoning,
                            structured_output: v.structuredOutput,
                            attachment: v.vision,
                            knowledge: v.knowledge,
                            modalities: v.vision
                                ? { input: ["text", "image"], output: ["text"] }
                                : { input: ["text"], output: ["text"] },
                            limit: { context: v.context, output: v.maxOutput },
                            cost: v.cost,
                        },
                    ],
                ),
            ),
        },
    });
}

export function formatContextWindow(tokens?: number): string | undefined {
    if (tokens == null || !Number.isFinite(tokens) || tokens <= 0) {
        return undefined;
    }
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`;
    return String(tokens);
}

/** Per-1M price line, e.g. "$1.25 in / $10 out". */
export function formatPricePerMillion(cost?: CatalogCost): string | undefined {
    if (!cost || (cost.input == null && cost.output == null)) return undefined;
    const input = cost.input ?? 0;
    const output = cost.output ?? 0;
    return `≈$${input} in / $${output} out per 1M`;
}

export type MergedModelInfo = ModelInfo & {
    description?: string;
    catalogEntry?: ModelCatalogEntry;
};

/** Merge catalog metadata (description/price/context) with local model info. */
export function mergeCatalogInfo(
    model: ModelInfo,
    entry?: ModelCatalogEntry,
): MergedModelInfo {
    return {
        ...model,
        contextWindow: model.contextWindow ?? entry?.context,
        maxTokens: model.maxTokens ?? entry?.maxOutput,
        description: entry?.description,
        catalogEntry: entry,
    };
}
