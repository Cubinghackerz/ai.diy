/**
 * "Are the newest GPT models visible?" — end to end, offline.
 *
 * ChatGPT only lists newer models (GPT-6 / GPT-6.1 Sol and Luna) to clients that
 * report a recent Codex `client_version`. This drives the app's real guard,
 * session handler, fetch wrapper and `/api/models` route against a fake OpenAI
 * that applies that gate, signs in through the real device-code flow, and checks
 * what the model list contains. It also proves the fake gate really hides the new
 * models from an old client, that a stale LWC_CLIENT_VERSION cannot bring that back,
 * and that a newer one is honoured.
 *
 *   node scripts/chatgpt-model-gate-smoke.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(here), "..");
const ORIGIN = "http://localhost:3000";
const FIRST_VERSION_WITH_GPT6 = [0, 159, 0];

const parseVersion = (value) =>
    String(value)
        .split(".")
        .map((part) => Number.parseInt(part, 10) || 0);
const atLeast = (version, floor) => {
    for (let index = 0; index < 3; index += 1) {
        if ((version[index] ?? 0) !== floor[index]) return (version[index] ?? 0) > floor[index];
    }
    return true;
};

if (process.argv[2] === "child") {
    // ---- one scenario, in its own process (the handler is cached per process) ----
    process.env.VERCEL = "1"; // in-memory session store
    process.env.LWC_SECRET = "test-secret-".padEnd(48, "x");
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.KV_REST_API_URL;

    const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const jwt = (claims) => `${b64({ alg: "none" })}.${b64(claims)}.sig`;
    const requestedVersions = [];

    const fakeOpenAI = async (input, init) => {
        const url = new URL(
            typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
        );
        if (url.pathname.endsWith("/deviceauth/usercode")) {
            return Response.json({
                device_auth_id: "dev-1",
                user_code: "ABCD-EFGH",
                interval: "1",
            });
        }
        if (url.pathname.endsWith("/deviceauth/token")) {
            return Response.json({
                authorization_code: "code-1",
                code_challenge: "challenge",
                code_verifier: "verifier",
            });
        }
        if (url.pathname.endsWith("/oauth/token")) {
            const claims = {
                email: "test@example.com",
                exp: Math.floor(Date.now() / 1000) + 3600,
                "https://api.openai.com/auth": {
                    chatgpt_account_id: "acct_test",
                    chatgpt_plan_type: "plus",
                },
            };
            return Response.json({
                access_token: jwt(claims),
                id_token: jwt(claims),
                refresh_token: "refresh-0",
                expires_in: 3600,
            });
        }
        if (url.pathname.endsWith("/models")) {
            const version = url.searchParams.get("client_version") ?? "0.0.0";
            requestedVersions.push(version);
            const base = ["gpt-5.6-luna", "gpt-5.6-sol", "gpt-5.5", "gpt-5.4", "gpt-image-1"];
            const gated = atLeast(parseVersion(version), FIRST_VERSION_WITH_GPT6)
                ? ["gpt-6.1-sol", "gpt-6-sol", "gpt-6-luna", ...base]
                : base;
            return Response.json({ models: gated.map((slug) => ({ slug })) });
        }
        return new Response("not found", { status: 404 });
    };
    globalThis.fetch = fakeOpenAI;

    const { createServer } = await import("vite");
    const vite = await createServer({
        root,
        appType: "custom",
        server: { middlewareMode: true },
        resolve: { alias: { "~": path.join(root, "app") } },
        logLevel: "silent",
    });
    const auth = await vite.ssrLoadModule(path.join(root, "app/lib/server/chatgpt-auth.ts"));
    const modelsRoute = await vite.ssrLoadModule(path.join(root, "app/routes/api.models.ts"));
    const guard = auth.getChatGPTGuard();

    // Sign in through the real device-code flow.
    const login = await guard.handle(
        new Request(`${ORIGIN}/api/chatgpt/login`, { method: "POST" }),
    );
    const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
    const status = await guard.handle(
        new Request(`${ORIGIN}/api/chatgpt/status`, { headers: { cookie } }),
    );
    const session = await status.json();

    const response = await modelsRoute.action({
        request: new Request(`${ORIGIN}/api/models`, {
            method: "POST",
            headers: { cookie, "content-type": "application/json" },
            body: JSON.stringify({ provider: "chatgpt", apiKey: "" }),
        }),
        params: {},
        context: {},
    });
    const body = await response.json();
    await vite.close();

    // What the fake gate answers an old 0.147.0 client (proves the gate is real).
    const oldAnswer = await (
        await fakeOpenAI("https://chatgpt.com/backend-api/codex/models?client_version=0.147.0")
    ).json();
    requestedVersions.pop();

    console.log(
        JSON.stringify({
            oldClientIds: oldAnswer.models.map((model) => model.slug),
            defaultVersion: auth.DEFAULT_LWC_CLIENT_VERSION,
            sessionStatus: session.status,
            live: body.live,
            ids: (body.models ?? []).map((model) => model.id),
            names: (body.models ?? []).map((model) => model.name),
            requestedVersions,
        }),
    );
    process.exit(0);
}

// ---- parent: run the shipped default, then the old pinned version ----
let failures = 0;
function check(name, condition, detail = "") {
    if (condition) console.log(`ok - ${name}`);
    else {
        failures += 1;
        console.error(`FAIL - ${name}${detail ? `: ${detail}` : ""}`);
    }
}

function runScenario(extraEnv) {
    const result = spawnSync(process.execPath, [here, "child"], {
        cwd: root,
        env: { ...process.env, ...extraEnv },
        encoding: "utf8",
        timeout: 120_000,
    });
    const line = result.stdout.trim().split("\n").filter(Boolean).at(-1) ?? "";
    try {
        return JSON.parse(line);
    } catch {
        console.error(result.stdout, result.stderr);
        throw new Error("scenario did not print a result");
    }
}

const shipped = runScenario({});
check(
    "signs in through the real device-code flow",
    shipped.sessionStatus === "authenticated",
    shipped.sessionStatus,
);
check("model list is live", shipped.live === true);
check(
    "the version we actually send meets the GPT-6 floor",
    atLeast(parseVersion(shipped.requestedVersions[0] ?? "0"), FIRST_VERSION_WITH_GPT6),
    shipped.requestedVersions.join(","),
);
check(
    "request carries the configured default version",
    shipped.requestedVersions[0] === shipped.defaultVersion,
    `${shipped.requestedVersions[0]} vs ${shipped.defaultVersion}`,
);
for (const id of ["gpt-6.1-sol", "gpt-6-sol", "gpt-6-luna"]) {
    check(`${id} is in the account list`, shipped.ids.includes(id), shipped.ids.join(","));
}
check(
    "newest model is listed first",
    shipped.ids[0] === "gpt-6.1-sol",
    shipped.ids.slice(0, 3).join(","),
);
check(
    "newer models rank above GPT-5.6",
    shipped.ids.indexOf("gpt-6-luna") < shipped.ids.indexOf("gpt-5.6-luna"),
);
check("names are display-ready", shipped.names[0] === "GPT-6.1 Sol", String(shipped.names[0]));

check(
    "the fake gate really hides GPT-6 from a 0.147.0 client (so the checks above are meaningful)",
    !shipped.oldClientIds.includes("gpt-6.1-sol") && !shipped.oldClientIds.includes("gpt-6-luna"),
    shipped.oldClientIds.join(","),
);

// A deployment that copied the old LWC_CLIENT_VERSION=0.147.0 must not hide the new models.
const staleEnv = runScenario({ LWC_CLIENT_VERSION: "0.147.0" });
check(
    "a stale LWC_CLIENT_VERSION is ignored in favour of the built-in default",
    staleEnv.requestedVersions[0] === staleEnv.defaultVersion,
    `${staleEnv.requestedVersions[0]} vs ${staleEnv.defaultVersion}`,
);
check(
    "GPT-6.1 Sol is still visible with a stale LWC_CLIENT_VERSION",
    staleEnv.ids.includes("gpt-6.1-sol"),
    staleEnv.ids.join(","),
);

// A newer value is honoured, so the knob still works for the next release.
const raised = runScenario({ LWC_CLIENT_VERSION: "0.170.2" });
check("a newer LWC_CLIENT_VERSION is honoured", raised.requestedVersions[0] === "0.170.2");

if (failures > 0) {
    console.error(`${failures} model-gate check(s) failed`);
    process.exit(1);
}
console.log("All ChatGPT model-gate checks passed.");
