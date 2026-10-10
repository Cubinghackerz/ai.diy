/**
 * Last-known-good ChatGPT model list per signed-in session.
 *
 * Model discovery is a live call to OpenAI. When it fails (a blip, a Cloudflare
 * challenge, a refresh in progress) the route used to fall back to the bundled
 * catalog, so the newest models vanished from the picker until the next
 * success. Serving the previous live answer instead keeps the list stable. It is
 * in memory only, keyed by the session cookie, and holds slugs (no tokens).
 */

const FRESH_MS = 60_000;
const STALE_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 200;

type Entry = { slugs: string[]; at: number };

export function createChatGPTModelCache(now: () => number = Date.now) {
    const entries = new Map<string, Entry>();

    return {
        remember(key: string, slugs: string[]) {
            if (!key || slugs.length === 0) return;
            entries.delete(key);
            entries.set(key, { slugs: [...slugs], at: now() });
            while (entries.size > MAX_ENTRIES) {
                const oldest = entries.keys().next().value;
                if (oldest === undefined) break;
                entries.delete(oldest);
            }
        },
        /** A recent answer: safe to serve without asking OpenAI again. */
        fresh(key: string): string[] | undefined {
            const entry = entries.get(key);
            return entry && now() - entry.at < FRESH_MS ? [...entry.slugs] : undefined;
        },
        /** Any answer within a day: what to show when OpenAI cannot be reached. */
        stale(key: string): string[] | undefined {
            const entry = entries.get(key);
            return entry && now() - entry.at < STALE_MS ? [...entry.slugs] : undefined;
        },
        forget(key: string) {
            entries.delete(key);
        },
    };
}

export const chatGPTModelCache = createChatGPTModelCache();
