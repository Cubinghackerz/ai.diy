import { Renderer, type OpenUIError } from "@openuidev/react-lang";
import { render, screen, waitFor } from "@testing-library/react";
import { Fragment, StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExternalMediaContext } from "~/components/generative-ui/media";
import {
    RICH_EXAMPLE_PROGRAM,
    richLibrary,
    richPromptOptions,
} from "~/components/generative-ui/library";
import { clearWikiCache } from "~/components/generative-ui/wikipedia";

vi.mock("~/components/generative-ui/maplibre-worker", () => ({
    loadMapWorkerUrl: async () => "blob:worker",
}));

const mapInstances: { remove: ReturnType<typeof vi.fn> }[] = [];
vi.mock("maplibre-gl", () => {
    class MockMap {
        remove = vi.fn();
        constructor() {
            mapInstances.push(this);
        }
        once(type: string, cb: () => void) {
            if (type === "load") queueMicrotask(cb);
        }
        on() {}
        isStyleLoaded() {
            return true;
        }
        addSource() {}
        getSource() {
            return undefined;
        }
        addLayer() {}
        fitBounds() {}
        resize() {}
    }
    class MockMarker {
        setLngLat() {
            return this;
        }
        addTo() {
            return this;
        }
        remove() {}
    }
    return { Map: MockMap, Marker: MockMarker, setWorkerUrl: vi.fn(), default: {} };
});

function renderProgram(media: boolean, errors: OpenUIError[] = [], strict = false) {
    const Wrapper = strict ? StrictMode : Fragment;
    return render(
        <Wrapper>
            <ExternalMediaContext.Provider value={media}>
                <Renderer
                    response={RICH_EXAMPLE_PROGRAM}
                    library={richLibrary}
                    isStreaming={false}
                    onError={(next) => errors.push(...next)}
                />
            </ExternalMediaContext.Provider>
        </Wrapper>,
    );
}

afterEach(() => {
    vi.unstubAllGlobals();
    clearWikiCache();
    mapInstances.length = 0;
});

describe("rich library prompt", () => {
    const prompt = richLibrary.prompt(richPromptOptions);

    it("keeps Card as the root and lists every Rich component with the stock ones", () => {
        expect(richLibrary.root).toBe("Card");
        for (const name of [
            "RichHeading",
            "RichItem",
            "RichGallery",
            "RichTimeline",
            "RichMap",
            "RichSuggestions",
            "FollowUpBlock",
            "TextContent",
        ]) {
            expect(prompt).toContain(name);
        }
        expect(prompt).toMatch(/Card\(children: \([^)]*RichMap/);
    });

    it("fits the server's 64,000 character modelInstructions cap with headroom", () => {
        expect(prompt.length).toBeLessThan(62_000);
    });
});

describe("rich components", () => {
    it("renders the example program without parse errors, with external media off", () => {
        const errors: OpenUIError[] = [];
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        renderProgram(false, errors);
        expect(errors).toEqual([]);
        expect(screen.getByRole("heading", { name: "A day in Rome" })).toBeTruthy();
        expect(screen.getAllByText("Colosseum").length).toBeGreaterThan(0);
        expect(screen.getByText(/External photos and maps is turned off/)).toBeTruthy();
        expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(mapInstances).toHaveLength(0);
    });

    it("loads photos and the map when external media is on", async () => {
        const fetchMock = vi.fn(async (url: string) =>
            Response.json({
                title: decodeURIComponent(url.split("/summary/")[1].split("?")[0]),
                thumbnail: { source: "https://upload.wikimedia.org/thumb.jpg" },
            }),
        );
        vi.stubGlobal("fetch", fetchMock);
        const { container } = renderProgram(true);
        await waitFor(() => expect(container.querySelectorAll("img").length).toBe(3));
        expect(container.querySelector("img")?.getAttribute("src")).toBe(
            "https://upload.wikimedia.org/thumb.jpg",
        );
        const urls = fetchMock.mock.calls.map(([url]) => String(url));
        expect(urls.every((url) => url.startsWith("https://en.wikipedia.org/api/rest_v1/"))).toBe(
            true,
        );
        await waitFor(() => expect(mapInstances).toHaveLength(1));
    });

    it("still loads photos when React cancels and restarts the first lookup (StrictMode)", async () => {
        // Real timing: the first request is still in flight when React tears the effect down.
        const fetchMock = vi.fn(
            (url: string, init?: RequestInit) =>
                new Promise<Response>((resolve, reject) => {
                    init?.signal?.addEventListener("abort", () =>
                        reject(new DOMException("aborted", "AbortError")),
                    );
                    setTimeout(
                        () =>
                            resolve(
                                Response.json({
                                    title: decodeURIComponent(
                                        url.split("/summary/")[1].split("?")[0],
                                    ),
                                    thumbnail: { source: "https://thumb.wikimedia.org/t.jpg" },
                                }),
                            ),
                        20,
                    );
                }),
        );
        vi.stubGlobal("fetch", fetchMock);
        const { container } = renderProgram(true, [], true);
        await waitFor(() => expect(container.querySelectorAll("img").length).toBe(3));
    });

    it("falls back to the text list and tears the map down on unmount", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response("", { status: 404 })),
        );
        const view = renderProgram(true);
        await waitFor(() => expect(mapInstances).toHaveLength(1));
        view.unmount();
        expect(mapInstances[0].remove).toHaveBeenCalled();
    });
});
