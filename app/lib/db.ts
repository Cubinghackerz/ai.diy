/**
 * IndexedDB Database for ai.diy chat persistence
 * Uses `idb` package to persist threads and chat messages client-side.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ThreadData, MessageData, MemoryEntry, Project } from "~/lib/types";
import type { Artifact } from "~/lib/canvas";

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
}

const DB_NAME = "prismium-lite-db";
const DB_VERSION = 5;

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

export type ThreadSearchResult = {
    thread: ThreadData;
    snippet: string;
    matchedIn: "title" | "message";
};

function messageSnippet(content: string, query: string): string {
    const lower = content.toLowerCase();
    const index = lower.indexOf(query);
    if (index === -1) return content.slice(0, 90);
    const start = Math.max(0, index - 40);
    const end = Math.min(content.length, index + query.length + 50);
    const prefix = start > 0 ? "…" : "";
    const suffix = end < content.length ? "…" : "";
    return `${prefix}${content.slice(start, end)}${suffix}`;
}

/**
 * Full-text search over persisted thread titles and message content.
 * Case-insensitive, bounded per-thread and overall, sorted by thread recency.
 */
export async function searchThreadsAndMessages(
    query: string,
    opts?: { maxPerThread?: number; maxResults?: number },
): Promise<ThreadSearchResult[]> {
    const db = await getDB();
    if (!db) return [];
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const maxPerThread = opts?.maxPerThread ?? 3;
    const maxResults = opts?.maxResults ?? 40;

    const [threads, allMessages] = await Promise.all([
        db.getAll("threads"),
        db.getAll("messages"),
    ]);
    const threadById = new Map(threads.map((t) => [t.id, t]));
    const results: ThreadSearchResult[] = [];
    const perThread = new Map<string, number>();

    for (const thread of threads) {
        if (thread.title.toLowerCase().includes(q)) {
            results.push({
                thread,
                snippet: thread.title,
                matchedIn: "title",
            });
            perThread.set(thread.id, 1);
        }
    }

    if (results.length < maxResults) {
        for (const message of allMessages) {
            if (message.role === "tool") continue;
            const content = message.content ?? "";
            if (!content || !content.toLowerCase().includes(q)) continue;
            const thread = threadById.get(message.threadId);
            if (!thread) continue;
            const count = perThread.get(thread.id) ?? 0;
            if (count >= maxPerThread) continue;
            perThread.set(thread.id, count + 1);
            results.push({
                thread,
                snippet: messageSnippet(content, q),
                matchedIn: "message",
            });
            if (results.length >= maxResults) break;
        }
    }

    // Stable sort: thread recency desc, title matches stay before message
    // matches within the same thread.
    return results.sort(
        (a, b) => b.thread.updatedAt - a.thread.updatedAt,
    );
}
