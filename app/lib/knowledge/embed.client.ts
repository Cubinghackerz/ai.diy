/**
 * On-device embeddings via @huggingface/transformers (WASM).
 * Model weights cache in the browser; nothing is sent to embedding APIs.
 */

import { KB_MODEL_ID } from "./types";

type FeatureExtractionPipeline = (
    texts: string | string[],
    options?: { pooling?: string; normalize?: boolean },
) => Promise<{ data: Float32Array | number[]; tolist?: () => number[][] }>;

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

async function getPipeline(): Promise<FeatureExtractionPipeline> {
    if (!pipelinePromise) {
        pipelinePromise = (async () => {
            const { pipeline, env } = await import("@huggingface/transformers");
            // Prefer local cache / WASM; avoid Node filesystem assumptions in browser.
            env.allowLocalModels = false;
            env.useBrowserCache = true;
            return (await pipeline("feature-extraction", KB_MODEL_ID, {
                dtype: "fp32",
            })) as FeatureExtractionPipeline;
        })();
    }
    return pipelinePromise;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];
    const extractor = await getPipeline();
    const out: number[][] = [];
    // Batch small to keep memory predictable in-browser.
    const batchSize = 4;
    for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const result = await extractor(batch, { pooling: "mean", normalize: true });
        if (typeof result.tolist === "function") {
            const list = result.tolist();
            for (const row of list) out.push(Array.from(row as number[]));
        } else if (batch.length === 1) {
            out.push(Array.from(result.data as Float32Array));
        } else {
            const data = result.data as Float32Array;
            const dim = Math.floor(data.length / batch.length);
            for (let b = 0; b < batch.length; b += 1) {
                out.push(Array.from(data.slice(b * dim, (b + 1) * dim)));
            }
        }
    }
    return out;
}

export async function embedQuery(query: string): Promise<number[]> {
    const [vec] = await embedTexts([query]);
    return vec ?? [];
}
