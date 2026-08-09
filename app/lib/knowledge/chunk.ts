import type { KbChunk, KbDocument } from "./types";

const KB_CHUNK_CHARS = 1200;
const KB_CHUNK_OVERLAP = 200;

export function chunkText(text: string, documentId: string, documentName: string): Omit<KbChunk, "embedding">[] {
    const cleaned = text.replace(/\r\n/g, "\n").replace(/\t/g, " ").trim();
    if (!cleaned) return [];
    const chunks: Omit<KbChunk, "embedding">[] = [];
    let start = 0;
    let index = 0;
    const now = Date.now();
    while (start < cleaned.length) {
        let end = Math.min(cleaned.length, start + KB_CHUNK_CHARS);
        if (end < cleaned.length) {
            const slice = cleaned.slice(start, end);
            const breakAt = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf(". "), slice.lastIndexOf("\n"));
            if (breakAt > KB_CHUNK_CHARS * 0.4) {
                end = start + breakAt + 1;
            }
        }
        const piece = cleaned.slice(start, end).trim();
        if (piece.length >= 24) {
            chunks.push({
                id: `${documentId}:${index}`,
                documentId,
                documentName,
                index,
                text: piece.slice(0, 4_000),
                createdAt: now,
            });
            index += 1;
        }
        if (end >= cleaned.length) break;
        start = Math.max(end - KB_CHUNK_OVERLAP, start + 1);
    }
    return chunks;
}

export function newDocumentMeta(name: string, mimeType: string, size: number, chunkCount: number): KbDocument {
    return {
        id: `kb_${crypto.randomUUID()}`,
        name,
        mimeType,
        size,
        createdAt: Date.now(),
        chunkCount,
    };
}
