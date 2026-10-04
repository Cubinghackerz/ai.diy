import { formatMathResult } from "../app/lib/math-evaluator.ts";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { checkRateLimit, rateLimitKeyFromRequest } from "../app/lib/server/rate-limit.ts";
import {
    assertPublicHttpUrl,
    assertPublicHttpUrlResolved,
    fetchPublicHttpUrl,
} from "../app/lib/server/ssrf.ts";

let failures = 0;

function check(name, condition, detail = "") {
    if (condition) console.log(`ok - ${name}`);
    else {
        failures += 1;
        console.error(`FAIL - ${name}${detail ? `: ${detail}` : ""}`);
    }
}

async function main() {
    await checkRateLimitBackends();
    check("calculator preserves arithmetic", formatMathResult("2 + 2") === "Result: 4");
    check(
        "calculator preserves functions and exponentiation",
        formatMathResult("sqrt(144) + 2^3") === "Result: 20",
    );
    for (const payload of [
        "JSON.stringify(process.env)",
        'Function("return process")()',
        "process.exit()",
        'constructor.constructor("return process")()',
        "__proto__",
    ]) {
        const result = formatMathResult(payload);
        check(`calculator rejects code payload: ${payload}`, result.startsWith("Error:"));
    }

    for (const url of [
        "http://127.1",
        "http://2130706433",
        "http://0177.0.0.1",
        "http://localhost.",
        "http://[::1]",
        "http://[::ffff:127.0.0.1]",
        "http://[fc00::1]",
    ]) {
        let blocked = false;
        try {
            assertPublicHttpUrl(url);
        } catch {
            blocked = true;
        }
        check(`SSRF guard blocks ${url}`, blocked);
    }

    let publicUrlAccepted = true;
    try {
        assertPublicHttpUrl("https://example.com");
    } catch {
        publicUrlAccepted = false;
    }
    check("SSRF guard accepts a public HTTPS URL", publicUrlAccepted);

    let asyncPrivateBlocked = false;
    try {
        await assertPublicHttpUrlResolved("http://localhost.");
    } catch {
        asyncPrivateBlocked = true;
    }
    check("async SSRF guard blocks private hosts", asyncPrivateBlocked);

    let redirectPrivateBlocked = false;
    try {
        await fetchPublicHttpUrl("http://127.0.0.1");
    } catch {
        redirectPrivateBlocked = true;
    }
    check("public fetch validates its first hop", redirectPrivateBlocked);

    console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
    process.exit(failures === 0 ? 0 : 1);
}

// Isolated memory and Redis REST contract checks; no real provider/Redis keys.
// This stub verifies the SDK wire contract, not Lua execution in live Redis.
async function checkRateLimitBackends() {
    const names = [
        "RATE_LIMIT_DISABLED",
        "RATE_LIMIT_RPM",
        "TRUSTED_PROXY_HOPS",
        "UPSTASH_REDIS_REST_URL",
        "UPSTASH_REDIS_REST_TOKEN",
    ];
    const saved = names.map((name) => process.env[name]);
    let server;
    try {
        process.env.RATE_LIMIT_DISABLED = "false";
        process.env.RATE_LIMIT_RPM = "1";
        process.env.TRUSTED_PROXY_HOPS = "0";
        delete process.env.UPSTASH_REDIS_REST_URL;
        delete process.env.UPSTASH_REDIS_REST_TOKEN;
        const key = randomUUID();
        check("memory limiter admits first request", (await checkRateLimit(key)).ok);
        check("memory limiter rejects excess request", !(await checkRateLimit(key)).ok);
        const base = new Request("https://fixture.test/api/search");
        const spoof = new Request(base, { headers: { "x-forwarded-for": "198.51.100.1" } });
        check(
            "untrusted forwarding header cannot change rate identity",
            rateLimitKeyFromRequest(base) === rateLimitKeyFromRequest(spoof),
        );

        let calls = 0;
        server = createServer(async (request, response) => {
            let body = "";
            for await (const chunk of request) body += chunk;
            const parsed = JSON.parse(body);
            const command = request.url === "/pipeline" ? parsed[0] : parsed;
            check(
                "Redis REST authenticates with fixture token",
                request.headers.authorization === "Bearer fixture-redis-token",
            );
            check(
                "Redis REST uses atomic EVAL with a hashed identity",
                command[0].toLowerCase() === "eval" &&
                    command[2] === 1 &&
                    command[3] ===
                        `aidiy:rate-limit:${rateLimitKeyFromRequest(base, "fixture-key")}`,
            );
            check(
                "Redis script and arguments contain no raw provider key",
                !body.includes("fixture-key"),
            );
            const result = { result: calls++ === 0 ? [1, 0] : [0, 60_000] };
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify(request.url === "/pipeline" ? [result] : result));
        });
        await new Promise((resolve, reject) => {
            server.once("error", reject);
            server.listen(0, "127.0.0.1", resolve);
        });
        process.env.UPSTASH_REDIS_REST_URL = `http://127.0.0.1:${server.address().port}`;
        process.env.UPSTASH_REDIS_REST_TOKEN = "fixture-redis-token";
        const sharedKey = rateLimitKeyFromRequest(base, "fixture-key");
        check("Redis limiter admits shared response", (await checkRateLimit(sharedKey)).ok);
        check("Redis limiter rejects shared response", !(await checkRateLimit(sharedKey)).ok);
        check("Redis limiter reaches REST store for both checks", calls === 2);
    } finally {
        if (server?.listening) await new Promise((resolve) => server.close(resolve));
        names.forEach((name, index) => {
            if (saved[index] === undefined) delete process.env[name];
            else process.env[name] = saved[index];
        });
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
