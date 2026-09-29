/**
 * Regression harness for "ChatGPT keeps forcing me to reconnect".
 *
 * Drives the real Login-with-ChatGPT SDK handler against a fake OpenAI token
 * endpoint that rotates refresh tokens exactly like the real one (a reused
 * refresh token is a dead session). No network, no account, no secrets.
 *
 *   node scripts/chatgpt-refresh-race-smoke.mjs raw      # SDK alone: shows the bugs
 *   node scripts/chatgpt-refresh-race-smoke.mjs guarded  # through our guard (default, in `npm run smoke`)
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import {
    MemoryStore,
    createChatGPTHandler,
    encryptJson,
    sign,
} from "@opencoredev/loginwithchatgpt-server";

const mode = process.argv[2] === "raw" ? "raw" : "guarded";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SECRET = "test-secret-".padEnd(48, "x");
const ORIGIN = "http://localhost:3000";
const SESSION_ID = "session-under-test-0123456789ab";

let failures = 0;
function check(name, condition, detail = "") {
    if (condition) console.log(`ok - ${name}`);
    else {
        failures += 1;
        console.error(`FAIL - ${name}${detail ? `: ${detail}` : ""}`);
    }
}

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
function jwt(claims) {
    return `${b64({ alg: "none" })}.${b64(claims)}.sig`;
}
function idToken() {
    return jwt({
        email: "test@example.com",
        exp: Math.floor(Date.now() / 1000) + 3600,
        "https://api.openai.com/auth": {
            chatgpt_account_id: "acct_test",
            chatgpt_plan_type: "plus",
        },
    });
}

/** Fake auth.openai.com + chatgpt.com: rotating refresh tokens, reuse is fatal. */
function createFakeOpenAI({ refreshDelayMs = 40 } = {}) {
    let generation = 0;
    const state = { validRefresh: "refresh-0", refreshCalls: 0, reused: 0, tokenErrors: [] };
    const issue = () => {
        generation += 1;
        state.validRefresh = `refresh-${generation}`;
        return {
            access_token: jwt({
                exp: Math.floor(Date.now() / 1000) + 3600,
                "https://api.openai.com/auth": { chatgpt_account_id: "acct_test" },
            }),
            id_token: idToken(),
            refresh_token: state.validRefresh,
            expires_in: 3600,
        };
    };
    const baseFetch = async (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (url.endsWith("/oauth/token")) {
            state.refreshCalls += 1;
            const body = JSON.parse(init?.body ?? "{}");
            await new Promise((resolve) => setTimeout(resolve, refreshDelayMs));
            if (state.dead || body.refresh_token !== state.validRefresh) {
                state.reused += 1;
                state.tokenErrors.push(state.dead ? "dead" : "reused");
                return new Response(JSON.stringify({ error: "refresh_token_reused" }), {
                    status: 400,
                    headers: { "content-type": "application/json" },
                });
            }
            return Response.json(issue());
        }
        if (url.includes("/responses")) {
            return new Response("data: {}\n\n", { headers: { "content-type": "text/event-stream" } });
        }
        if (url.includes("/models")) {
            return Response.json({ models: [{ slug: "gpt-test" }] });
        }
        if (url.includes("/deviceauth/usercode")) {
            return Response.json({
                device_auth_id: "dev-1",
                user_code: "ABCD-EFGH",
                interval: "5",
            });
        }
        return new Response("not found", { status: 404 });
    };
    let current = baseFetch;
    return {
        fetchImpl: (input, init) => current(input, init),
        baseFetch,
        setFetch: (next) => {
            current = next;
        },
        state,
    };
}

async function seed({ store, expired = true }) {
    const tokens = {
        accessToken: jwt({
            exp: Math.floor(Date.now() / 1000) + (expired ? -60 : 3600),
            "https://api.openai.com/auth": { chatgpt_account_id: "acct_test" },
        }),
        refreshToken: "refresh-0",
        idToken: idToken(),
        accountId: "acct_test",
        expiresAt: Date.now() + (expired ? -60_000 : 3_600_000),
    };
    await store.set(SESSION_ID, {
        status: "authenticated",
        tokensCipher: await encryptJson(tokens, SECRET),
        user: { accountId: "acct_test", email: "test@example.com", plan: "plus" },
        createdAt: Date.now(),
        updatedAt: Date.now(),
    });
    return `lwc_session=${encodeURIComponent(await sign(SESSION_ID, SECRET))}`;
}

const vite = await createServer({
    root,
    appType: "custom",
    server: { middlewareMode: true },
    resolve: { alias: { "~": path.join(root, "app") } },
    logLevel: "silent",
});

async function scenario(name, run) {
    const fake = createFakeOpenAI();
    const store = new MemoryStore();
    const handler = createChatGPTHandler({
        secret: SECRET,
        sessionStore: store,
        basePath: "/api/chatgpt",
        fetch: fake.fetchImpl,
        sessionTtlMs: 180 * 86_400_000,
    });
    let entry = (request) => handler.handler(request);
    let chatHandler = handler;
    if (mode === "guarded") {
        const { createChatGPTGuard } = await vite.ssrLoadModule(
            path.join(root, "app/lib/server/chatgpt-guard.ts"),
        );
        const guard = createChatGPTGuard({ getHandler: () => handler });
        entry = guard.handle;
        chatHandler = guard.wrap(handler);
    }
    const cookie = await seed({ store });
    const call = (method, route, extra = {}) =>
        entry(
            new Request(`${ORIGIN}/api/chatgpt${route}`, {
                method,
                headers: { cookie, ...(extra.headers ?? {}) },
                body: extra.body,
            }),
        );
    /** How api.chat.ts talks to ChatGPT: in-process proxyFetch, not the HTTP route. */
    const chat = () => {
        const browserRequest = new Request(`${ORIGIN}/api/chat`, { method: "POST", headers: { cookie } });
        return chatHandler.proxyFetch(browserRequest)(`${ORIGIN}/api/chatgpt/responses`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ model: "gpt-test", input: [] }),
        });
    };
    console.log(`\n# ${name} (${mode})`);
    await run({ fake, store, call, cookie, chat });
}

await scenario("validation racing a chat's token refresh keeps the session", async ({ fake, store, call }) => {
    // /models refreshes via getFreshTokens; /status refreshes via advance().
    // Both start from the same expired token and rotation makes the loser dead.
    const results = await Promise.all([call("GET", "/models"), call("GET", "/status"), call("GET", "/session")]);
    const stored = await store.get(SESSION_ID);
    check("session record still exists after concurrent refresh", Boolean(stored), `refreshCalls=${fake.state.refreshCalls} reused=${fake.state.reused}`);
    check("refresh token used exactly once", fake.state.refreshCalls === 1, `calls=${fake.state.refreshCalls}`);
    const after = await (await call("GET", "/session")).json();
    check("session still reports authenticated afterwards", after.status === "authenticated", JSON.stringify(after));
    void results;
});

await scenario("validation losing the race must not delete the session", async ({ fake, store, call }) => {
    // Chat's refresh starts first, so validation (advance) is the one holding a
    // rotated-out token. The SDK deletes the session when advance() sees that.
    const chat = call("GET", "/models");
    await new Promise((resolve) => setTimeout(resolve, 5));
    const validation = call("GET", "/status");
    await Promise.all([chat, validation]);
    check("session record survives validation losing the race", Boolean(await store.get(SESSION_ID)), `refreshCalls=${fake.state.refreshCalls} reused=${fake.state.reused}`);
    const after = await (await call("GET", "/session")).json();
    check("user is still signed in afterwards", after.status === "authenticated", JSON.stringify(after));
});

await scenario("real chat traffic (in-process proxyFetch) racing validation", async ({ fake, store, call, chat }) => {
    const turn = chat();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const validation = call("GET", "/status");
    await Promise.allSettled([turn, validation]);
    check("session survives a chat turn racing a validation", Boolean(await store.get(SESSION_ID)), `refreshCalls=${fake.state.refreshCalls} reused=${fake.state.reused}`);
    check("chat turn and validation share one refresh", fake.state.refreshCalls === 1, `calls=${fake.state.refreshCalls}`);
    const after = await (await call("GET", "/session")).json();
    check("still authenticated after chat + validation", after.status === "authenticated", JSON.stringify(after));
});

await scenario("a burst of parallel chat requests refreshes once", async ({ fake, store, call }) => {
    await Promise.all([call("GET", "/models"), call("GET", "/models"), call("GET", "/models"), call("GET", "/status")]);
    check("one refresh for the whole burst", fake.state.refreshCalls === 1, `calls=${fake.state.refreshCalls}`);
    check("session record intact", Boolean(await store.get(SESSION_ID)));
});

await scenario("POST /login on a live session does not wipe its tokens", async ({ store, call }) => {
    const before = await store.get(SESSION_ID);
    const response = await call("POST", "/login");
    const body = await response.json().catch(() => ({}));
    const after = await store.get(SESSION_ID);
    check(
        "session still holds tokens after a stray login click",
        Boolean(after?.tokensCipher),
        `status=${after?.status} loginBody=${JSON.stringify(body).slice(0, 80)}`,
    );
    check("login on a live session reports authenticated", body.status === "authenticated", JSON.stringify(body).slice(0, 120));
    void before;
});

await scenario("randomized interleavings never lose the session", async ({ fake, store, call }) => {
    let lostAt = -1;
    for (let round = 0; round < 25 && lostAt < 0; round += 1) {
        // Expire the access token again so each round has to refresh.
        const record = await store.get(SESSION_ID);
        if (!record) {
            lostAt = round;
            break;
        }
        const tokens = await (await import("@opencoredev/loginwithchatgpt-server")).decryptJson(record.tokensCipher, SECRET);
        await store.set(SESSION_ID, {
            ...record,
            tokensCipher: await encryptJson({ ...tokens, expiresAt: Date.now() - 1000, accessToken: jwt({ exp: Math.floor(Date.now() / 1000) - 60, "https://api.openai.com/auth": { chatgpt_account_id: "acct_test" } }) }, SECRET),
        });
        const routes = ["/models", "/status", "/session", "/models", "/status", "/responses"];
        const jobs = routes.map(async (route) => {
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 25));
            return call(route === "/responses" ? "POST" : "GET", route, route === "/responses" ? { body: "{}" } : {});
        });
        await Promise.all(jobs);
        if (!(await store.get(SESSION_ID))) lostAt = round;
    }
    check("session survives 25 rounds of random validation/chat interleavings", lostAt < 0, `lost in round ${lostAt}, reused=${fake.state.reused}`);
    check("no refresh token was ever reused", fake.state.reused === 0, `reused=${fake.state.reused}`);
});

await scenario("a transient upstream failure does not end the session", async ({ fake, store, call }) => {
    const original = fake.baseFetch;
    fake.state.failNext = true;
    const patched = async (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (url.endsWith("/oauth/token") && fake.state.failNext) {
            fake.state.failNext = false;
            return new Response("upstream unavailable", { status: 503 });
        }
        return original(input, init);
    };
    fake.setFetch(patched);
    const first = await call("GET", "/session");
    check("transient failure is reported as an error, not a sign-out", first.status >= 500, `status=${first.status}`);
    check("session record kept after a 503 from OpenAI", Boolean(await store.get(SESSION_ID)));
    const second = await (await call("GET", "/session")).json();
    check("next check recovers to authenticated", second.status === "authenticated", JSON.stringify(second));
});

await scenario("login on a dead session starts a real sign-in", async ({ fake, call }) => {
    fake.state.dead = true;
    const body = await (await call("POST", "/login")).json();
    check("dead session falls through to a device code", body.status === "pending" && Boolean(body.userCode), JSON.stringify(body).slice(0, 120));
});

await scenario("a genuinely dead refresh token still ends in expired", async ({ fake, call }) => {
    fake.state.dead = true;
    const body = await (await call("GET", "/session")).json();
    check("dead token surfaces as expired", body.status === "expired", JSON.stringify(body));
});

await vite.close();
if (failures > 0) {
    console.error(`\n${failures} refresh-race check(s) failed (${mode})`);
    process.exit(1);
}
console.log(`\nAll refresh-race checks passed (${mode}).`);
