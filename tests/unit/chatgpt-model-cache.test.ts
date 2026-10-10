import { describe, expect, it } from "vitest";
import { createChatGPTModelCache } from "~/lib/server/chatgpt-model-cache";

describe("chatgpt model cache", () => {
    it("serves a recent list as fresh, then only as a fallback, then not at all", () => {
        let now = 0;
        const cache = createChatGPTModelCache(() => now);
        cache.remember("session-a", ["gpt-6.1-sol", "gpt-6-luna"]);

        expect(cache.fresh("session-a")).toEqual(["gpt-6.1-sol", "gpt-6-luna"]);

        now = 2 * 60_000;
        expect(cache.fresh("session-a")).toBeUndefined();
        expect(cache.stale("session-a")).toEqual(["gpt-6.1-sol", "gpt-6-luna"]);

        now = 25 * 60 * 60_000;
        expect(cache.stale("session-a")).toBeUndefined();
    });

    it("keeps sessions apart and never stores an empty answer over a good one", () => {
        const cache = createChatGPTModelCache(() => 0);
        cache.remember("a", ["gpt-6-luna"]);
        cache.remember("a", []);
        expect(cache.fresh("a")).toEqual(["gpt-6-luna"]);
        expect(cache.fresh("b")).toBeUndefined();
        cache.forget("a");
        expect(cache.stale("a")).toBeUndefined();
    });

    it("returns copies so callers cannot corrupt the cache", () => {
        const cache = createChatGPTModelCache(() => 0);
        cache.remember("a", ["gpt-6-luna"]);
        cache.fresh("a")!.push("tampered");
        expect(cache.fresh("a")).toEqual(["gpt-6-luna"]);
    });
});
