/**
 * HNSW / cosine retrieval over local chunk embeddings.
 * Uses hnswlib-wasm when available; falls back to pure cosine scan.
 */

import { loadHnswlib, type HierarchicalNSW } from "hnswlib-wasm";
import type { KbChunk } from "./types";
import { KB_EMBEDDING_DIM } from "./types";

export type KbHit = {
    chunk: KbChunk;
    score: number;
};

function cosine(a: number[], b: number[]): number {
    const n = Math.min(a.length, b.length);
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < n; i += 1) {
        dot += a[i]! * b[i]!;
        na += a[i]! * a[i]!;
        nb += b[i]! * b[i]!;
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function searchChunksBrute(
    chunks: KbChunk[],
    queryEmbedding: number[],
    k: number,
): KbHit[] {
    return chunks
        .map((chunk) => ({ chunk, score: cosine(queryEmbedding, chunk.embedding) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(1, k));
}

let hnswModulePromise: ReturnType<typeof loadHnswlib> | null = null;

async function getHnsw() {
    if (!hnswModulePromise) hnswModulePromise = loadHnswlib();
    return hnswModulePromise;
}

/**
 * Build an in-memory HNSW index for the current chunk set and search.
 * For personal KBs this is rebuilt per query session; vectors remain in IDB.
 */
export async function searchChunksHnsw(
    chunks: KbChunk[],
    queryEmbedding: number[],
    k: number,
): Promise<KbHit[]> {
    if (!chunks.length || !queryEmbedding.length) return [];
    try {
        const lib = await getHnsw();
        const dim = chunks[0]?.embedding.length || KB_EMBEDDING_DIM;
        const index: HierarchicalNSW = new lib.HierarchicalNSW("cosine", dim, "");
        const maxElements = Math.max(chunks.length + 16, 64);
        index.initIndex(maxElements, 16, 200, 100);
        const idToChunk = new Map<number, KbChunk>();
        chunks.forEach((chunk, i) => {
            if (chunk.embedding.length !== dim) return;
            index.addPoint(chunk.embedding, i, false);
            idToChunk.set(i, chunk);
        });
        if (index.getCurrentCount() === 0) {
            return searchChunksBrute(chunks, queryEmbedding, k);
        }
        const result = index.searchKnn(queryEmbedding, Math.min(k, index.getCurrentCount()), undefined);
        const hits: KbHit[] = [];
        for (let i = 0; i < result.neighbors.length; i += 1) {
            const label = result.neighbors[i]!;
            const chunk = idToChunk.get(label);
            if (!chunk) continue;
            // hnswlib cosine space returns distance; convert to similarity-ish score
            const distance = result.distances[i] ?? 1;
            hits.push({ chunk, score: 1 / (1 + distance) });
        }
        return hits;
    } catch {
        return searchChunksBrute(chunks, queryEmbedding, k);
    }
}
