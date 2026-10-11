import { describe, expect, it, vi } from "vitest";
import { RETURNING_VISITOR_REDIRECT } from "~/lib/landing-redirect";

/** Run the inline script against a fake page. */
function visit({
    search = "",
    referrer = "",
    stored = {},
}: {
    search?: string;
    referrer?: string;
    stored?: Record<string, string>;
}) {
    const replace = vi.fn();
    const location = { search, origin: "https://ai.diy", replace };
    const document = { referrer };
    const localStorage = { getItem: (key: string) => stored[key] ?? null };
    new Function("location", "document", "localStorage", "URL", RETURNING_VISITOR_REDIRECT)(
        location,
        document,
        localStorage,
        URL,
    );
    return replace;
}

describe("landing page: returning visitors go straight to the workspace", () => {
    it("redirects someone who has opened the workspace before", () => {
        expect(visit({ stored: { "prismium-lite:setup-complete": "1" } })).toHaveBeenCalledWith(
            "/workspace",
        );
    });

    it("shows the page to first-time visitors and crawlers", () => {
        expect(visit({})).not.toHaveBeenCalled();
    });

    it("does not count settings that exist only because some page loaded", () => {
        // The root provider writes defaults on every page, including this one.
        const stored = { "prismium-lite:settings.enc": "x", "prismium-lite:theme": "dark" };
        expect(visit({ stored })).not.toHaveBeenCalled();
    });

    it("always shows the page for /?landing", () => {
        expect(
            visit({ search: "?landing", stored: { "prismium-lite:setup-complete": "1" } }),
        ).not.toHaveBeenCalled();
    });

    it("does not bounce someone who arrived from another ai.diy page", () => {
        const stored = { "prismium-lite:setup-complete": "1" };
        expect(visit({ referrer: "https://ai.diy/mcp", stored })).not.toHaveBeenCalled();
        expect(visit({ referrer: "https://www.google.com/", stored })).toHaveBeenCalledWith(
            "/workspace",
        );
    });

    it("never throws when storage is blocked", () => {
        const replace = vi.fn();
        expect(() =>
            new Function("location", "document", "localStorage", "URL", RETURNING_VISITOR_REDIRECT)(
                { search: "", origin: "https://ai.diy", replace },
                { referrer: "" },
                {
                    getItem: () => {
                        throw new Error("blocked");
                    },
                },
                URL,
            ),
        ).not.toThrow();
        expect(replace).not.toHaveBeenCalled();
    });
});
