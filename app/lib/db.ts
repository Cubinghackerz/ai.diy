/**
 * IndexedDB Database for ai.diy chat persistence
 * Uses `idb` package to persist threads and chat messages client-side.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ThreadData, MessageData, MemoryEntry } from "~/lib/types";
import type { Artifact } from "~/lib/canvas";

interface PrismiumDB extends DBSchema {
    threads: {
        key: string;
        value: ThreadData;
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
}

const DB_NAME = "prismium-lite-db";
const DB_VERSION = 4;

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

export async function getMemoryEntries(): Promise<MemoryEntry[]> {
    const db = await getDB();
    if (!db) return [];
    const entries = await db.getAllFromIndex("memories", "by-updated");
    return entries.reverse();
}

export async function saveMemoryEntries(entries: MemoryEntry[]): Promise<void> {
    const db = await getDB();
    if (!db || entries.length === 0) return;
    const tx = db.transaction("memories", "readwrite");
    for (const entry of entries) await tx.store.put(entry);
    await tx.done;
}

export async function clearMemoryEntries(): Promise<void> {
    const db = await getDB();
    if (!db) return;
    await db.clear("memories");
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
