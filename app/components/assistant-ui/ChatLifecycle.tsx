/**
 * ChatLifecycle — keeps sidebar thread titles in sync with the live chat.
 * On the first user message of a "New Chat", asks the selected model for a title.
 *
 * Waits until we've observed an empty thread after a switch, so leftover
 * messages from the previous chat can't mistitle the new one.
 */

import { useAui, useAuiState } from "@assistant-ui/react";
import { useEffect, useRef } from "react";

function fallbackTitle(message: string): string {
    const cleaned = message.replace(/\s+/g, " ").trim();
    if (!cleaned) return "New Chat";
    return cleaned.length > 48 ? `${cleaned.slice(0, 45).trimEnd()}…` : cleaned;
}

export function ChatLifecycle({
    threadId,
    threadTitle,
    onTitleChange,
}: {
    threadId: string | null;
    threadTitle: string | null | undefined;
    onTitleChange: (threadId: string, title: string) => void;
}) {
    const aui = useAui();
    const messageCount = useAuiState((s) => s.thread.messages.length);
    const isRunning = useAuiState((s) => s.thread.isRunning);
    const titledForThread = useRef<string | null>(null);
    const pendingTitle = useRef(false);
    /** True once this thread has been empty after becoming active. */
    const sawEmptyForThread = useRef(false);

    useEffect(() => {
        titledForThread.current = null;
        pendingTitle.current = false;
        sawEmptyForThread.current = false;
    }, [threadId]);

    useEffect(() => {
        if (!threadId) return;
        if (messageCount === 0) {
            sawEmptyForThread.current = true;
            return;
        }
        if (!sawEmptyForThread.current) return;
        if (pendingTitle.current) return;
        if (titledForThread.current === threadId) return;
        if (threadTitle && threadTitle !== "New Chat") {
            titledForThread.current = threadId;
            return;
        }

        const messages = aui.thread.getState().messages;
        const firstUser = messages.find((m) => m.role === "user");
        if (!firstUser) return;

        const text = firstUser.content
            .map((p) => ("text" in p && typeof p.text === "string" ? p.text : ""))
            .join(" ")
            .trim();
        if (!text) return;

        pendingTitle.current = true;
        const titleThreadId = threadId;
        onTitleChange(titleThreadId, fallbackTitle(text));
        titledForThread.current = titleThreadId;
        pendingTitle.current = false;
    }, [
        aui,
        threadId,
        threadTitle,
        messageCount,
        isRunning,
        onTitleChange,
    ]);

    return null;
}
