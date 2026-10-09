import { describe, expect, it, vi } from "vitest";
import { BuiltinActionType } from "@openuidev/react-lang";
import { isSafeActionUrl, handleOpenUIAction } from "~/components/generative-ui/safe-openui";

describe("isSafeActionUrl", () => {
    it("accepts absolute http and https URLs", () => {
        expect(isSafeActionUrl("https://example.com/a?b=1")).toBe(true);
        expect(isSafeActionUrl("http://example.com")).toBe(true);
    });
    it("rejects executable, embedded, relative, and malformed values", () => {
        for (const value of [
            "javascript:alert(1)",
            " JaVaScRiPt:alert(1)",
            "java\nscript:alert(1)",
            "data:text/html,<script>alert(1)</script>",
            "vbscript:x",
            "file:///etc/passwd",
            "blob:https://example.com/abc",
            "/relative",
            "//example.com",
            "",
            "not a url",
            null,
            undefined,
            42,
        ]) {
            expect(isSafeActionUrl(value), String(value)).toBe(false);
        }
    });
});

describe("handleOpenUIAction", () => {
    const base = { humanFriendlyMessage: "m", formState: undefined, formName: undefined };
    it("opens safe URLs without opener access", () => {
        const open = vi.fn();
        handleOpenUIAction(
            {
                type: BuiltinActionType.OpenUrl,
                params: { url: "https://example.com" },
                ...base,
            } as never,
            { open, append: vi.fn() },
        );
        expect(open).toHaveBeenCalledWith("https://example.com", "_blank", "noopener,noreferrer");
    });
    it("never opens javascript: or data: URLs", () => {
        const open = vi.fn();
        for (const url of ["javascript:alert(1)", "data:text/html,x"]) {
            handleOpenUIAction(
                { type: BuiltinActionType.OpenUrl, params: { url }, ...base } as never,
                {
                    open,
                    append: vi.fn(),
                },
            );
        }
        expect(open).not.toHaveBeenCalled();
    });
    it("does not queue follow-ups while a reply is running, but still opens safe links", () => {
        const append = vi.fn();
        const open = vi.fn();
        const sinks = { open, append };
        handleOpenUIAction(
            {
                type: BuiltinActionType.ContinueConversation,
                params: {},
                ...base,
                humanFriendlyMessage: "Next",
            } as never,
            sinks,
            { busy: true },
        );
        expect(append).not.toHaveBeenCalled();
        handleOpenUIAction(
            {
                type: BuiltinActionType.OpenUrl,
                params: { url: "https://example.com" },
                ...base,
            } as never,
            sinks,
            { busy: true },
        );
        expect(open).toHaveBeenCalledTimes(1);
    });
    it("continues the conversation for follow-ups", () => {
        const append = vi.fn();
        handleOpenUIAction(
            {
                type: BuiltinActionType.ContinueConversation,
                params: {},
                ...base,
                humanFriendlyMessage: "Next",
            } as never,
            { open: vi.fn(), append },
        );
        expect(append).toHaveBeenCalledWith("Next");
    });
});
