/**
 * ChatSessionContext — exposes useChat helpers to sync/persistence components.
 */

import type { useChat } from "@ai-sdk/react";
import { createContext, useContext, type ReactNode } from "react";

type ChatSessionValue = ReturnType<typeof useChat>;

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
