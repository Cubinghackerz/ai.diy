/**
 * Local knowledge base — private RAG over browser-stored documents.
 * Embeddings run on-device via transformers.js; vectors stay in IndexedDB.
 */

export type KbDocument = {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    createdAt: number;
    chunkCount: number;
};

export type KbChunk = {
    id: string;
    documentId: string;
    documentName: string;
    index: number;
    text: string;
    embedding: number[];
    createdAt: number;
};

export const KB_EMBEDDING_DIM = 384;
export const KB_MODEL_ID = "Xenova/all-MiniLM-L6-v2";
export const KB_CHUNK_CHARS = 1200;
export const KB_CHUNK_OVERLAP = 200;
