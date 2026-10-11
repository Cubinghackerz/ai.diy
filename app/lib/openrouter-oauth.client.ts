/**
 * "Continue with OpenRouter": OAuth PKCE entirely in the browser.
 *
 * The user approves ai.diy on openrouter.ai and comes back with a one-time
 * `code`; exchanging it (with the PKCE verifier only this tab knows) returns an
 * API key that belongs to the user. It is stored like any pasted key, in this
 * browser. Nothing goes through the ai.diy server, so there is no session to
 * expire and nothing to host. Never log the code, verifier, or key.
 *
 * https://openrouter.ai/docs/use-cases/oauth-pkce
 */

export const OPENROUTER_AUTH_URL = "https://openrouter.ai/auth";
export const OPENROUTER_KEY_URL = "https://openrouter.ai/api/v1/auth/keys";
const STORAGE_KEY = "aidiy:openrouter-oauth";
/** A pending sign-in older than this was abandoned. */
const PENDING_TTL_MS = 30 * 60_000;

export class OpenRouterOAuthError extends Error {
    constructor(
        message: string,
        readonly code: "unsupported" | "expired" | "rejected" | "network" | "invalid",
    ) {
        super(message);
        this.name = "OpenRouterOAuthError";
    }
}

function base64Url(bytes: Uint8Array): string {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A random verifier and its S256 challenge (RFC 7636). */
export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) {
        throw new OpenRouterOAuthError(
            "This browser can't do secure sign-in here (it needs HTTPS). Paste an API key instead.",
            "unsupported",
        );
    }
    const verifier = base64Url(globalThis.crypto.getRandomValues(new Uint8Array(48)));
    const digest = await subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

/** Where OpenRouter sends the user back to. */
export function openRouterCallbackUrl(origin: string): string {
    return `${origin}/workspace`;
}

export function buildOpenRouterAuthUrl(callbackUrl: string, challenge: string): string {
    const url = new URL(OPENROUTER_AUTH_URL);
    url.searchParams.set("callback_url", callbackUrl);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
}

type Pending = { verifier: string; startedAt: number };

function readPending(): Pending | null {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<Pending>;
        if (typeof parsed.verifier !== "string" || typeof parsed.startedAt !== "number") {
            return null;
        }
        return { verifier: parsed.verifier, startedAt: parsed.startedAt };
    } catch {
        return null;
    }
}

export function clearOpenRouterPending() {
    try {
        sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        // Storage can be blocked; there is nothing to clear then.
    }
}

/** Send the user to OpenRouter to approve ai.diy. */
export async function startOpenRouterSignIn(
    navigate: (url: string) => void = (url) => window.location.assign(url),
): Promise<void> {
    const { verifier, challenge } = await createPkcePair();
    try {
        sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ verifier, startedAt: Date.now() } satisfies Pending),
        );
    } catch {
        throw new OpenRouterOAuthError(
            "This browser blocks the storage sign-in needs. Paste an API key instead.",
            "unsupported",
        );
    }
    navigate(buildOpenRouterAuthUrl(openRouterCallbackUrl(window.location.origin), challenge));
}

/** The one-time code OpenRouter appended to the callback URL, if this is a return trip. */
export function readOpenRouterCode(search: string): string | null {
    const code = new URLSearchParams(search).get("code")?.trim();
    // Only a return from a sign-in this tab started counts; any other `code` is ignored.
    if (!code || code.length > 512 || !readPending()) return null;
    return code;
}

/** Exchange the code for the user's API key. The code is single use. */
export async function completeOpenRouterSignIn(
    code: string,
    fetchImpl: typeof fetch = fetch,
): Promise<string> {
    const pending = readPending();
    clearOpenRouterPending();
    if (!pending || Date.now() - pending.startedAt > PENDING_TTL_MS) {
        throw new OpenRouterOAuthError(
            "That sign-in took too long or was started in another tab. Try again.",
            "expired",
        );
    }
    let response: Response;
    try {
        response = await fetchImpl(OPENROUTER_KEY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                code,
                code_verifier: pending.verifier,
                code_challenge_method: "S256",
            }),
            signal: AbortSignal.timeout(20_000),
        });
    } catch {
        throw new OpenRouterOAuthError(
            "Couldn't reach OpenRouter. Check your connection and try again.",
            "network",
        );
    }
    if (!response.ok) {
        throw new OpenRouterOAuthError(
            response.status === 400 || response.status === 403
                ? "OpenRouter didn't accept that sign-in (it may have expired). Try again."
                : `OpenRouter couldn't finish the sign-in (HTTP ${response.status}). Try again.`,
            "rejected",
        );
    }
    let key: unknown;
    try {
        key = ((await response.json()) as { key?: unknown }).key;
    } catch {
        key = undefined;
    }
    if (typeof key !== "string" || !key.trim() || key.length > 512) {
        throw new OpenRouterOAuthError(
            "OpenRouter answered without a key. Try again, or paste an API key.",
            "invalid",
        );
    }
    return key.trim();
}
