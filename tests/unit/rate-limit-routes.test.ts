// @vitest-environment node
import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { action as search } from "~/routes/api.search";
import { action as connectors } from "~/routes/api.connectors";

const mocks = vi.hoisted(() => ({ limiter: vi.fn(), downstream: vi.fn() }));
vi.mock("~/lib/server/rate-limit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("~/lib/server/rate-limit")>()),
    checkRateLimit: mocks.limiter,
}));
vi.mock("~/lib/search", () => ({ webSearch: mocks.downstream }));
vi.mock("~/lib/search/connectors", () => ({ connectorSearch: mocks.downstream }));

beforeEach(() => {
    mocks.limiter.mockReset();
    mocks.downstream.mockReset().mockResolvedValue([]);
});

const cases = [
    { name: "search", action: search, body: { query: "fixture query" } },
    {
        name: "connectors",
        action: connectors,
        body: { action: "test", connector: { kind: "brave", apiKey: "fixture-key" } },
    },
] as const;

describe.each(cases)("$name rate-limit integration", ({ action, body }) => {
    const call = () =>
        action({
            request: new Request("https://example.test/api/fixture", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            }),
            params: {},
            context: new RouterContextProvider(),
            url: new URL("https://example.test/api/fixture"),
            pattern: "/api/fixture",
        });

    it("waits for the shared store before making any downstream request", async () => {
        let finish!: (result: { ok: boolean }) => void;
        mocks.limiter.mockReturnValue(
            new Promise((resolve) => {
                finish = resolve;
            }),
        );
        let settled = false;
        const pending = call().then((response) => {
            settled = true;
            return response;
        });
        await vi.waitFor(() => expect(mocks.limiter).toHaveBeenCalledOnce());
        expect(settled).toBe(false);
        expect(mocks.downstream).not.toHaveBeenCalled();
        finish({ ok: true });
        expect((await pending).status).toBe(200);
        expect(mocks.downstream).toHaveBeenCalledOnce();
    });

    it("returns 429 without calling downstream when the shared store rejects", async () => {
        mocks.limiter.mockResolvedValue({ ok: false, retryAfterMs: 2_400 });
        const response = await call();
        expect(response.status).toBe(429);
        expect(response.headers.get("Retry-After")).toBe("3");
        expect(mocks.downstream).not.toHaveBeenCalled();
    });
});
