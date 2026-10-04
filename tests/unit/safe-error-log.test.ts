// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { reportSafeServerError } from "~/lib/server/safe-error-log";

describe("server error privacy", () => {
    it("logs only bounded diagnostic metadata, never SDK request/response contents", () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        const error = Object.assign(new Error("fixture-private-conversation fixture-private-key"), {
            name: "AI_APICallError",
            statusCode: 429,
            requestBodyValues: { messages: ["fixture-private-conversation"] },
            responseBody: "fixture-private-key",
            url: "https://fixture-private-host.test",
            cause: new Error("fixture-private-cause"),
        });
        reportSafeServerError("chat-stream", error);
        expect(log).toHaveBeenCalledWith("[ai.diy:chat-stream]", {
            kind: "AI_APICallError",
            statusCode: 429,
        });
        expect(JSON.stringify(log.mock.calls)).not.toContain("fixture-private");
    });
    it("does not trust arbitrary error names or status values", () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        reportSafeServerError("document-render", {
            name: "fixture-private-key",
            statusCode: "fixture-private-key",
        });
        expect(log).toHaveBeenCalledWith("[ai.diy:document-render]", { kind: "Error" });
    });
    it("handles null, primitives and hostile accessors without logging raw values", () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        for (const error of [
            null,
            "fixture-private-key",
            new Proxy(
                {},
                {
                    get() {
                        throw new Error("fixture-private-key");
                    },
                },
            ),
        ])
            reportSafeServerError("chat", error);
        expect(log).toHaveBeenCalledTimes(3);
        for (const call of log.mock.calls)
            expect(call).toEqual(["[ai.diy:chat]", { kind: "Error" }]);
    });
});
