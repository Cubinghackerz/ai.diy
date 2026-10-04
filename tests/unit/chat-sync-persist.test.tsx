import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import type { UIMessage } from "ai";
import { sanitizeRestoredMessages } from "~/lib/chat-store";

const holder = vi.hoisted(() => ({
    chat: null as unknown as {
        status: string;
        messages: UIMessage[];
        setMessages: (next: UIMessage[]) => void;
    },
    settings: { chat: { model: "m", provider: "openai" }, memoryEnabled: true },
    replaceThreadMessages: vi.fn(async () => undefined),
    recordUsageFromMessages: vi.fn(),
    indexChatMemories: vi.fn(),
    patchChat: (_patch: { status?: string; messages?: UIMessage[] }) => {},
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
vi.mock("~/lib/chat-store", async () => {
    const actual = await vi.importActual<typeof import("~/lib/chat-store")>("~/lib/chat-store");
    return {
        ...actual,
        replaceThreadMessages: holder.replaceThreadMessages,
        loadThreadUIMessages: vi.fn(async () => holder.chat?.messages ?? []),
        uiMessagesToStored: vi.fn(() => []),
    };
});
vi.mock("~/lib/usage-ledger.client", () => ({
    recordUsageFromMessages: holder.recordUsageFromMessages,
}));
vi.mock("~/lib/memory", () => ({
    indexChatMemories: holder.indexChatMemories,
}));

const { ChatThreadSync } = await import("~/components/assistant-ui/ChatThreadSync");

const message: UIMessage = {
    id: "m1",
    role: "user",
    parts: [{ type: "text", text: "hello" }],
};

function Harness({ status }: { status: string }) {
    const [chat, setChat] = useState({
        status,
        messages: [message],
        setMessages: (next: UIMessage[]) => setChat((current) => ({ ...current, messages: next })),
    });
    holder.chat = chat;
    holder.patchChat = (patch) => setChat((current) => ({ ...current, ...patch }));
    return <ChatThreadSync threadId="thread_persist" />;
}

async function flushHydrate() {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    });
}

beforeEach(() => {
    vi.useFakeTimers();
    holder.replaceThreadMessages.mockClear();
    holder.recordUsageFromMessages.mockClear();
    holder.indexChatMemories.mockClear();
    holder.settings = { chat: { model: "m", provider: "openai" }, memoryEnabled: true };
});

afterEach(() => {
    vi.useRealTimers();
});

describe("crash-safe chat persistence", () => {
    it("saves immediately when status becomes submitted", async () => {
        render(<Harness status="submitted" />);
        await flushHydrate();
        expect(holder.replaceThreadMessages).toHaveBeenCalled();
        expect(holder.recordUsageFromMessages).not.toHaveBeenCalled();
        expect(holder.indexChatMemories).not.toHaveBeenCalled();
    });

    it("throttles streaming saves and skips an unchanged snapshot", async () => {
        render(<Harness status="ready" />);
        await flushHydrate();
        await act(async () => {
            vi.advanceTimersByTime(400);
        });
        holder.replaceThreadMessages.mockClear();
        holder.indexChatMemories.mockClear();
        holder.recordUsageFromMessages.mockClear();

        const streamed: UIMessage[] = [
            message,
            {
                id: "a1",
                role: "assistant",
                parts: [{ type: "text", text: "M", state: "streaming" }],
            },
        ];
        await act(async () => {
            holder.patchChat({ status: "streaming", messages: streamed });
        });
        await act(async () => {
            vi.advanceTimersByTime(1999);
        });
        expect(holder.replaceThreadMessages).not.toHaveBeenCalled();
        await act(async () => {
            vi.advanceTimersByTime(1);
        });
        expect(holder.replaceThreadMessages).toHaveBeenCalledTimes(1);
        expect(holder.indexChatMemories).not.toHaveBeenCalled();

        holder.replaceThreadMessages.mockClear();
        await act(async () => {
            vi.advanceTimersByTime(2000);
        });
        expect(holder.replaceThreadMessages).not.toHaveBeenCalled();
    });

    it("persists a ready thread once", async () => {
        render(<Harness status="ready" />);
        await flushHydrate();
        await act(async () => {
            vi.advanceTimersByTime(399);
        });
        expect(holder.replaceThreadMessages).not.toHaveBeenCalled();
        await act(async () => {
            vi.advanceTimersByTime(1);
        });
        expect(holder.replaceThreadMessages).toHaveBeenCalledTimes(1);
        expect(holder.recordUsageFromMessages).toHaveBeenCalledTimes(1);
        await act(async () => {
            vi.advanceTimersByTime(5000);
        });
        expect(holder.replaceThreadMessages).toHaveBeenCalledTimes(1);
    });
});

describe("hydrate sanitization", () => {
    it("closes streaming text and pending tools", () => {
        const restored = sanitizeRestoredMessages([
            {
                id: "a1",
                role: "assistant",
                parts: [
                    { type: "text", text: "partial", state: "streaming" },
                    {
                        type: "dynamic-tool",
                        toolName: "calculator",
                        toolCallId: "call-1",
                        state: "approval-requested",
                        input: {},
                        approval: { id: "approval-1" },
                    },
                ],
            },
        ]);
        expect(restored[0]?.parts[0]).toMatchObject({ state: "done" });
        expect(restored[0]?.parts[1]).toMatchObject({
            state: "output-error",
            errorText: "Interrupted: the page closed before this finished.",
        });
    });
});
