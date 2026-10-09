import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    clearWikiCache,
    fetchWikiSummary,
    isWikimediaImage,
    parseWikiSummary,
} from "~/components/generative-ui/wikipedia";

const sample = {
    title: "Eiffel Tower",
    extract: "Wrought-iron tower in Paris.",
    thumbnail: { source: "https://upload.wikimedia.org/a.jpg" },
    content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Eiffel_Tower" } },
    coordinates: { lat: 48.8584, lon: 2.2945 },
};

describe("wikipedia helper", () => {
    beforeEach(() => clearWikiCache());
    afterEach(() => vi.unstubAllGlobals());

    it("parses summaries and keeps only Wikimedia image hosts", () => {
        expect(parseWikiSummary(sample)).toMatchObject({
            title: "Eiffel Tower",
            imageUrl: "https://upload.wikimedia.org/a.jpg",
            lat: 48.8584,
            lng: 2.2945,
        });
        expect(
            parseWikiSummary({ ...sample, thumbnail: { source: "https://evil.example/x.png" } })
                ?.imageUrl,
        ).toBeNull();
        expect(parseWikiSummary({ ...sample, coordinates: { lat: 999, lon: 2 } })?.lat).toBeNull();
        expect(parseWikiSummary(null)).toBeNull();
        expect(isWikimediaImage("http://upload.wikimedia.org/a.jpg")).toBe(false);
        // Real Wikipedia thumbnails live on thumb.wikimedia.org.
        expect(
            parseWikiSummary({
                ...sample,
                thumbnail: {
                    source: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/x.jpg/330px-x.jpg",
                },
            })?.imageUrl,
        ).toBe("https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/x.jpg/330px-x.jpg");
        expect(isWikimediaImage("https://upload.wikimedia.org.evil.example/a.jpg")).toBe(false);
    });

    it("caches and de-duplicates requests", async () => {
        const fetchMock = vi.fn(async () => Response.json(sample));
        vi.stubGlobal("fetch", fetchMock);
        const [a, b] = await Promise.all([
            fetchWikiSummary("Eiffel Tower"),
            fetchWikiSummary("Eiffel Tower"),
        ]);
        await fetchWikiSummary("Eiffel Tower");
        expect(a?.title).toBe("Eiffel Tower");
        expect(b).toEqual(a);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe(
            "https://en.wikipedia.org/api/rest_v1/page/summary/Eiffel%20Tower?redirect=true",
        );
        expect(init.referrerPolicy).toBe("no-referrer");
    });

    it("resolves to null on HTTP errors, network errors, and empty or oversized queries", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response("", { status: 404 })),
        );
        expect(await fetchWikiSummary("Nope")).toBeNull();
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => Promise.reject(new Error("offline"))),
        );
        expect(await fetchWikiSummary("Other")).toBeNull();
        const spy = vi.fn();
        vi.stubGlobal("fetch", spy);
        expect(await fetchWikiSummary("  ")).toBeNull();
        expect(await fetchWikiSummary("x".repeat(500))).toBeNull();
        expect(spy).not.toHaveBeenCalled();
    });
});
