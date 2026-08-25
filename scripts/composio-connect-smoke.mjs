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

try {
    const { authorizeComposioToolkit } = await vite.ssrLoadModule(
        path.join(root, "app/lib/server/composio.ts"),
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
            return Response.json({ items: [], next_cursor: null, total_pages: 1 });
        }

        if (url.endsWith("/connected_accounts/link")) {
            return Response.json({
                connected_account_id: "ca_facebook_pending",
                expires_at: new Date(Date.now() + 60_000).toISOString(),
                link_token: "link-token",
                redirect_url: "https://connect.example.test/facebook",
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
} finally {
    globalThis.fetch = originalFetch;
    await vite.close();
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
