/**
 * IndexedDB Database for ai.diy chat persistence
 * Uses `idb` package to persist threads and chat messages client-side.
 */

import { openDB, type DBSchema, type IDBPDatabase, type StoreNames } from "idb";
import { clearStorageIssue, reportStorageFailure } from "~/lib/storage-notices";
import type { ThreadData, MessageData, MemoryEntry, Project } from "~/lib/types";
import type { Artifact } from "~/lib/canvas";
import type { UsageEvent } from "~/lib/usage";
import type { KbChunk, KbDocument } from "~/lib/knowledge/types";
import { deleteLinuxOverlayForScope } from "~/lib/cheerpx";
import { dropShellTextScope } from "~/lib/shell-text.client";

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
    usageEvents: {
        key: string;
        value: UsageEvent;
        indexes: { "by-fingerprint": string; "by-created": number };
    };
    kbDocuments: {
        key: string;
        value: KbDocument;
        indexes: { "by-created": number };
    };
    kbChunks: {
        key: string;
        value: KbChunk;
        indexes: { "by-document": string };
    };
    cryptoKeys: {
        key: string;
        value: { id: string; key: CryptoKey };
    };
}

const DB_NAME = "prismium-lite-db";
const DB_VERSION = 14;
const CRYPTO_KEYS_STORE = "cryptoKeys";
const SETTINGS_KEY_ID = "settings-envelope-v1";

let dbPromise: Promise<IDBPDatabase<PrismiumDB>> | null = null;

function getDB() {
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
                if (!db.objectStoreNames.contains("usageEvents")) {
                    const usageStore = db.createObjectStore("usageEvents", {
                        keyPath: "id",
                    });
                    usageStore.createIndex("by-fingerprint", "keyFingerprint");
                    usageStore.createIndex("by-created", "createdAt");
                }
                if (!db.objectStoreNames.contains("kbDocuments")) {
                    const kbDocs = db.createObjectStore("kbDocuments", {
                        keyPath: "id",
                    });
                    kbDocs.createIndex("by-created", "createdAt");
                }
                if (!db.objectStoreNames.contains("kbChunks")) {
                    const kbChunks = db.createObjectStore("kbChunks", {
                        keyPath: "id",
                    });
                    kbChunks.createIndex("by-document", "documentId");
                }
                // Obsolete WebContainer-era stores (removed feature slice).
                // These never existed in the current schema, so widen to the
                // store-name union only for the legacy cleanup check.
                for (const storeName of [
                    "websiteProjects",
                    "websiteFiles",
                    "workspaces",
                    "workspaceFiles",
                ]) {
                    const legacyStore = storeName as StoreNames<PrismiumDB>;
                    if (db.objectStoreNames.contains(legacyStore)) {
                        db.deleteObjectStore(legacyStore);
                    }
                }
                if (!db.objectStoreNames.contains(CRYPTO_KEYS_STORE)) {
                    db.createObjectStore(CRYPTO_KEYS_STORE, { keyPath: "id" });
                }
            },
        })
            .then((db) => {
                clearStorageIssue("database");
                db.addEventListener("error", (event) => {
                    const target = event.target as IDBRequest;
                    const stores = Array.from(target.transaction?.objectStoreNames ?? []);
                    const resource = stores.some(
                        (name) => name === "messages" || name === "threads",
                    )
                        ? "Chat"
                        : stores.includes("artifacts")
                          ? "Artifact"
                          : stores.includes(CRYPTO_KEYS_STORE)
                            ? "Settings"
                            : "Local storage";
                    reportStorageFailure(`database-write:${resource}`, resource, target.error);
                });
                return db;
            })
            .catch((error) => {
                dbPromise = null;
                reportStorageFailure("database", "Local storage", error);
                throw error;
            });
    }
    return dbPromise;
}

/** AES-GCM envelope key used to encrypt settings at rest (see settings-crypto). */
export async function getSettingsCryptoKey(): Promise<CryptoKey | null> {
    const db = await getDB();
    if (!db) return null;
    try {
        const entry = await db.get(CRYPTO_KEYS_STORE, SETTINGS_KEY_ID);
        return entry?.key ?? null;
    } catch {
        return null;
    }
}

export async function saveSettingsCryptoKey(key: CryptoKey): Promise<boolean> {
    const db = await getDB();
    if (!db) return false;
    try {
        await db.put(CRYPTO_KEYS_STORE, { id: SETTINGS_KEY_ID, key });
        return true;
    } catch {
        return false;
    }
}

export async function deleteSettingsCryptoKey(): Promise<void> {
    const db = await getDB();
    if (!db) return;
    try {
        await db.delete(CRYPTO_KEYS_STORE, SETTINGS_KEY_ID);
    } catch {
        // Ignore — key missing is the same end state.
    }
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
    // Drop the tab-local fast-path shell too (session-only, but no reason to
    // keep a deleted conversation's files in memory).
    dropShellTextScope(threadId);
    // The in-browser Linux VM keeps its filesystem in a separate IndexedDB
    // overlay per scope — remove it so deleted chats leave no VM files behind.
    try {
        await deleteLinuxOverlayForScope(threadId);
    } catch {
        // Quota / private-mode failures: main thread data is already gone.
    }
}

export async function getArtifactsForScope(scopeId: string): Promise<Artifact[]> {
    const db = await getDB();
    if (!db) return [];
    const artifacts = await db.getAllFromIndex("artifacts", "by-scope", scopeId);
    return artifacts.sort((a, b) => a.createdAt - b.createdAt);
}

export async function saveArtifactToDB(scopeId: string, artifact: Artifact): Promise<void> {
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

export async function loadPreviewSession<T>(id: string): Promise<T | null> {
    const db = await getDB();
    if (!db) return null;
    const record = await db.get("previewSessions", id);
    return (record?.data as T | undefined) ?? null;
}

export async function savePreviewSession<T>(id: string, data: T): Promise<void> {
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

export async function putMessagesBatch(
    threadId: string,
    rows: MessageData[],
    deleteIds: string[],
    threadPatch?: Partial<Pick<ThreadData, "model" | "provider" | "updatedAt">>,
): Promise<boolean> {
    const db = await getDB();
    if (!db) return false;
    const tx = db.transaction(["messages", "threads"], "readwrite");
    const messages = tx.objectStore("messages");
    const threads = tx.objectStore("threads");
    const writes: Promise<unknown>[] = [
        ...deleteIds.map((id) => messages.delete(id)),
        ...rows.map((row) => messages.put(row)),
    ];
    if (threadPatch) {
        writes.push(
            threads.get(threadId).then((thread) => {
                if (!thread) return;
                return threads.put({ ...thread, ...threadPatch, id: threadId });
            }),
        );
    }
    await Promise.all([...writes, tx.done]);
    return true;
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

export async function appendUsageEventToDB(event: UsageEvent): Promise<void> {
    const db = await getDB();
    if (!db) return;
    const existing = await db.get("usageEvents", event.id);
    if (existing) return;
    await db.put("usageEvents", event);
    // Best-effort prune so the ledger cannot grow without bound. Never throws —
    // usage recording must not break chat on quota or private-mode failures.
    try {
        await pruneUsageEvents(db);
    } catch {
        // Ignore — next append retries.
    }
}

/**
 * Keep the usage ledger bounded: drop events older than the retention window
 * and cap the total row count (oldest first). Runs after each append.
 */
async function pruneUsageEvents(db: IDBPDatabase<PrismiumDB>, now = Date.now()): Promise<void> {
    const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
    const MAX_EVENTS = 5000;
    const cutoff = now - RETENTION_MS;
    const all = await db.getAll("usageEvents");
    if (all.length === 0) return;
    const staleIds = all.filter((event) => event.createdAt < cutoff).map((event) => event.id);
    let overflowIds: string[] = [];
    const retainedCount = all.length - staleIds.length;
    if (retainedCount > MAX_EVENTS) {
        overflowIds = all
            .filter((event) => event.createdAt >= cutoff)
            .sort((a, b) => a.createdAt - b.createdAt)
            .slice(0, retainedCount - MAX_EVENTS)
            .map((event) => event.id);
    }
    if (staleIds.length === 0 && overflowIds.length === 0) return;
    const tx = db.transaction("usageEvents", "readwrite");
    for (const id of [...staleIds, ...overflowIds]) {
        await tx.store.delete(id);
    }
    await tx.done;
}

export async function getUsageEventsSinceFromDB(
    keyFingerprint: string,
    sinceMs: number,
): Promise<UsageEvent[]> {
    const db = await getDB();
    if (!db) return [];
    const events = await db.getAllFromIndex("usageEvents", "by-fingerprint", keyFingerprint);
    return events
        .filter((event) => event.createdAt >= sinceMs)
        .sort((a, b) => a.createdAt - b.createdAt);
}

export async function getAllKbDocuments(): Promise<KbDocument[]> {
    const db = await getDB();
    if (!db) return [];
    return db.getAll("kbDocuments");
}

export async function getAllKbChunks(): Promise<KbChunk[]> {
    const db = await getDB();
    if (!db) return [];
    return db.getAll("kbChunks");
}

export async function putKbDocumentWithChunks(
    document: KbDocument,
    chunks: KbChunk[],
): Promise<void> {
    const db = await getDB();
    if (!db) return;
    const tx = db.transaction(["kbDocuments", "kbChunks"], "readwrite");
    await tx.objectStore("kbDocuments").put(document);
    const chunkStore = tx.objectStore("kbChunks");
    for (const chunk of chunks) {
        await chunkStore.put(chunk);
    }
    await tx.done;
}

export async function deleteKbDocument(documentId: string): Promise<void> {
    const db = await getDB();
    if (!db) return;
    const tx = db.transaction(["kbDocuments", "kbChunks"], "readwrite");
    await tx.objectStore("kbDocuments").delete(documentId);
    const index = tx.objectStore("kbChunks").index("by-document");
    let cursor = await index.openCursor(documentId);
    while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
    }
    await tx.done;
}

export async function clearKnowledgeBase(): Promise<void> {
    const db = await getDB();
    if (!db) return;
    const tx = db.transaction(["kbDocuments", "kbChunks"], "readwrite");
    await tx.objectStore("kbDocuments").clear();
    await tx.objectStore("kbChunks").clear();
    await tx.done;
}
