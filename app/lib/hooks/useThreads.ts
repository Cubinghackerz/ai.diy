/**
 * useThreads — IndexedDB chat threads with sensible create/select/delete logic
 */

import { useState, useEffect, useCallback } from "react";
import type { ThreadData } from "~/lib/types";
import {
    getAllThreads,
    saveThread,
    deleteThreadFromDB,
    getThreadMessages,
} from "~/lib/db";

async function createBlankThread(title = "New Chat") {
    const newThread: ThreadData = {
        id: `thread_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    await saveThread(newThread);
    return newThread;
}

export function useThreads() {
    const [threads, setThreads] = useState<ThreadData[]>([]);
    const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshThreads = useCallback(async () => {
        const list = await getAllThreads();
        setThreads(list);
        setLoading(false);
        return list;
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const list = await refreshThreads();
            if (cancelled) return;
            if (list.length === 0) {
                const blank = await createBlankThread();
                if (!cancelled) {
                    setActiveThreadId(blank.id);
                    await refreshThreads();
                }
            } else {
                setActiveThreadId((prev) => prev ?? list[0].id);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [refreshThreads]);

    /**
     * Always land on an empty "New Chat".
     * Reuse an unused blank thread when possible; otherwise create one.
     * Bumps updatedAt so it sorts to the top of the sidebar.
     */
    const createNewThread = useCallback(
        async (title = "New Chat") => {
            const list = await getAllThreads();

            // If the current thread is already an empty New Chat, just focus it.
            if (activeThreadId) {
                const current = list.find((t) => t.id === activeThreadId);
                if (current && current.title === "New Chat") {
                    const msgs = await getThreadMessages(current.id);
                    if (msgs.length === 0) {
                        const bumped = {
                            ...current,
                            updatedAt: Date.now(),
                        };
                        await saveThread(bumped);
                        setActiveThreadId(current.id);
                        await refreshThreads();
                        return current.id;
                    }
                }
            }

            for (const t of list) {
                if (t.id === activeThreadId) continue;
                if (t.title !== "New Chat" && t.title !== title) continue;
                const msgs = await getThreadMessages(t.id);
                if (msgs.length === 0) {
                    const bumped = { ...t, title, updatedAt: Date.now() };
                    await saveThread(bumped);
                    setActiveThreadId(t.id);
                    await refreshThreads();
                    return t.id;
                }
            }

            const blank = await createBlankThread(title);
            setActiveThreadId(blank.id);
            await refreshThreads();
            return blank.id;
        },
        [activeThreadId, refreshThreads],
    );

    const deleteThread = useCallback(
        async (id: string) => {
            await deleteThreadFromDB(id);
            const list = await refreshThreads();
            if (activeThreadId === id) {
                if (list.length > 0) {
                    setActiveThreadId(list[0].id);
                } else {
                    const blank = await createBlankThread();
                    setActiveThreadId(blank.id);
                    await refreshThreads();
                }
            }
        },
        [activeThreadId, refreshThreads],
    );

    const updateThreadTitle = useCallback(async (id: string, title: string) => {
        const updatedAt = Date.now();
        setThreads((prev) =>
            prev.map((t) => (t.id === id ? { ...t, title, updatedAt } : t)),
        );
        const list = await getAllThreads();
        const existing = list.find((t) => t.id === id);
        if (existing) {
            await saveThread({ ...existing, title, updatedAt });
        }
    }, []);

    return {
        threads,
        activeThreadId,
        setActiveThreadId,
        createNewThread,
        deleteThread,
        updateThreadTitle,
        loading,
        refreshThreads,
    };
}
