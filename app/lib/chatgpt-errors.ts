/** Friendly, actionable messages for Login with ChatGPT failures (server + client safe). */

export type ChatGPTErrorInfo = {
    /** HTTP status the /api/chatgpt route should answer with. */
    status: number;
    /** Stable, user-facing sentence naming the problem and the recovery. */
    message: string;
    /** Transient problems are worth retrying automatically. */
    retryable: boolean;
};

const KNOWN: Record<string, ChatGPTErrorInfo> = {
    device_code_disabled: {
        status: 502,
        retryable: false,
        message:
            "OpenAI has device-code sign-in turned off for this account or workspace. Enable device code authorization in your ChatGPT security settings, then try again.",
    },
    device_code_request_failed: {
        status: 502,
        retryable: true,
        message: "OpenAI didn't return a sign-in code. Wait a moment and try again.",
    },
    token_exchange_failed: {
        status: 502,
        retryable: false,
        message:
            "OpenAI approved the code but the sign-in couldn't be completed. Start again for a fresh code.",
    },
    token_refresh_failed: {
        status: 502,
        retryable: true,
        message: "Couldn't renew your ChatGPT session with OpenAI. This is usually temporary.",
    },
    refresh_token_invalid: {
        status: 401,
        retryable: false,
        message: "Your ChatGPT session ended. Reconnect to keep using your plan.",
    },
    not_authenticated: {
        status: 401,
        retryable: false,
        message: "You're not signed in with ChatGPT.",
    },
    network_error: {
        status: 503,
        retryable: true,
        message:
            "Couldn't reach OpenAI from this server. Check the server's network connection and retry.",
    },
    models_request_failed: {
        status: 502,
        retryable: true,
        message: "Signed in, but OpenAI didn't return your model list. Try again in a moment.",
    },
};

const FALLBACK: ChatGPTErrorInfo = {
    status: 500,
    retryable: true,
    message: "Something went wrong talking to ChatGPT. Try again.",
};

export function describeChatGPTError(code: string | undefined): ChatGPTErrorInfo {
    return (code && KNOWN[code]) || FALLBACK;
}

/** Duck-typed so it works across module copies without importing the SDK's core package. */
export function chatGPTErrorCode(error: unknown): string | undefined {
    if (!(error instanceof Error) || error.name !== "ChatGPTAuthError") return undefined;
    const code = (error as Error & { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
}

/** Formats "ABCD-EFGH" style codes into groups; leaves unknown shapes untouched. */
export function splitDeviceCode(code: string | undefined): string[] {
    if (!code) return [];
    const groups = code
        .trim()
        .split(/[\s-]+/)
        .filter(Boolean);
    return groups.length > 1 ? groups : [code.trim()];
}

/** Whole seconds left until `expiresAt` (epoch ms), never negative. */
export function secondsUntil(expiresAt: number | undefined, now: number): number {
    if (!expiresAt) return 0;
    return Math.max(0, Math.ceil((expiresAt - now) / 1000));
}

export function formatCountdown(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** "plus" -> "Plus", "chatgptplus" -> "ChatGPT Plus"-ish labels stay readable. */
export function formatPlan(plan: string | undefined): string | null {
    const value = plan?.trim();
    if (!value) return null;
    return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

/**
 * `/status` answers `unauthenticated` when the store can't see the session —
 * a restart, an instance swap, or a cookie that didn't travel. That is often
 * momentary (the durable store re-appears), so a pending login tolerates a few
 * consecutive misses before it gives up instead of killing the flow instantly.
 */
export const MAX_LOST_SESSION_STRIKES = 3;

export function shouldFailLostSession(strikes: number): boolean {
    return strikes >= MAX_LOST_SESSION_STRIKES;
}

export const LOST_SESSION_MESSAGE =
    "The server lost track of this sign-in — a restart can do that, and blocked cookies will too. Start again for a fresh code.";

/** Device codes live ~15 minutes; used when the server does not say. */
export const DEFAULT_DEVICE_CODE_TTL_MS = 15 * 60_000;

/**
 * How far the server's clock is ahead of this browser's, from a response `Date`
 * header. Differences under a few seconds are header rounding and latency, not
 * a wrong clock, so they read as zero.
 */
export function serverClockSkewMs(
    dateHeader: string | null | undefined,
    clientNow: number,
): number {
    if (!dateHeader) return 0;
    const serverNow = Date.parse(dateHeader);
    if (!Number.isFinite(serverNow)) return 0;
    const skew = serverNow - clientNow;
    return Math.abs(skew) < 5_000 ? 0 : skew;
}

/**
 * The server stamps `expiresAt` with its own clock. A browser whose clock is
 * minutes off would otherwise show a wrong countdown, or give up on a code that
 * is still valid; expressing the deadline on the browser's clock avoids both.
 */
export function deviceCodeDeadline(
    serverExpiresAt: number | undefined,
    skewMs: number,
    clientNow: number,
): number {
    if (typeof serverExpiresAt !== "number" || !Number.isFinite(serverExpiresAt)) {
        return clientNow + DEFAULT_DEVICE_CODE_TTL_MS;
    }
    return serverExpiresAt - skewMs;
}

/** Poll cadence: the server's interval (2–8 s), backing off after consecutive failures. */
export function pollDelayMs(intervalSeconds: number, failures: number): number {
    const base = Math.min(8_000, Math.max(2_000, intervalSeconds * 1000));
    return Math.min(15_000, base * 2 ** Math.min(Math.max(failures, 0), 2));
}
