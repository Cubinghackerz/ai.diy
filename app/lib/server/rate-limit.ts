/**
 * In-memory sliding-window rate limiter for API routes.
 * Env: RATE_LIMIT_RPM (default 60), RATE_LIMIT_DISABLED=true to skip.
 */

import { createHash } from "node:crypto";

const DEFAULT_RPM = 60;
const WINDOW_MS = 60_000;

const windows = new Map<string, number[]>();

function configuredRpm(): number {
    if (process.env.RATE_LIMIT_DISABLED === "true") return Infinity;
    const raw = process.env.RATE_LIMIT_RPM;
    if (!raw) return DEFAULT_RPM;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RPM;
}

function hashKey(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
}

/** Derive a stable rate-limit key from the caller's API key or IP. */
export function rateLimitKeyFromRequest(
    request: Request,
    apiKey?: string,
): string {
    const trimmed = apiKey?.trim();
    if (trimmed) return hashKey(`key:${trimmed}`);
    const forwarded = request.headers
        .get("x-forwarded-for")
        ?.split(",")[0]
        ?.trim();
    const ip =
        forwarded ||
        request.headers.get("x-real-ip") ||
        request.headers.get("cf-connecting-ip") ||
        "unknown";
    return hashKey(`ip:${ip}`);
}

export function checkRateLimit(key: string): {
    ok: boolean;
    retryAfterMs?: number;
} {
    const limit = configuredRpm();
    if (!Number.isFinite(limit)) return { ok: true };

    const now = Date.now();
    const windowStart = now - WINDOW_MS;
    const timestamps = (windows.get(key) ?? []).filter((t) => t > windowStart);

    if (timestamps.length >= limit) {
        const oldest = timestamps[0] ?? now;
        return { ok: false, retryAfterMs: Math.max(oldest + WINDOW_MS - now, 1) };
    }

    timestamps.push(now);
    windows.set(key, timestamps);
    return { ok: true };
}

export function rateLimitResponse(retryAfterMs?: number): Response {
    const headers = new Headers();
    if (retryAfterMs != null && retryAfterMs > 0) {
        headers.set("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
    }
    return Response.json(
        {
            error: "Too many requests. Please wait before trying again.",
            retryAfterMs,
        },
        { status: 429, headers },
    );
}
