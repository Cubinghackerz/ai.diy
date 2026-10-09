/**
 * Keyless, CORS-enabled Wikipedia lookups used for photos and coordinates.
 * Images only ever come from Wikimedia hosts returned by this API; model
 * output never supplies an image URL, so it cannot be used to exfiltrate data
 * through an image request.
 */

export type WikiSummary = {
    title: string;
    extract: string | null;
    imageUrl: string | null;
    pageUrl: string | null;
    lat: number | null;
    lng: number | null;
};

const ENDPOINT = "https://en.wikipedia.org/api/rest_v1/page/summary/";
const MAX_QUERY = 200;
const MAX_CACHE = 200;

const cache = new Map<string, WikiSummary | null>();
const inflight = new Map<string, Promise<WikiSummary | null>>();

// Thumbnails come from thumb.wikimedia.org, full-size images from upload.wikimedia.org.
const IMAGE_HOSTS = new Set(["thumb.wikimedia.org", "upload.wikimedia.org"]);

export function isWikimediaImage(value: unknown): value is string {
    if (typeof value !== "string") return false;
    try {
        const url = new URL(value);
        return url.protocol === "https:" && IMAGE_HOSTS.has(url.hostname);
    } catch {
        return false;
    }
}

function isWikipediaPage(value: unknown): value is string {
    if (typeof value !== "string") return false;
    try {
        const url = new URL(value);
        return url.protocol === "https:" && url.hostname.endsWith(".wikipedia.org");
    } catch {
        return false;
    }
}

function finite(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parseWikiSummary(data: unknown): WikiSummary | null {
    if (!data || typeof data !== "object") return null;
    const record = data as Record<string, unknown>;
    if (typeof record.title !== "string") return null;
    const image = (record.originalimage ?? record.thumbnail) as { source?: unknown } | undefined;
    const thumb = (record.thumbnail as { source?: unknown } | undefined)?.source;
    const imageUrl = isWikimediaImage(thumb)
        ? thumb
        : isWikimediaImage(image?.source)
          ? image.source
          : null;
    const page = (record.content_urls as { desktop?: { page?: unknown } } | undefined)?.desktop
        ?.page;
    const coordinates = record.coordinates as { lat?: unknown; lon?: unknown } | undefined;
    const lat = finite(coordinates?.lat);
    const lng = finite(coordinates?.lon);
    return {
        title: record.title,
        extract: typeof record.extract === "string" ? record.extract : null,
        imageUrl,
        pageUrl: isWikipediaPage(page) ? page : null,
        lat:
            lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
                ? lat
                : null,
        lng:
            lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
                ? lng
                : null,
    };
}

const TIMEOUT_MS = 10_000;

/**
 * Looks up an exact English Wikipedia article title. Resolves to null on any
 * failure. The request is shared between callers, so it deliberately takes no
 * caller AbortSignal: one component unmounting (or React StrictMode replaying
 * an effect) must not cancel the lookup another caller is waiting on. Callers
 * ignore results they no longer need.
 */
export function fetchWikiSummary(query: string): Promise<WikiSummary | null> {
    const key = query.trim();
    if (!key || key.length > MAX_QUERY) return Promise.resolve(null);
    if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null);
    const pending = inflight.get(key);
    if (pending) return pending;

    const request = (async () => {
        try {
            const response = await fetch(`${ENDPOINT}${encodeURIComponent(key)}?redirect=true`, {
                signal: AbortSignal.timeout(TIMEOUT_MS),
                referrerPolicy: "no-referrer",
                headers: { accept: "application/json" },
            });
            if (!response.ok) return null;
            return parseWikiSummary(await response.json());
        } catch {
            return null;
        }
    })().then((result) => {
        inflight.delete(key);
        // Only definite answers are cached; a failure may be transient, so retry next time.
        if (result) {
            if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
            cache.set(key, result);
        }
        return result;
    });
    inflight.set(key, request);
    return request;
}

export function clearWikiCache() {
    cache.clear();
    inflight.clear();
}
