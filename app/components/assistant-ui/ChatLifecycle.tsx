/**
 * ChatLifecycle — keeps sidebar thread titles in sync with the live chat.
 * On the first user message of a "New Chat", asks the selected model for a title.
 *
 * Waits until we've observed an empty thread after a switch, so leftover
 * messages from the previous chat can't mistitle the new one.
 */

import { useRuntimeSyncTick } from "~/components/assistant-ui/RuntimeSync";
import { useAui } from "@assistant-ui/react";
import { useEffect, useRef } from "react";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { isLocalProvider } from "~/lib/setup";

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
    const tick = useRuntimeSyncTick();
    const { settings } = useSettings();
    const messageCount = aui.thread.getState().messages.length;
    const isRunning = aui.thread.getState().isRunning;
    void tick;
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
        const provider = settings.chat.provider;
        const providerConfig = settings.providers[provider];
        const apiKey =
            providerConfig?.apiKey ||
            (isLocalProvider(provider)
                ? provider === "ollama"
                    ? "ollama"
                    : "custom"
                : "");
        const titleThreadId = threadId;

        void (async () => {
            try {
                const res = await fetch("/api/title", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        message: text,
                        model: settings.chat.model,
                        provider,
                        apiKey,
                        baseUrl: providerConfig?.baseUrl || undefined,
                    }),
                });
                const data = (await res.json()) as {
                    title?: string;
                };
                const title = data.title?.trim();
                if (title && titleThreadId === threadId) {
                    onTitleChange(titleThreadId, title);
                    titledForThread.current = titleThreadId;
                }
            } catch {
                // Keep "New Chat" if title generation fails
            } finally {
                pendingTitle.current = false;
            }
        })();
    }, [
        aui,
        threadId,
        threadTitle,
        messageCount,
        isRunning,
        settings.chat.model,
        settings.chat.provider,
        settings.providers,
        onTitleChange,
    ]);

    return null;
}
