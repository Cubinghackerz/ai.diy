import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import type { UIMessage } from "ai";

const holder = vi.hoisted(() => ({
    chat: null as unknown as { status: string; messages: UIMessage[] },
    settings: { chat: { model: "m", provider: "openai" }, memoryEnabled: true },
    indexChatMemories: vi.fn(),
    replaceThreadMessages: vi.fn(),
}));

vi.mock("~/components/assistant-ui/ChatSessionContext", () => ({
    useChatSession: () => ({ chat: holder.chat }),
}));
vi.mock("~/lib/providers/SettingsProvider", () => ({
    useSettings: () => ({ settings: holder.settings }),
}));
vi.mock("~/lib/canvas", () => ({
    useCanvas: () => ({ addArtifact: vi.fn(), setArtifactScope: vi.fn() }),
}));
vi.mock("~/lib/db", () => ({
    getArtifactsForScope: vi.fn(async () => []),
}));
vi.mock("~/lib/chat-store", () => ({
    loadThreadUIMessages: vi.fn(async () => [
        { id: "m1", role: "user", parts: [{ type: "text", text: "hello world of testing" }] },
    ]),
    replaceThreadMessages: holder.replaceThreadMessages,
    uiMessagesToStored: vi.fn(),
}));
vi.mock("~/lib/usage-ledger.client", () => ({
    recordUsageFromMessages: vi.fn(),
}));
vi.mock("~/lib/memory", () => ({
    indexChatMemories: holder.indexChatMemories,
}));

const { ChatThreadSync } = await import("~/components/assistant-ui/ChatThreadSync");

const message: UIMessage = {
    id: "m1",
    role: "user",
    parts: [{ type: "text", text: "hello world of testing" }],
};

/** Holds the chat in state so hydrate's setMessages re-renders and re-arms persistence. */
function SyncHarness() {
    const [chat, setChat] = useState({
        status: "ready",
        messages: [message],
        setMessages: (next: UIMessage[]) => setChat((c) => ({ ...c, messages: next })),
    });
    holder.chat = chat;
    return <ChatThreadSync threadId="thread_memory_gate" />;
}

// Real timers: the hydrate setMessages update sits in React's act queue until
// the act scope exits, so the persist debounce (400 ms) is only scheduled once
// the first act flushes. Settle is therefore two phases: flush hydrate+render,
// then wait out the debounce in a second act.
async function settle() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
    });
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 600));
    });
}

beforeEach(() => {
    holder.indexChatMemories.mockClear();
    holder.replaceThreadMessages.mockClear();
});

describe("auto-memory gate", () => {
    it("does not index chat memories when memory is disabled", async () => {
        holder.settings = { chat: { model: "m", provider: "openai" }, memoryEnabled: false };
        render(<SyncHarness />);
        await settle();
        expect(holder.replaceThreadMessages).toHaveBeenCalled();
        expect(holder.indexChatMemories).not.toHaveBeenCalled();
    });

    it("indexes chat memories when memory is enabled", async () => {
        holder.settings = { chat: { model: "m", provider: "openai" }, memoryEnabled: true };
        render(<SyncHarness />);
        await settle();
        expect(holder.indexChatMemories).toHaveBeenCalledTimes(1);
    });
});
