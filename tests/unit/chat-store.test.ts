import { describe, expect, it, vi } from "vitest";
import { loadThreadUIMessages, replaceThreadMessages } from "~/lib/chat-store";
import { getThreadMessages, saveThread } from "~/lib/db";
import type { MessageData } from "~/lib/types";
import type { UIMessage } from "ai";

function messagePuts() {
    const ids: string[] = [];
    const original = IDBObjectStore.prototype.put;
    const spy = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
        this: IDBObjectStore,
        value: unknown,
        key?: IDBValidKey,
    ) {
        if (this.name === "messages") ids.push((value as MessageData).id);
        return original.call(this, value, key);
    });
    return { ids, restore: () => spy.mockRestore() };
}

describe("local chat persistence", () => {
    it("round-trips text and tool output through IndexedDB", async () => {
        const id = "test-thread";
        await saveThread({ id, title: "Test", createdAt: 1, updatedAt: 1 });
        const messages: UIMessage[] = [
            { id: "test-user", role: "user", parts: [{ type: "text", text: "hello" }] },
            {
                id: "test-answer",
                role: "assistant",
                parts: [
                    { type: "text", text: "answer" },
                    {
                        type: "tool-calculator",
                        toolCallId: "call-1",
                        state: "output-available",
                        input: { expression: "1+1" },
                        output: "2",
                    },
                ],
            },
        ];
        await replaceThreadMessages(id, messages);
        expect(await loadThreadUIMessages(id)).toEqual(messages);
    });

    it("keeps createdAt stable, appends in order, and drops removed rows", async () => {
        const id = "stable-thread";
        await saveThread({ id, title: "Stable", createdAt: 1, updatedAt: 1 });
        const first: UIMessage[] = [
            { id: "stable-a", role: "user", parts: [{ type: "text", text: "one" }] },
            { id: "stable-b", role: "assistant", parts: [{ type: "text", text: "two" }] },
        ];
        await replaceThreadMessages(id, first);
        const saved = await getThreadMessages(id);
        const createdAt = new Map(saved.map((row) => [row.id, row.createdAt]));

        const appended: UIMessage[] = [
            ...first,
            { id: "stable-c", role: "user", parts: [{ type: "text", text: "three" }] },
        ];
        await replaceThreadMessages(id, appended);
        const afterAppend = await getThreadMessages(id);
        expect(afterAppend.find((row) => row.id === "stable-a")?.createdAt).toBe(
            createdAt.get("stable-a"),
        );
        expect(afterAppend.find((row) => row.id === "stable-b")?.createdAt).toBe(
            createdAt.get("stable-b"),
        );
        const appendedAt = afterAppend.find((row) => row.id === "stable-c")?.createdAt ?? 0;
        expect(appendedAt).toBeGreaterThan(createdAt.get("stable-b") ?? 0);
        expect((await loadThreadUIMessages(id)).map((message) => message.id)).toEqual([
            "stable-a",
            "stable-b",
            "stable-c",
        ]);

        await replaceThreadMessages(id, [first[0]]);
        expect((await getThreadMessages(id)).map((row) => row.id)).toEqual(["stable-a"]);
    });

    it("does not rewrite unchanged message rows", async () => {
        const id = "skip-thread";
        await saveThread({ id, title: "Skip", createdAt: 1, updatedAt: 1 });
        const messages: UIMessage[] = [
            { id: "skip-user", role: "user", parts: [{ type: "text", text: "hello" }] },
            { id: "skip-answer", role: "assistant", parts: [{ type: "text", text: "answer" }] },
        ];
        await replaceThreadMessages(id, messages);

        const puts = messagePuts();
        try {
            await replaceThreadMessages(id, [
                messages[0],
                { ...messages[1], parts: [{ type: "text", text: "edited" }] },
            ]);
            expect(puts.ids).toEqual(["skip-answer"]);
        } finally {
            puts.restore();
        }
    });

    it("clears the skip cache when a save fails so the retry rewrites", async () => {
        const id = "fail-thread";
        await saveThread({ id, title: "Fail", createdAt: 1, updatedAt: 1 });
        const messages: UIMessage[] = [
            { id: "fail-user", role: "user", parts: [{ type: "text", text: "hello" }] },
            { id: "fail-answer", role: "assistant", parts: [{ type: "text", text: "answer" }] },
        ];
        await replaceThreadMessages(id, messages);

        const original = IDBObjectStore.prototype.put;
        const failing = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
            this: IDBObjectStore,
            value: unknown,
            key?: IDBValidKey,
        ) {
            if (this.name === "messages") throw new Error("forced failure");
            return original.call(this, value, key);
        });
        const changed: UIMessage[] = [
            messages[0],
            { ...messages[1], parts: [{ type: "text", text: "edited" }] },
        ];
        await expect(replaceThreadMessages(id, changed)).rejects.toThrow(/forced failure/);
        failing.mockRestore();

        const puts = messagePuts();
        try {
            await replaceThreadMessages(id, changed);
            expect(puts.ids.sort()).toEqual(["fail-answer", "fail-user"]);
        } finally {
            puts.restore();
        }
    });

    it("sanitizes interrupted streaming and tool parts on load", async () => {
        const id = "interrupted-thread";
        await saveThread({ id, title: "Interrupted", createdAt: 1, updatedAt: 1 });
        const messages = [
            {
                id: "interrupted-user",
                role: "user" as const,
                parts: [{ type: "text" as const, text: "run it" }],
            },
            {
                id: "interrupted-answer",
                role: "assistant" as const,
                parts: [
                    { type: "text" as const, text: "partial", state: "streaming" as const },
                    { type: "reasoning" as const, text: "thinking", state: "streaming" as const },
                    {
                        type: "tool-calculator" as const,
                        toolCallId: "call-1",
                        state: "input-available" as const,
                        input: { expression: "1+1" },
                    },
                ],
            },
        ];
        await replaceThreadMessages(id, messages);
        const restored = await loadThreadUIMessages(id);
        const answer = restored[1];
        expect(answer?.parts[0]).toMatchObject({ type: "text", state: "done" });
        expect(answer?.parts[1]).toMatchObject({ type: "reasoning", state: "done" });
        expect(answer?.parts[2]).toMatchObject({
            state: "output-error",
            errorText: "Interrupted: the page closed before this finished.",
        });
        expect(answer?.parts[2]).not.toHaveProperty("output");
    });
});
