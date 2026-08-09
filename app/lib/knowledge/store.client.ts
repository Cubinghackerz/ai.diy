import { getAllKbChunks, getAllKbDocuments, putKbDocumentWithChunks, deleteKbDocument, clearKnowledgeBase } from "~/lib/db";
import { chunkText, newDocumentMeta } from "./chunk";
import { embedTexts, embedQuery } from "./embed.client";
import { searchChunksHnsw } from "./index.client";
import type { KbDocument } from "./types";
import type { KbHit } from "./index.client";

export async function listKnowledgeDocuments(): Promise<KbDocument[]> {
    const docs = await getAllKbDocuments();
    return docs.sort((a, b) => b.createdAt - a.createdAt);
}

export async function ingestTextFile(file: File): Promise<KbDocument> {
    const text = await file.text();
    if (!text.trim()) {
        throw new Error("File is empty or not readable as text.");
    }
    const draftId = `kb_${crypto.randomUUID()}`;
    const pieces = chunkText(text, draftId, file.name);
    if (!pieces.length) {
        throw new Error("Could not extract usable text chunks from this file.");
    }
    const embeddings = await embedTexts(pieces.map((p) => p.text));
    const chunks = pieces.map((piece, i) => ({
        ...piece,
        embedding: embeddings[i] ?? [],
    }));
    const doc = newDocumentMeta(
        file.name,
        file.type || "text/plain",
        file.size,
        chunks.length,
    );
    // Re-stamp chunk ids with final document id
    const finalized = chunks.map((chunk, index) => ({
        ...chunk,
        id: `${doc.id}:${index}`,
        documentId: doc.id,
    }));
    await putKbDocumentWithChunks(doc, finalized);
    return doc;
}

export async function removeKnowledgeDocument(id: string): Promise<void> {
    await deleteKbDocument(id);
}

export async function wipeKnowledgeBase(): Promise<void> {
    await clearKnowledgeBase();
}

export async function knowledgeSearch(query: string, k = 5): Promise<KbHit[]> {
    const q = query.trim();
    if (!q) return [];
    const chunks = await getAllKbChunks();
    if (!chunks.length) return [];
    const embedding = await embedQuery(q);
    if (!embedding.length) return [];
    return searchChunksHnsw(chunks, embedding, Math.min(8, Math.max(1, k)));
}

export async function readLocalKnowledge(query?: string): Promise<string> {
    const hits = await knowledgeSearch(query?.trim() || "overview notes summary", query?.trim() ? 5 : 3);
    if (!hits.length) {
        return "No local knowledge documents indexed yet. Upload text, Markdown, or notes in Settings → Knowledge Base.";
    }
    return hits
        .map((hit, i) => {
            const score = hit.score.toFixed(3);
            return `${i + 1}. [${hit.chunk.documentName} #${hit.chunk.index}] (score ${score})\n${hit.chunk.text}`;
        })
        .join("\n\n");
}

export async function buildLocalKnowledgeContext(
    query: string,
    maxChars = 2_500,
): Promise<string> {
    const hits = await knowledgeSearch(query, 4);
    if (!hits.length) return "";
    const blocks: string[] = [];
    let used = 0;
    for (const hit of hits) {
        const block = `[${hit.chunk.documentName}] ${hit.chunk.text}`;
        if (used + block.length > maxChars) break;
        blocks.push(block);
        used += block.length;
    }
    if (!blocks.length) return "";
    return `Local knowledge (private, on-device retrieval):\n${blocks.join("\n---\n")}`;
}
