import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { corsPreflight, withCors } from "~/lib/server/cors";
import {
    authorizeComposioToolkit,
    disconnectComposioToolkit,
    ensureComposioSession,
    listComposioToolkits,
    testComposioKey,
} from "~/lib/server/composio";
import {
    checkRateLimit,
    rateLimitKeyFromRequest,
    rateLimitResponse,
} from "~/lib/server/rate-limit";

type ComposioActionBody = {
    action?: "test" | "session" | "toolkits" | "authorize" | "disconnect";
    apiKey?: string;
    userId?: string;
    sessionId?: string | null;
    toolkit?: string;
    connectedAccountId?: string;
};

export function loader({ request }: LoaderFunctionArgs) {
    const preflight = corsPreflight(request);
    if (preflight) return preflight;
    return withCors(request, new Response("Method Not Allowed", { status: 405 }));
}

export async function action({ request }: ActionFunctionArgs) {
    const preflight = corsPreflight(request);
    if (preflight) return preflight;
    if (request.method !== "POST") {
        return withCors(request, new Response("Method Not Allowed", { status: 405 }));
    }

    try {
        const body = (await request.json()) as ComposioActionBody;
        const apiKey = body.apiKey?.trim() ?? "";
        if (!apiKey) {
            return withCors(
                request,
                Response.json({ ok: false, error: "Composio API key required." }, { status: 400 }),
            );
        }

        const rateKey = rateLimitKeyFromRequest(request, apiKey);
        const rateCheck = checkRateLimit(rateKey);
        if (!rateCheck.ok) {
            return withCors(request, rateLimitResponse(rateCheck.retryAfterMs));
        }
        const userId =
            body.userId?.trim() ||
            `aidiy-${crypto.randomUUID().slice(0, 12)}`;

        switch (body.action) {
            case "test": {
                await testComposioKey(apiKey);
                return withCors(request, Response.json({ ok: true }));
            }
            case "session": {
                const session = await ensureComposioSession({
                    apiKey,
                    userId,
                    sessionId: body.sessionId ?? null,
                });
                return withCors(
                    request,
                    Response.json({
                        ok: true,
                        userId,
                        ...session,
                    }),
                );
            }
            case "toolkits": {
                const result = await listComposioToolkits({
                    apiKey,
                    userId,
                    sessionId: body.sessionId ?? null,
                });
                return withCors(request, Response.json({ ok: true, userId, ...result }));
            }
            case "authorize": {
                const toolkit = body.toolkit?.trim();
                if (!toolkit) {
                    return withCors(
                        request,
                        Response.json({ ok: false, error: "Toolkit required." }, { status: 400 }),
                    );
                }
                const redirectUrl = await authorizeComposioToolkit({
                    apiKey,
                    userId,
                    sessionId: body.sessionId ?? null,
                    toolkit,
                });
                return withCors(
                    request,
                    Response.json({ ok: true, userId, redirectUrl }),
                );
            }
            case "disconnect": {
                if (!body.connectedAccountId && !body.toolkit) {
                    return withCors(
                        request,
                        Response.json(
                            { ok: false, error: "Connected account or toolkit required." },
                            { status: 400 },
                        ),
                    );
                }
                await disconnectComposioToolkit({
                    apiKey,
                    connectedAccountId: body.connectedAccountId,
                    toolkit: body.toolkit,
                    userId,
                });
                return withCors(request, Response.json({ ok: true }));
            }
            default:
                return withCors(
                    request,
                    Response.json({ ok: false, error: "Unknown action." }, { status: 400 }),
                );
        }
    } catch (error) {
        const raw = error instanceof Error ? error.message : "Composio request failed.";
        console.warn("[composio] request failed:", raw.slice(0, 500));
        const message = /APIKey_InsufficientPermissions|InsufficientPermissions/.test(raw)
            ? "Your Composio key is valid but this key has read-only access. Grant it \"sessions\" write access in dashboard.composio.dev, or create a new key."
            : /Invalid API key|APIKey_Invalid|HTTP 401|HTTP 403|status...401|status...403|401 \{|403 \{/.test(
                  raw,
              )
              ? "Invalid Composio API key. Check it in Settings and retry."
              : raw.slice(0, 220);
        return withCors(
            request,
            Response.json({ ok: false, error: message }, { status: 502 }),
        );
    }
}
