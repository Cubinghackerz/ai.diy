/**
 * ChatSessionContext — exposes useChat helpers to sync/persistence components.
 */

import type { useChat } from "@ai-sdk/react";
import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react";
import { abortLinuxExecution } from "~/lib/cheerpx";

type ChatSessionValue = ReturnType<typeof useChat>;

const PENDING_TOOL_STATES = new Set([
    "input-streaming",
    "input-available",
    "approval-requested",
]);

let generationStoppedUi = false;
const stopUiListeners = new Set<() => void>();

function setGenerationStoppedUi(next: boolean): void {
    if (generationStoppedUi === next) return;
    generationStoppedUi = next;
    for (const listener of stopUiListeners) listener();
}

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

export function clearGenerationStopUi(): void {
    setGenerationStoppedUi(false);
}

function settlePendingClientTools(chat: ChatSessionValue): void {
    const addToolOutput = chat.addToolOutput as unknown as
        | ((args: {
              tool: string;
              toolCallId: string;
              state: "output-available";
              output: string;
          }) => void)
        | undefined;
    if (!addToolOutput) return;
    for (const message of chat.messages) {
        if (message.role !== "assistant") continue;
        for (const part of message.parts ?? []) {
            const type = part.type ?? "";
            if (type !== "dynamic-tool" && !type.startsWith("tool-")) continue;
            const state =
                "state" in part && typeof part.state === "string"
                    ? part.state
                    : "";
            if (!PENDING_TOOL_STATES.has(state)) continue;
            const toolCallId =
                "toolCallId" in part && typeof part.toolCallId === "string"
                    ? part.toolCallId
                    : "";
            if (!toolCallId) continue;
            const tool =
                "toolName" in part && typeof part.toolName === "string"
                    ? part.toolName
                    : type.replace(/^tool-/, "");
            addToolOutput({
                tool,
                toolCallId,
                state: "output-available",
                output: "Stopped by user.",
            });
        }
    }
}

/** Abort the VM, stop the stream, and unlock the composer immediately. */
export function stopChatGeneration(chat: ChatSessionValue): void {
    setGenerationStoppedUi(true);
    abortLinuxExecution();
    void chat.stop();
    settlePendingClientTools(chat);
}

/** True while the model is streaming or a client tool (Linux VM, Python, …) is still open. */
export function isChatGenerating(chat: ChatSessionValue): boolean {
    if (generationStoppedUi) return false;
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
    const [, setTick] = useState(0);
    useEffect(() => {
        const sync = () => setTick((value) => value + 1);
        stopUiListeners.add(sync);
        return () => {
            stopUiListeners.delete(sync);
        };
    }, []);
    if (!ctx) return false;
    return isChatGenerating(ctx);
}
