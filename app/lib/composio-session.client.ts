import type { ComposioSettings } from "~/lib/types";

/**
 * Keeps the saved Composio session usable.
 *
 * Settings store the MCP URL of a Composio session created when the user
 * connected. If that session later expires or the URL changes, chat would keep
 * sending a dead endpoint and the connected apps would quietly stop working
 * until the user thought to press "Re-sync session". This checks the session
 * with Composio (which reuses it when it is still good and only creates a new
 * one when Composio says it is gone) once per page load, every half hour, and
 * right after the server reports that the apps did not load.
 */
const RECHECK_AFTER_MS = 30 * 60_000;
const RESYNC_TIMEOUT_MS = 5_000;

let verifiedSessionId: string | null = null;
let verifiedAt = 0;
let needsResync = false;
let inflight: Promise<ComposioSettings | null> | null = null;

/** The chat server could not reach the user's apps: re-check before the next message. */
export function markComposioNeedsResync() {
    needsResync = true;
}

/** Test hook. */
export function resetComposioResync() {
    verifiedSessionId = null;
    verifiedAt = 0;
    needsResync = false;
    inflight = null;
}

function due(current: ComposioSettings): boolean {
    if (needsResync) return true;
    if (verifiedSessionId !== current.sessionId) return true;
    return Date.now() - verifiedAt > RECHECK_AFTER_MS;
}

/**
 * Returns the updated Composio settings when the session changed, otherwise
 * `null` (unchanged, not due, or the check failed). Never throws and never
 * waits longer than a few seconds, so sending a message is not held up.
 */
export function resyncComposioSession(current: ComposioSettings): Promise<ComposioSettings | null> {
    if (!current.enabled || !current.apiKey || !current.sessionId) return Promise.resolve(null);
    if (!due(current)) return Promise.resolve(null);
    inflight ??= check(current).finally(() => {
        inflight = null;
    });
    return inflight;
}

async function check(current: ComposioSettings): Promise<ComposioSettings | null> {
    try {
        const response = await fetch("/api/composio", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "session",
                apiKey: current.apiKey,
                userId: current.userId || undefined,
                sessionId: current.sessionId,
            }),
            signal: AbortSignal.timeout(RESYNC_TIMEOUT_MS),
        });
        const data = (await response.json()) as {
            ok?: boolean;
            sessionId?: string;
            mcpUrl?: string;
            mcpHeaders?: Record<string, string>;
            userId?: string;
        };
        if (!response.ok || data.ok === false || !data.mcpUrl) return null;
        needsResync = false;
        verifiedSessionId = data.sessionId ?? current.sessionId;
        verifiedAt = Date.now();
        const sameEndpoint =
            data.mcpUrl === current.mcpUrl &&
            JSON.stringify(data.mcpHeaders ?? {}) === JSON.stringify(current.mcpHeaders ?? {}) &&
            (data.sessionId ?? current.sessionId) === current.sessionId;
        if (sameEndpoint) return null;
        return {
            ...current,
            userId: data.userId || current.userId,
            sessionId: data.sessionId ?? current.sessionId,
            mcpUrl: data.mcpUrl,
            mcpHeaders: data.mcpHeaders ?? {},
        };
    } catch {
        // Offline, rate-limited, or Composio is slow: keep what is saved.
        return null;
    }
}
