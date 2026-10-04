/**
 * Sliding-window limits, shared through Redis when explicitly configured.
 * Forwarding headers are untrusted unless TRUSTED_PROXY_HOPS is set.
 */

import { createHash, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { Redis } from "@upstash/redis";

const DEFAULT_RPM = 60;
const WINDOW_MS = 60_000;
const MAX_MEMORY_KEYS = 10_000;
const STORE_FAILURE = { ok: false, retryAfterMs: 1_000 } as const;

export type RateLimitResult = { ok: boolean; retryAfterMs?: number };

// Server time avoids skew across replicas. Prune, count and admit atomically;
// separate GET/SET operations would allow concurrent requests past the cap.
const SLIDING_WINDOW_SCRIPT = `
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - window)
if redis.call('ZCARD', KEYS[1]) >= limit then
    local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
    return {0, math.max(tonumber(oldest[2]) + window - now, 1)}
end
redis.call('ZADD', KEYS[1], now, ARGV[3])
redis.call('PEXPIRE', KEYS[1], window)
return {1, 0}
`;

let sharedClient: { url: string; token: string; client: Redis } | undefined;

const windows = new Map<string, number[]>();
let lastSweepAt = 0;

function configuredRpm(): number {
    if (process.env.RATE_LIMIT_DISABLED === "true") return Infinity;
    const raw = process.env.RATE_LIMIT_RPM;
    if (!raw) return DEFAULT_RPM;
    const parsed = Number(raw);
    return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 100_000 ? parsed : DEFAULT_RPM;
}

function hashKey(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
}

function trustedClientIP(request: Request): string {
    const hops = Number(process.env.TRUSTED_PROXY_HOPS ?? 0);
    if (!Number.isSafeInteger(hops) || hops <= 0 || hops > 100) return "unknown";
    const forwarded = request.headers.get("x-forwarded-for");
    if (!forwarded || forwarded.length > 4_096) return "unknown";
    const chain = forwarded.split(",").map((address) => address.trim());
    if (chain.length < hops || chain.length > 100) return "unknown";
    const address = chain[chain.length - hops];
    return address && isIP(address) ? address.toLowerCase() : "unknown";
}

/** Hash the caller's key; otherwise use only an explicitly trusted proxy hop.
 * A Fetch Request has no socket peer address. Direct/untrusted callers share
 * the unknown bucket rather than being able to evade limits with headers.
 */
export function rateLimitKeyFromRequest(request: Request, apiKey?: string): string {
    const trimmed = apiKey?.trim();
    if (trimmed) return hashKey(`key:${trimmed}`);
    return hashKey(`ip:${trustedClientIP(request)}`);
}

export async function checkRateLimit(key: string): Promise<RateLimitResult> {
    const limit = configuredRpm();
    if (!Number.isFinite(limit)) return { ok: true };

    const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
    if (url || token) {
        // Misconfiguration/outage must not silently create a separate bucket
        // per process. Never log SDK errors: they can contain credentials.
        if (!url || !token) return STORE_FAILURE;
        try {
            if (sharedClient?.url !== url || sharedClient.token !== token) {
                sharedClient = {
                    url,
                    token,
                    client: new Redis({
                        url,
                        token,
                        retry: false,
                        signal: () => AbortSignal.timeout(3_000),
                    }),
                };
            }
            const result = await sharedClient.client.eval<unknown[], unknown>(
                SLIDING_WINDOW_SCRIPT,
                [`aidiy:rate-limit:${key}`],
                [limit, WINDOW_MS, randomUUID()],
            );
            if (
                !Array.isArray(result) ||
                result.length !== 2 ||
                (result[0] !== 0 && result[0] !== 1) ||
                !Number.isSafeInteger(result[1]) ||
                result[1] < 0 ||
                result[1] > WINDOW_MS
            )
                return STORE_FAILURE;
            return result[0] === 1
                ? { ok: true }
                : { ok: false, retryAfterMs: Math.max(result[1], 1) };
        } catch {
            return STORE_FAILURE;
        }
    }

    const now = Date.now();
    const windowStart = now - WINDOW_MS;
    if (now - lastSweepAt >= WINDOW_MS) {
        lastSweepAt = now;
        for (const [storedKey, values] of windows) {
            const active = values.filter((timestamp) => timestamp > windowStart);
            if (active.length > 0) windows.set(storedKey, active);
            else windows.delete(storedKey);
        }
    }
    const timestamps = (windows.get(key) ?? []).filter((t) => t > windowStart);

    // Do not evict active buckets: doing so would let a flood reset limits.
    if (!windows.has(key) && windows.size >= MAX_MEMORY_KEYS) return STORE_FAILURE;

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
