/**
 * ChatSessionContext — exposes useChat helpers to sync/persistence components.
 */

import type { useChat } from "@ai-sdk/react";
import { createContext, useContext, type ReactNode } from "react";

type ChatSessionValue = ReturnType<typeof useChat>;

const PENDING_TOOL_STATES = new Set([
    "input-streaming",
    "input-available",
    "approval-requested",
]);

const ChatSessionContext = createContext<ChatSessionValue | null>(null);

export function ChatSessionProvider({
    value,
    children,
}: {
    value: ChatSessionValue;
    children: ReactNode;
}) {
    return (
        <ChatSessionContext.Provider value={value}>
            {children}
        </ChatSessionContext.Provider>
    );
}

export function useChatSession() {
    const ctx = useContext(ChatSessionContext);
    if (!ctx) {
        throw new Error("useChatSession requires ChatSessionProvider");
    }
    return { chat: ctx };
}

/** True while the model is streaming or a client tool (Linux VM, Python, …) is still open. */
export function isChatGenerating(chat: ChatSessionValue): boolean {
    if (chat.status === "submitted" || chat.status === "streaming") return true;
    for (const message of chat.messages) {
        if (message.role !== "assistant") continue;
        for (const part of message.parts ?? []) {
            const type = part.type ?? "";
            if (type !== "dynamic-tool" && !type.startsWith("tool-")) continue;
            const state =
                "state" in part && typeof part.state === "string"
                    ? part.state
                    : "";
            if (PENDING_TOOL_STATES.has(state)) return true;
        }
    }
    return false;
}

/** Safe outside ChatSessionProvider (returns false). */
export function useChatGenerating(): boolean {
    const ctx = useContext(ChatSessionContext);
    if (!ctx) return false;
    return isChatGenerating(ctx);
}
