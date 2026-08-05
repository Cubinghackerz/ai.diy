/**
 * IndexedDB Database for ai.diy chat persistence
 * Uses `idb` package to persist threads and chat messages client-side.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ThreadData, MessageData, MemoryEntry, Project } from "~/lib/types";
import type { Artifact } from "~/lib/canvas";

export interface EmbeddingCacheEntry {
    key: string;
    text: string;
    vector: Float32Array;
    createdAt: number;
}

/** A user-added document stored for local semantic retrieval. */
export interface KnowledgeDocumentEntry {
    id: string;
    name: string;
    content: string;
    size: number;
    createdAt: number;
    chunkCount: number;
    status: "indexed" | "error";
    error?: string;
}

/** A single vectorized chunk of a knowledge document. */
export interface KnowledgeChunk {
    /** `${docId}:${index}` */
    key: string;
    docId: string;
    index: number;
    text: string;
    vector: Float32Array;
    createdAt: number;
}

interface PrismiumDB extends DBSchema {
    threads: {
        key: string;
        value: ThreadData;
        indexes: { "by-updated": number };
    };
    projects: {
        key: string;
        value: Project;
        indexes: { "by-updated": number };
    };
    messages: {
        key: string;
        value: MessageData;
        indexes: { "by-thread": string; "by-created": number };
    };
    artifacts: {
        key: string;
        value: Artifact;
        indexes: { "by-scope": string; "by-created": number };
    };
    previewSessions: {
        key: string;
        value: { id: string; data: unknown; updatedAt: number };
        indexes: { "by-updated": number };
    };
    memories: {
        key: string;
        value: MemoryEntry;
        indexes: { "by-updated": number; "by-source": string };
    };
    modelCatalog: {
        key: string;
        value: { id: string; data: unknown; updatedAt: number };
        indexes: { "by-updated": number };
    };
    embeddings: {
        key: string;
        value: EmbeddingCacheEntry;
        indexes: { "by-created": number };
    };
    knowledgeDocs: {
        key: string;
        value: KnowledgeDocumentEntry;
    };
    knowledgeChunks: {
        key: string;
        value: KnowledgeChunk;
        indexes: { "by-doc": string };
    };
}

const DB_NAME = "prismium-lite-db";
const DB_VERSION = 8;
const MAX_EMBEDDING_CACHE_ENTRIES = 5000;

let dbPromise: Promise<IDBPDatabase<PrismiumDB>> | null = null;

export function getDB() {
    if (typeof window === "undefined") return null;
    if (!dbPromise) {
        dbPromise = openDB<PrismiumDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains("threads")) {
                    const threadStore = db.createObjectStore("threads", { keyPath: "id" });
                    threadStore.createIndex("by-updated", "updatedAt");
                }
                if (!db.objectStoreNames.contains("messages")) {
                    const msgStore = db.createObjectStore("messages", { keyPath: "id" });
                    msgStore.createIndex("by-thread", "threadId");
                    msgStore.createIndex("by-created", "createdAt");
                }
                if (!db.objectStoreNames.contains("artifacts")) {
                    const artifactStore = db.createObjectStore("artifacts", {
                        keyPath: "id",
                    });
                    artifactStore.createIndex("by-scope", "scopeId");
                    artifactStore.createIndex("by-created", "createdAt");
                }
                if (!db.objectStoreNames.contains("previewSessions")) {
                    const previewStore = db.createObjectStore("previewSessions", {
                        keyPath: "id",
                    });
                    previewStore.createIndex("by-updated", "updatedAt");
                }
                if (!db.objectStoreNames.contains("memories")) {
                    const memoryStore = db.createObjectStore("memories", {
                        keyPath: "id",
                    });
                    memoryStore.createIndex("by-updated", "updatedAt");
                    memoryStore.createIndex("by-source", "source");
                }
                if (!db.objectStoreNames.contains("projects")) {
                    const projectStore = db.createObjectStore("projects", {
                        keyPath: "id",
                    });
                    projectStore.createIndex("by-updated", "updatedAt");
                }
                if (!db.objectStoreNames.contains("modelCatalog")) {
                    const catalogStore = db.createObjectStore("modelCatalog", {
                        keyPath: "id",
                    });
                    catalogStore.createIndex("by-updated", "updatedAt");
                }
                if (!db.objectStoreNames.contains("embeddings")) {
                    const embeddingStore = db.createObjectStore("embeddings", {
                        keyPath: "key",
                    });
                    embeddingStore.createIndex("by-created", "createdAt");
                }
                if (!db.objectStoreNames.contains("knowledgeDocs")) {
                    db.createObjectStore("knowledgeDocs", { keyPath: "id" });
                }
                if (!db.objectStoreNames.contains("knowledgeChunks")) {
                    const chunkStore = db.createObjectStore("knowledgeChunks", {
                        keyPath: "key",
                    });
                    chunkStore.createIndex("by-doc", "docId");
                }
            },
        });
    }
    return dbPromise;
}

export async function getAllThreads(): Promise<ThreadData[]> {
    const db = await getDB();
    if (!db) return [];
    const threads = await db.getAllFromIndex("threads", "by-updated");
    return threads.reverse();
}

export async function saveThread(thread: ThreadData): Promise<void> {
    const db = await getDB();
    if (!db) return;
    await db.put("threads", thread);
}

export async function deleteThreadFromDB(threadId: string): Promise<void> {
    const db = await getDB();
    if (!db) return;
    await db.delete("threads", threadId);
    const tx = db.transaction("messages", "readwrite");
    const index = tx.store.index("by-thread");
    let cursor = await index.openCursor(threadId);
    while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
    }
    await tx.done;
    await deleteArtifactsForScope(threadId);
}

export async function getArtifactsForScope(scopeId: string): Promise<Artifact[]> {
    const db = await getDB();
    if (!db) return [];
    const artifacts = await db.getAllFromIndex("artifacts", "by-scope", scopeId);
    return artifacts.sort((a, b) => a.createdAt - b.createdAt);
}

export async function saveArtifactToDB(
    scopeId: string,
    artifact: Artifact,
): Promise<void> {
    const db = await getDB();
    if (!db) return;
    await db.put("artifacts", { ...artifact, scopeId });
}

export async function deleteArtifactsForScope(scopeId: string): Promise<void> {
    const db = await getDB();
    if (!db) return;
    const tx = db.transaction("artifacts", "readwrite");
    const index = tx.store.index("by-scope");
    let cursor = await index.openCursor(scopeId);
    while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
    }
    await tx.done;
}

export async function deleteAllArtifacts(): Promise<void> {
    const db = await getDB();
    if (!db) return;
    await db.clear("artifacts");
}

export async function loadPreviewSession<T>(id: string): Promise<T | null> {
    const db = await getDB();
    if (!db) return null;
    const record = await db.get("previewSessions", id);
    return (record?.data as T | undefined) ?? null;
}

export async function savePreviewSession<T>(
    id: string,
    data: T,
): Promise<void> {
    const db = await getDB();
    if (!db) return;
    await db.put("previewSessions", { id, data, updatedAt: Date.now() });
}

export async function deletePreviewSession(id: string): Promise<void> {
    const db = await getDB();
    if (!db) return;
    await db.delete("previewSessions", id);
}

/** Export all local-first application data for an explicit user backup. */
export async function exportLocalBackup(): Promise<{
    version: 1;
    exportedAt: string;
    threads: ThreadData[];
    messages: MessageData[];
    artifacts: Artifact[];
    previewSessions: Array<{ id: string; data: unknown; updatedAt: number }>;
    memories: MemoryEntry[];
    projects: Project[];
}> {
    const db = await getDB();
    if (!db) {
        return {
            version: 1,
            exportedAt: new Date().toISOString(),
            threads: [],
            messages: [],
            artifacts: [],
            previewSessions: [],
            memories: [],
            projects: [],
        };
    }
    const [threads, messages, artifacts, previewSessions, memories, projects] = await Promise.all([
        db.getAll("threads"),
        db.getAll("messages"),
        db.getAll("artifacts"),
        db.getAll("previewSessions"),
        db.getAll("memories"),
        db.getAll("projects"),
    ]);
    return {
        version: 1,
        exportedAt: new Date().toISOString(),
        threads,
        messages,
        artifacts,
        previewSessions,
        memories,
        projects,
    };
}

export async function getMemoryEntries(): Promise<MemoryEntry[]> {
    const db = await getDB();
    if (!db) return [];
    const entries = await db.getAllFromIndex("memories", "by-updated");
    return entries.reverse();
}

export async function saveMemoryEntries(entries: MemoryEntry[]): Promise<void> {
    const db = await getDB();
    if (entries.length === 0) return;
    if (!db) throw new Error("Local memory storage is unavailable in this browser.");
    const tx = db.transaction("memories", "readwrite");
    for (const entry of entries) await tx.store.put(entry);
    const retained = (await tx.store.getAll())
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 500);
    const retainedIds = new Set(retained.map((entry) => entry.id));
    for (const entry of await tx.store.getAll()) {
        if (!retainedIds.has(entry.id)) await tx.store.delete(entry.id);
    }
    await tx.done;
}

export async function clearMemoryEntries(): Promise<void> {
    const db = await getDB();
    if (!db) return;
    await db.clear("memories");
}

export async function getAllProjects(): Promise<Project[]> {
    const db = await getDB();
    if (!db) return [];
    const projects = await db.getAllFromIndex("projects", "by-updated");
    return projects.reverse();
}

export async function saveProject(project: Project): Promise<void> {
    const db = await getDB();
    if (!db) return;
    await db.put("projects", project);
}

/** Deletes a project and unassigns every thread that belonged to it. */
export async function deleteProjectFromDB(projectId: string): Promise<void> {
    const db = await getDB();
    if (!db) return;
    await db.delete("projects", projectId);
    const tx = db.transaction("threads", "readwrite");
    const threads = await tx.store.getAll();
    for (const thread of threads) {
        if (thread.projectId === projectId) {
            await tx.store.put({ ...thread, projectId: null });
        }
    }
    await tx.done;
}

export async function getThreadMessages(threadId: string): Promise<MessageData[]> {
    const db = await getDB();
    if (!db) return [];
    return db.getAllFromIndex("messages", "by-thread", threadId);
}

export async function saveMessageToDB(msg: MessageData): Promise<void> {
    const db = await getDB();
    if (!db) return;
    await db.put("messages", msg);
}

export async function deleteMessageFromDB(messageId: string): Promise<void> {
    const db = await getDB();
    if (!db) return;
    await db.delete("messages", messageId);
}

/** Cached models.dev catalog snapshot (keyed "catalog", single row). */
export async function getModelCatalogCache(): Promise<{
    data: unknown;
    updatedAt: number;
} | null> {
    const db = await getDB();
    if (!db) return null;
    const row = await db.get("modelCatalog", "catalog");
    return row ? { data: row.data, updatedAt: row.updatedAt } : null;
}

export async function saveModelCatalogCache(data: unknown): Promise<void> {
    const db = await getDB();
    if (!db) return;
    await db.put("modelCatalog", {
        id: "catalog",
        data,
        updatedAt: Date.now(),
    });
}

/** Estimate the byte size of a value via structural serialization. */
function estimateSize(value: unknown): number {
    try {
        return new Blob([JSON.stringify(value)]).size;
    } catch {
        return 0;
    }
}

/** Estimate total IndexedDB usage broken down by object store. */
export interface DbStoreUsage {
    store: string;
    count: number;
    bytes: number;
}

export interface DbUsageSummary {
    stores: DbStoreUsage[];
    totalBytes: number;
    totalCount: number;
}

export async function estimateDbUsage(): Promise<DbUsageSummary> {
    const db = await getDB();
    if (!db) {
        return { stores: [], totalBytes: 0, totalCount: 0 };
    }

    const storeNames = [
        "threads",
        "messages",
        "artifacts",
        "previewSessions",
        "memories",
        "projects",
        "modelCatalog",
        "embeddings",
        "knowledgeDocs",
        "knowledgeChunks",
    ] as const;

    const stores: DbStoreUsage[] = [];
    let totalBytes = 0;
    let totalCount = 0;

    for (const storeName of storeNames) {
        if (!db.objectStoreNames.contains(storeName)) continue;
        const values = await db.getAll(storeName);
        const bytes = values.reduce((sum, v) => sum + estimateSize(v), 0);
        stores.push({
            store: storeName,
            count: values.length,
            bytes,
        });
        totalBytes += bytes;
        totalCount += values.length;
    }

    return { stores, totalBytes, totalCount };
}

export async function getEmbeddingCacheEntry(
    key: string,
): Promise<EmbeddingCacheEntry | null> {
    const db = await getDB();
    if (!db) return null;
    return (await db.get("embeddings", key)) ?? null;
}

export async function saveEmbeddingCacheEntry(entry: EmbeddingCacheEntry): Promise<void> {
    const db = await getDB();
    if (!db) return;
    const tx = db.transaction("embeddings", "readwrite");
    await tx.store.put(entry);
    while ((await tx.store.count()) > MAX_EMBEDDING_CACHE_ENTRIES) {
        const oldest = await tx.store.index("by-created").openCursor();
        if (!oldest) break;
        await oldest.delete();
    }
    await tx.done;
}

export async function countEmbeddingCacheEntries(): Promise<number> {
    const db = await getDB();
    if (!db) return 0;
    return db.count("embeddings");
}

export async function clearEmbeddingCacheEntries(): Promise<void> {
    const db = await getDB();
    if (!db) return;
    await db.clear("embeddings");
}

export async function getKnowledgeDocuments(): Promise<KnowledgeDocumentEntry[]> {
    const db = await getDB();
    if (!db) return [];
    return (await db.getAll("knowledgeDocs")).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getKnowledgeDocument(
    docId: string,
): Promise<KnowledgeDocumentEntry | null> {
    const db = await getDB();
    if (!db) return null;
    return (await db.get("knowledgeDocs", docId)) ?? null;
}

export async function saveKnowledgeDocument(doc: KnowledgeDocumentEntry): Promise<void> {
    const db = await getDB();
    if (!db) return;
    await db.put("knowledgeDocs", doc);
}

export async function getKnowledgeChunks(docId: string): Promise<KnowledgeChunk[]> {
    const db = await getDB();
    if (!db) return [];
    const chunks = await db.getAllFromIndex("knowledgeChunks", "by-doc", docId);
    return chunks.sort((a, b) => a.index - b.index);
}

export async function getAllKnowledgeChunks(): Promise<KnowledgeChunk[]> {
    const db = await getDB();
    if (!db) return [];
    return db.getAll("knowledgeChunks");
}

export async function saveKnowledgeChunks(chunks: KnowledgeChunk[]): Promise<void> {
    const db = await getDB();
    if (!chunks.length) return;
    if (!db) return;
    const tx = db.transaction("knowledgeChunks", "readwrite");
    for (const chunk of chunks) await tx.store.put(chunk);
    await tx.done;
}

export async function countKnowledgeChunks(): Promise<number> {
    const db = await getDB();
    if (!db) return 0;
    return db.count("knowledgeChunks");
}

export async function deleteKnowledgeDocument(docId: string): Promise<void> {
    const db = await getDB();
    if (!db) return;
    await db.delete("knowledgeDocs", docId);
    const tx = db.transaction("knowledgeChunks", "readwrite");
    const index = tx.store.index("by-doc");
    let cursor = await index.openCursor(docId);
    while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
    }
    await tx.done;
}

export async function clearAllKnowledge(): Promise<void> {
    const db = await getDB();
    if (!db) return;
    await db.clear("knowledgeDocs");
    await db.clear("knowledgeChunks");
}

/** Estimate localStorage usage (our own keys only). */
export interface LocalStorageUsage {
    key: string;
    bytes: number;
}

export function estimateLocalStorageUsage(): LocalStorageUsage[] {
    if (typeof window === "undefined") return [];
    const results: LocalStorageUsage[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith("prismium-lite:")) continue;
        const value = localStorage.getItem(key) ?? "";
        results.push({ key, bytes: new Blob([value]).size });
    }
    return results;
}

/** Format bytes into a human-readable string. */
export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
    return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
}
