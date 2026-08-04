import {
    clearEmbeddingCacheEntries,
    countEmbeddingCacheEntries,
    getEmbeddingCacheEntry,
    saveEmbeddingCacheEntry,
    type EmbeddingCacheEntry,
} from "~/lib/db";

export const EMBEDDING_MODEL_ID = "onnx-community/all-MiniLM-L6-v2-ONNX";
export const EMBEDDING_DIMENSIONS = 384;
export const EMBEDDING_MODEL_SIZE = "about 30 MB of model data";

type EmbeddingState = "idle" | "loading" | "ready" | "error";

export interface EmbeddingStatus {
    state: EmbeddingState;
    progress: number;
    dimensions: number | null;
    error: string | null;
}

interface EmbeddingTensor {
    data: ArrayLike<number>;
    dims: number[];
}

interface FeatureExtractor {
    (
        texts: string | string[],
        options: { pooling: "mean"; normalize: true },
    ): Promise<EmbeddingTensor>;
    dispose?: () => Promise<void> | void;
}

const MAX_TEXT_LENGTH = 8000;
const MODEL_CACHE_PREFIX = `${EMBEDDING_MODEL_ID}:q4f16:`;

let status: EmbeddingStatus = {
    state: "idle",
    progress: 0,
    dimensions: null,
    error: null,
};
let extractor: FeatureExtractor | null = null;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<(nextStatus: EmbeddingStatus) => void>();

function updateStatus(patch: Partial<EmbeddingStatus>) {
    status = { ...status, ...patch };
    for (const listener of listeners) listener(status);
}

function normalizeText(text: string): string {
    return text.trim().replace(/\s+/g, " ").slice(0, MAX_TEXT_LENGTH);
}

function hashText(text: string): string {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return `${hash >>> 0}-${text.length}`;
}

function cacheKey(text: string): string {
    return `${MODEL_CACHE_PREFIX}${hashText(text)}`;
}

export function getEmbeddingStatus(): EmbeddingStatus {
    return status;
}

export function subscribeEmbeddingStatus(
    listener: (nextStatus: EmbeddingStatus) => void,
): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export async function loadEmbeddingModel(): Promise<void> {
    if (typeof window === "undefined") {
        throw new Error("Local embeddings are available in the browser only.");
    }
    if (extractor) return;
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
        updateStatus({ state: "loading", progress: 0, error: null });
        try {
            const { env, pipeline } = await import("@huggingface/transformers");
            env.allowLocalModels = false;
            env.useBrowserCache = true;

            const loaded = await pipeline("feature-extraction", EMBEDDING_MODEL_ID, {
                dtype: "q4f16",
                progress_callback: (info) => {
                    if ("progress" in info && typeof info.progress === "number") {
                        updateStatus({ progress: Math.round(info.progress) });
                    }
                },
            });
            extractor = loaded as unknown as FeatureExtractor;
            updateStatus({
                state: "ready",
                progress: 100,
                dimensions: EMBEDDING_DIMENSIONS,
                error: null,
            });
        } catch (error) {
            extractor = null;
            updateStatus({
                state: "error",
                error: error instanceof Error ? error.message : "Model download failed.",
            });
            throw error;
        } finally {
            loadPromise = null;
        }
    })();

    return loadPromise;
}

async function readCachedVector(key: string, text: string): Promise<Float32Array | null> {
    try {
        const cached = await getEmbeddingCacheEntry(key);
        if (!cached || cached.text !== text) return null;
        return cached.vector;
    } catch {
        return null;
    }
}

async function writeCachedVector(key: string, text: string, vector: Float32Array) {
    const entry: EmbeddingCacheEntry = {
        key,
        text,
        vector,
        createdAt: Date.now(),
    };
    try {
        await saveEmbeddingCacheEntry(entry);
    } catch {
        // Embeddings remain usable when IndexedDB is unavailable or full.
    }
}

async function runExtractor(texts: string[]): Promise<Float32Array[]> {
    await loadEmbeddingModel();
    if (!extractor) throw new Error("The local embedding model is not ready.");

    const output = await extractor(texts, { pooling: "mean", normalize: true });
    const values = Array.from(output.data);
    const dimensions =
        output.dims[output.dims.length - 1] ?? Math.floor(values.length / texts.length);
    if (!dimensions || values.length < dimensions * texts.length) {
        throw new Error("The embedding model returned an invalid vector.");
    }

    updateStatus({ dimensions });
    return texts.map((_, index) =>
        Float32Array.from(values.slice(index * dimensions, (index + 1) * dimensions)),
    );
}

export async function embedTexts(texts: string[]): Promise<Float32Array[]> {
    const normalized = texts.map(normalizeText);
    if (normalized.some((text) => text.length === 0)) {
        throw new Error("Embedding text cannot be empty.");
    }
    if (normalized.length === 0) return [];

    const vectors = new Array<Float32Array>(normalized.length);
    const missing: Array<{ index: number; key: string; text: string }> = [];
    await Promise.all(
        normalized.map(async (text, index) => {
            const key = cacheKey(text);
            const cached = await readCachedVector(key, text);
            if (cached) vectors[index] = cached;
            else missing.push({ index, key, text });
        }),
    );

    if (missing.length > 0) {
        const computed = await runExtractor(missing.map((item) => item.text));
        await Promise.all(
            missing.map(async (item, index) => {
                const vector = computed[index];
                vectors[item.index] = vector;
                await writeCachedVector(item.key, item.text, vector);
            }),
        );
    }

    return vectors;
}

export async function embedText(text: string): Promise<Float32Array> {
    const [vector] = await embedTexts([text]);
    return vector;
}

export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;
    for (let index = 0; index < a.length; index += 1) {
        dot += a[index] * b[index];
        magnitudeA += a[index] * a[index];
        magnitudeB += b[index] * b[index];
    }
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dot / Math.sqrt(magnitudeA * magnitudeB);
}

export async function getEmbeddingCacheCount(): Promise<number> {
    try {
        return await countEmbeddingCacheEntries();
    } catch {
        return 0;
    }
}

export async function clearEmbeddingCache(): Promise<void> {
    await clearEmbeddingCacheEntries();
}

/** Release the in-memory model while keeping downloaded files and vectors cached. */
export async function releaseEmbeddingModel(): Promise<void> {
    const pendingLoad = loadPromise;
    if (pendingLoad) await pendingLoad.catch(() => undefined);
    const current = extractor;
    extractor = null;
    if (current?.dispose) await current.dispose();
    updateStatus({ state: "idle", progress: 0, dimensions: null, error: null });
}
