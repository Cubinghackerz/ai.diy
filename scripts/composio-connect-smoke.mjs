import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vite = await createServer({
    root,
    appType: "custom",
    server: { middlewareMode: true },
    resolve: { alias: { "~": path.join(root, "app") } },
});

let failures = 0;
function check(name, condition, detail = "") {
    if (condition) console.log(`ok - ${name}`);
    else {
        failures += 1;
        console.error(`FAIL - ${name}${detail ? `: ${detail}` : ""}`);
    }
}

const requests = [];
const originalFetch = globalThis.fetch;
let failConnections = false;

try {
    const {
        authorizeComposioToolkit,
        deleteComposioSession,
        ensureComposioSession,
        listComposioToolkits,
    } = await vite.ssrLoadModule(
        path.join(root, "app/lib/server/composio.ts"),
    );
    const { classifyComposioFailure } = await vite.ssrLoadModule(
        path.join(root, "app/routes/api.composio.ts"),
    );

    globalThis.fetch = async (input, init = {}) => {
        const url = String(input);
        const method = init.method ?? "GET";
        requests.push({ url, method, body: init.body ? JSON.parse(String(init.body)) : null });

        if (url.includes("/auth_configs")) {
            return Response.json({
                items: [
                    {
                        id: "ac_facebook_managed",
                        name: "Facebook",
                        toolkit: { slug: "facebook", logo: "" },
                        no_of_connections: 0,
                        status: "ENABLED",
                        auth_scheme: "OAUTH2",
                        is_composio_managed: true,
                    },
                ],
                next_cursor: null,
                total_pages: 1,
            });
        }

        if (url.includes("/connected_accounts?")) {
            return failConnections
                ? Response.json({ error: "connections unavailable" }, { status: 503 })
                : Response.json({ items: [], next_cursor: null, total_pages: 1 });
        }

        if (url.endsWith("/connected_accounts/link")) {
            return Response.json({
                connected_account_id: "ca_facebook_pending",
                expires_at: new Date(Date.now() + 60_000).toISOString(),
                link_token: "link-token",
                redirect_url: "https://connect.example.test/facebook",
            });
        }

        if (url.includes("/tool_router/session/")) {
            if (method === "DELETE") {
                return Response.json({ session_id: "trs_test_session", deleted: true });
            }
            return Response.json({
                config: { user_id: "aidiy-session-owner" },
                config_version: 1,
                mcp: { type: "http", url: "https://mcp.example.test/session" },
                session_id: "trs_test_session",
                tool_router_tools: [],
            });
        }

        if (url.includes("/toolkits?")) {
            return Response.json({
                items: [{ slug: "gmail", name: "Gmail" }],
                next_cursor: null,
            });
        }

        return Response.json({ error: `Unexpected Composio request: ${url}` }, { status: 500 });
    };

    const redirectUrl = await authorizeComposioToolkit({
        apiKey: "test-key",
        userId: "aidiy-test-user",
        toolkit: "facebook",
    });
    const linkRequest = requests.find((request) => request.url.endsWith("/connected_accounts/link"));

    check("managed auth config is resolved", requests.some((request) => request.url.includes("/auth_configs")));
    check("new connected-account link endpoint is used", Boolean(linkRequest));
    check(
        "legacy connected-account create endpoint is not used",
        !requests.some(
            (request) =>
                request.method === "POST" &&
                request.url.endsWith("/connected_accounts"),
        ),
    );
    check("link request carries the user id", linkRequest?.body?.user_id === "aidiy-test-user");
    check(
        "link request carries the auth config id",
        linkRequest?.body?.auth_config_id === "ac_facebook_managed",
    );
    check("OAuth redirect URL is returned", redirectUrl === "https://connect.example.test/facebook");

    const session = await ensureComposioSession({
        apiKey: "test-key",
        userId: "aidiy-session-owner",
        sessionId: "trs_test_session",
    });
    check("existing sessions can be reused", session.sessionId === "trs_test_session");
    check("reused session MCP URL is returned", session.mcpUrl === "https://mcp.example.test/session");

    let ownerRejected = false;
    try {
        await ensureComposioSession({
            apiKey: "test-key",
            userId: "aidiy-wrong-owner",
            sessionId: "trs_test_session",
        });
    } catch (error) {
        ownerRejected = error?.status === 403;
    }
    check("sessions cannot be reused across user IDs", ownerRejected);

    await deleteComposioSession({
        apiKey: "test-key",
        sessionId: "trs_test_session",
        userId: "aidiy-session-owner",
    });
    check(
        "session removal checks ownership before deletion",
        requests.some(
            (request) =>
                request.method === "DELETE" &&
                request.url.includes("/tool_router/session/trs_test_session"),
        ),
    );

    failConnections = true;
    const toolkitResult = await listComposioToolkits({
        apiKey: "test-key",
        userId: "aidiy-session-owner",
        sessionId: null,
    });
    check("catalog remains available when connections fail", toolkitResult.items.length === 1);
    check("connection failure is reported as unknown", toolkitResult.connectionsKnown === false);

    const invalidKey = classifyComposioFailure(
        "test",
        Object.assign(new Error('401 {"error":{"slug":"APIKey_InvalidAPIKey"}}'), {
            status: 401,
        }),
    );
    check("invalid keys preserve a 401 response", invalidKey.status === 401);
    check("invalid keys get a specific error code", invalidKey.code === "composio_invalid_key");

    const restrictedKey = classifyComposioFailure(
        "session",
        Object.assign(new Error("403 Permission denied"), {
            status: 403,
            headers: new Headers({ "x-request-id": "req_permissions" }),
        }),
    );
    check("restricted valid keys preserve a 403 response", restrictedKey.status === 403);
    check(
        "session permission errors are actionable",
        restrictedKey.message.includes("cannot create sessions"),
    );
    check("Composio request IDs are preserved", restrictedKey.requestId === "req_permissions");

    const wrappedPermission = classifyComposioFailure(
        "authorize",
        Object.assign(new Error("Failed to create connected account link"), {
            cause: Object.assign(new Error("403 Permission denied"), {
                statusCode: 403,
                headers: new Headers({ "x-request-id": "req_wrapped" }),
            }),
        }),
    );
    check("wrapped SDK errors preserve a 403 response", wrappedPermission.status === 403);
    check("wrapped SDK errors preserve request IDs", wrappedPermission.requestId === "req_wrapped");
} finally {
    globalThis.fetch = originalFetch;
    await vite.close();
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
