/**
 * Browser-side model catalog loader — fetch models.dev, cache in IndexedDB
 * (7 day TTL), fall back to the bundled snapshot. Module-level promise so
 * every picker/card shares one fetch.
 */

import { useEffect, useState } from "react";
import { getModelCatalogCache, saveModelCatalogCache } from "./db.ts";
import {
    catalogKey,
    fallbackCatalogAsCatalog,
    normalizeCatalog,
    type ModelCatalog,
    type ModelCatalogEntry,
    type RawModelCatalog,
} from "./model-catalog.ts";
import type { ProviderId } from "./types.ts";

const MODELS_DEV_URL = "https://models.dev/api.json";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let shared: Promise<ModelCatalog> | null = null;

export async function fetchModelCatalogFromNetwork(): Promise<ModelCatalog> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
        const res = await fetch(MODELS_DEV_URL, {
            signal: controller.signal,
        });
        if (!res.ok) throw new Error(`models.dev HTTP ${res.status}`);
        const raw = (await res.json()) as RawModelCatalog;
        const catalog = normalizeCatalog(raw);
        await saveModelCatalogCache(catalog);
        return catalog;
    } finally {
        clearTimeout(timer);
    }
}

/** Resolve the catalog: cache-first, then network, then bundled snapshot. */
export async function getModelCatalog(): Promise<ModelCatalog> {
    if (shared) return shared;
    shared = (async () => {
        const cached = await getModelCatalogCache();
        if (cached && typeof cached.data === "object" && cached.data !== null) {
            if (Date.now() - cached.updatedAt < CACHE_TTL_MS) {
                return cached.data as ModelCatalog;
            }
            try {
                return await fetchModelCatalogFromNetwork();
            } catch {
                return cached.data as ModelCatalog;
            }
        }
        try {
            return await fetchModelCatalogFromNetwork();
        } catch {
            return fallbackCatalogAsCatalog();
        }
    })();
    return shared;
}

/** Force a re-fetch on next getModelCatalog call. */
export function resetModelCatalog(): void {
    shared = null;
}

/** Lookup in a resolved catalog (exact key, then last-segment index). */
export function lookupInCatalog(
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

export async function lookupEntry(
    provider: ProviderId,
    modelId: string,
): Promise<ModelCatalogEntry | undefined> {
    const catalog = await getModelCatalog();
    return lookupInCatalog(catalog, provider, modelId);
}

/**
 * React hook: starts with the bundled snapshot so cards render immediately,
 * then upgrades to the live catalog when it resolves.
 */
export function useModelCatalog(): ModelCatalog {
    const [catalog, setCatalog] = useState<ModelCatalog>(() =>
        fallbackCatalogAsCatalog(),
    );

    useEffect(() => {
        let alive = true;
        void getModelCatalog().then((next) => {
            if (alive) setCatalog(next);
        });
        return () => {
            alive = false;
        };
    }, []);

    return catalog;
}
