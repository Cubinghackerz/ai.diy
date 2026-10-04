// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    checkRateLimit,
    rateLimitKeyFromRequest,
    rateLimitResponse,
} from "~/lib/server/rate-limit";

const redis = vi.hoisted(() => ({ eval: vi.fn(), construct: vi.fn() }));
vi.mock("@upstash/redis", () => ({
    Redis: class {
        constructor(config: unknown) {
            redis.construct(config);
        }
        eval = redis.eval;
    },
}));

const request = (forwarded?: string, extra: Record<string, string> = {}) =>
    new Request("https://example.test/api/search", {
        headers: { ...(forwarded ? { "x-forwarded-for": forwarded } : {}), ...extra },
    });

beforeEach(() => {
    vi.stubEnv("RATE_LIMIT_DISABLED", "false");
    vi.stubEnv("RATE_LIMIT_RPM", "2");
    vi.stubEnv("TRUSTED_PROXY_HOPS", "0");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    redis.eval.mockReset();
    redis.construct.mockClear();
});
afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
});

describe("rate-limit identity", () => {
    it("ignores all forwarding headers unless proxy trust is explicitly configured", () => {
        const baseline = rateLimitKeyFromRequest(request());
        expect(rateLimitKeyFromRequest(request("198.51.100.1"))).toBe(baseline);
        expect(
            rateLimitKeyFromRequest(
                request(undefined, {
                    "x-real-ip": "198.51.100.2",
                    "cf-connecting-ip": "198.51.100.3",
                }),
            ),
        ).toBe(baseline);
    });
    it("uses the trusted right-hand hop, never a spoofable leftmost address", () => {
        vi.stubEnv("TRUSTED_PROXY_HOPS", "1");
        expect(rateLimitKeyFromRequest(request("198.51.100.10, 203.0.113.7"))).toBe(
            rateLimitKeyFromRequest(request("198.51.100.11, 203.0.113.7")),
        );
        vi.stubEnv("TRUSTED_PROXY_HOPS", "2");
        expect(rateLimitKeyFromRequest(request("192.0.2.1, 203.0.113.7, 192.0.2.2"))).toBe(
            rateLimitKeyFromRequest(request("203.0.113.7, 192.0.2.2")),
        );
    });
    it.each(["garbage", "-1", "1.5", "101"])("fails safe for invalid hop count %s", (hops) => {
        vi.stubEnv("TRUSTED_PROXY_HOPS", hops);
        expect(rateLimitKeyFromRequest(request("198.51.100.1"))).toBe(
            rateLimitKeyFromRequest(request()),
        );
    });
    it("groups invalid or insufficient forwarding chains instead of trusting them", () => {
        vi.stubEnv("TRUSTED_PROXY_HOPS", "2");
        const baseline = rateLimitKeyFromRequest(request());
        expect(rateLimitKeyFromRequest(request("198.51.100.1"))).toBe(baseline);
        expect(rateLimitKeyFromRequest(request("not-an-ip, 192.0.2.1"))).toBe(baseline);
    });
    it("hashes key identity and does not expose the supplied value", () => {
        const key = rateLimitKeyFromRequest(request("198.51.100.1"), " fixture-key ");
        expect(key).toMatch(/^[a-f0-9]{64}$/);
        expect(key).toBe(rateLimitKeyFromRequest(request(), "fixture-key"));
        expect(key).not.toContain("fixture-key");
    });
});

describe("rate-limit stores", () => {
    it("bounds memory requests and releases them at the sliding-window boundary", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(100_000);
        const key = `memory-${crypto.randomUUID()}`;
        expect(await checkRateLimit(key)).toEqual({ ok: true });
        expect(await checkRateLimit(key)).toEqual({ ok: true });
        expect(await checkRateLimit(key)).toEqual({ ok: false, retryAfterMs: 60_000 });
        vi.advanceTimersByTime(60_000);
        expect(await checkRateLimit(key)).toEqual({ ok: true });
    });
    it("uses one atomic shared-store evaluation and never sends raw credentials", async () => {
        vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.test");
        vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fixture-redis-token");
        redis.eval.mockResolvedValueOnce([1, 0]).mockResolvedValueOnce([0, 2_400]);
        const key = rateLimitKeyFromRequest(request(), "fixture-provider-key");
        expect(await checkRateLimit(key)).toEqual({ ok: true });
        expect(await checkRateLimit(key)).toEqual({ ok: false, retryAfterMs: 2_400 });
        expect(redis.eval).toHaveBeenCalledTimes(2);
        const [script, keys, args] = redis.eval.mock.calls[0];
        expect(script).toContain("redis.call('TIME')");
        expect(script).toContain("ZREMRANGEBYSCORE");
        expect(script).toContain("PEXPIRE");
        expect(keys).toEqual([`aidiy:rate-limit:${key}`]);
        expect(args[0]).toBe(2);
        expect(args[1]).toBe(60_000);
        expect(JSON.stringify(redis.eval.mock.calls)).not.toContain("fixture-provider-key");
        expect(redis.eval.mock.calls[1][2][2]).not.toBe(args[2]);
    });
    it.each([new Error("fixture secret"), null, [1], [1, -1], ["1", 0]])(
        "fails closed on a configured shared-store failure or invalid response",
        async (result) => {
            vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.test");
            vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fixture-redis-token");
            if (result instanceof Error) redis.eval.mockRejectedValue(result);
            else redis.eval.mockResolvedValue(result);
            expect(await checkRateLimit(`failure-${crypto.randomUUID()}`)).toEqual({
                ok: false,
                retryAfterMs: 1_000,
            });
        },
    );
    it("does not silently use memory for incomplete Redis configuration", async () => {
        vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.test");
        expect(await checkRateLimit(`partial-${crypto.randomUUID()}`)).toEqual({
            ok: false,
            retryAfterMs: 1_000,
        });
    });
    it("only skips stores when explicitly disabled", async () => {
        vi.stubEnv("RATE_LIMIT_DISABLED", "true");
        expect(await checkRateLimit("disabled")).toEqual({ ok: true });
        expect(redis.eval).not.toHaveBeenCalled();
    });
    it("returns bounded retry information without identities", async () => {
        const response = rateLimitResponse(2_400);
        expect(response.status).toBe(429);
        expect(response.headers.get("Retry-After")).toBe("3");
        expect(await response.json()).toEqual({
            error: "Too many requests. Please wait before trying again.",
            retryAfterMs: 2_400,
        });
    });
});
