/**
 * Local knowledge (Phase B) — chunk, index, and retrieve private documents
 * entirely in the browser using the on-device embedding engine.
 *
 * Documents are split into overlapping chunks, embedded with the local
 * MiniLM model, and stored in IndexedDB. At chat time the latest user
 * message is embedded and the most similar chunks are injected into the
 * system prompt as quoted, untrusted context.
 */

import { cosineSimilarity, embedTexts } from "~/lib/embeddings";
import type { KnowledgeDocumentEntry, KnowledgeChunk } from "~/lib/db";
import {
    countKnowledgeChunks,
    getAllKnowledgeChunks,
    getKnowledgeDocuments,
    saveKnowledgeChunks,
    saveKnowledgeDocument,
} from "~/lib/db";

export const MAX_DOCUMENT_CHARS = 1_000_000;
export const CHUNK_SIZE = 1000;
export const CHUNK_OVERLAP = 120;
export const MAX_CHUNKS_PER_DOC = 250;
export const MAX_TOTAL_CHUNKS = 4000;
export const EMBED_BATCH_SIZE = 24;
export const MAX_RETRIEVED_CHUNKS = 6;
export const MAX_CONTEXT_CHARS = 12_000;

export interface KnowledgeSearchResult {
    docId: string;
    docName: string;
    text: string;
    score: number;
}

/** Split text into overlapping chunks that respect paragraph boundaries. */
export function chunkText(
    text: string,
    size: number = CHUNK_SIZE,
    overlap: number = CHUNK_OVERLAP,
): string[] {
    const clean = text.replace(/\r\n/g, "\n").trim();
    if (!clean) return [];
    const step = Math.max(1, size - overlap);
    const chunks: string[] = [];
    let start = 0;
    while (start < clean.length) {
        let end = Math.min(start + size, clean.length);
        if (end < clean.length) {
            const window = clean.slice(start, end);
            const boundary = Math.max(window.lastIndexOf("\n"), window.lastIndexOf(" "));
            if (boundary >= size * 0.5) end = start + boundary;
        }
        const chunk = clean.slice(start, end).trim();
        if (chunk) chunks.push(chunk);
        if (end >= clean.length) break;
        start = end - overlap;
    }
    return chunks;
}

function invalidChars(name: string): boolean {
    return /[\u0000-\u001f\u007f]/u.test(name);
}

/**
 * Embed and persist a document as private local knowledge. Runs entirely in
 * the browser; the first call loads the local embedding model on demand.
 */
export async function indexKnowledgeText(
    name: string,
    content: string,
    onProgress?: (done: number, total: number) => void,
): Promise<KnowledgeDocumentEntry> {
    const docName = name.trim();
    if (!docName) throw new Error("Document needs a name.");
    if (invalidChars(docName)) throw new Error("Document name contains invalid characters.");
    const text = content.replace(/\u0000/g, "").trim();
    if (!text) throw new Error("Document content is empty.");
    if (text.length > MAX_DOCUMENT_CHARS) {
        throw new Error(`Documents over ${MAX_DOCUMENT_CHARS.toLocaleString()} characters are not supported.`);
    }

    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error("Document content is empty.");
    if (chunks.length > MAX_CHUNKS_PER_DOC) {
        throw new Error(
            `Document is too large: ${chunks.length} chunks exceeds the ${MAX_CHUNKS_PER_DOC} per-document limit.`,
        );
    }

    const existing = await countKnowledgeChunks();
    if (existing + chunks.length > MAX_TOTAL_CHUNKS) {
        throw new Error(
            `Local knowledge is at capacity (${MAX_TOTAL_CHUNKS} chunks). Delete some documents and retry.`,
        );
    }

    const vectors: Float32Array[] = [];
    for (let offset = 0; offset < chunks.length; offset += EMBED_BATCH_SIZE) {
        const batch = chunks.slice(offset, offset + EMBED_BATCH_SIZE);
        const embedded = await embedTexts(batch);
        for (const vector of embedded) vectors.push(vector);
        onProgress?.(Math.min(offset + batch.length, chunks.length), chunks.length);
    }

    const createdAt = Date.now();
    const docId = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `knowledge_${createdAt}_${docName.slice(0, 24)}`;
    const doc: KnowledgeDocumentEntry = {
        id: docId,
        name: docName,
        content: text,
        size: text.length,
        createdAt,
        chunkCount: chunks.length,
        status: "indexed",
    };
    await saveKnowledgeDocument(doc);

    const records: KnowledgeChunk[] = chunks.map((chunk, index) => ({
        key: `${docId}:${index}`,
        docId,
        index,
        text: chunk,
        vector: vectors[index],
        createdAt,
    }));
    await saveKnowledgeChunks(records);

    return doc;
}

/**
 * Embed a query and return the most similar chunks across all documents,
 * sorted by descending similarity.
 */
export async function searchKnowledge(
    query: string,
    topK: number = MAX_RETRIEVED_CHUNKS,
): Promise<KnowledgeSearchResult[]> {
    const text = query.trim();
    if (!text) return [];
    const chunks = await getAllKnowledgeChunks();
    if (chunks.length === 0) return [];
    const docs = await getKnowledgeDocuments();
    const names = new Map(docs.map((doc) => [doc.id, doc.name]));

    const [queryVector] = await embedTexts([text]);
    const ranked = chunks
        .map((chunk) => ({
            chunk,
            score: cosineSimilarity(queryVector, chunk.vector),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

    return ranked
        .filter(({ score }) => score > 0)
        .map(({ chunk, score }) => ({
            docId: chunk.docId,
            docName: names.get(chunk.docId) ?? "Unknown document",
            text: chunk.text,
            score,
        }));
}

/**
 * Build the quoted context block injected into the system prompt. Returns an
 * empty string when nothing relevant is found or retrieval is unavailable, so
 * chat always fails open.
 */
export async function buildKnowledgeContext(
    query: string,
    topK: number = MAX_RETRIEVED_CHUNKS,
): Promise<string> {
    try {
        const results = await searchKnowledge(query, topK);
        if (results.length === 0) return "";
        const body = results
            .map(
                (result, index) =>
                    `[${index + 1}] From: ${result.docName} (similarity ${result.score.toFixed(2)})\n${result.text}`,
            )
            .join("\n\n")
            .slice(0, MAX_CONTEXT_CHARS);
        return body;
    } catch {
        return "";
    }
}

/** True when at least one document is indexed and searchable. */
export async function hasKnowledgeChunks(): Promise<boolean> {
    try {
        return (await countKnowledgeChunks()) > 0;
    } catch {
        return false;
    }
}

/**
 * Tool-facing executor for the `knowledge_search` tool. Always returns a
 * string the model can read directly, so failures degrade to a clear message
 * instead of a tool error.
 */
export async function searchKnowledgeTool(
    query: string,
    limit?: number,
): Promise<string> {
    try {
        const results = await searchKnowledge(
            query,
            Math.min(Math.max(limit ?? MAX_RETRIEVED_CHUNKS, 1), 10),
        );
        if (results.length === 0) {
            return "No indexed knowledge matched that query. If the document is not indexed yet, ask the user to add it in Settings → Knowledge, or answer from other sources.";
        }
        return results
            .map(
                (result, index) =>
                    `[${index + 1}] From: ${result.docName} (similarity ${result.score.toFixed(2)})\n${result.text}`,
            )
            .join("\n\n")
            .slice(0, MAX_CONTEXT_CHARS);
    } catch (error) {
        console.warn("[knowledge_search]", error);
        return "Local knowledge search is unavailable right now. It requires the browser embedding model, which failed to load in this session.";
    }
}
