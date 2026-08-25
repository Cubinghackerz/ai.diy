import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { corsPreflight, withCors } from "~/lib/server/cors";
import {
    authorizeComposioToolkit,
    composioErrorMetadata,
    deleteComposioSession,
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
    action?: "test" | "session" | "toolkits" | "authorize" | "disconnect" | "remove";
    apiKey?: string;
    userId?: string;
    sessionId?: string | null;
    toolkit?: string;
    connectedAccountId?: string;
};

type ComposioFailure = {
    message: string;
    status: number;
    code: string;
    requestId?: string;
};

function errorRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : undefined;
}

function errorText(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function classifyComposioFailure(
    action: ComposioActionBody["action"],
    error: unknown,
): ComposioFailure {
    const record = errorRecord(error);
    const body = errorRecord(record?.error);
    const nested = errorRecord(body?.error);
    const raw = error instanceof Error ? error.message : "Composio request failed.";
    const metadata = composioErrorMetadata(error);
    const statusCandidates = [metadata.status, record?.status, body?.status, nested?.status];
    const upstreamStatus = statusCandidates.find(
        (value): value is number => typeof value === "number",
    );
    const headers = record?.headers instanceof Headers ? record.headers : undefined;
    const requestId =
        metadata.requestId ??
        errorText(record?.requestId) ??
        errorText(body?.request_id) ??
        errorText(nested?.request_id) ??
        headers?.get("x-request-id") ??
        undefined;
    const timedOut = /timeout|timed out|aborted|cancelled|canceled|ETIMEDOUT/i.test(raw);
    const unauthorized =
        upstreamStatus === 401 ||
        /Invalid API key|APIKey_Invalid|HTTP 401|status...401|401 \{/.test(raw);
    const forbidden =
        upstreamStatus === 403 ||
        /APIKey_InsufficientPermissions|InsufficientPermissions|HTTP 403|status...403|403 \{/.test(
            raw,
        );

    if (timedOut) {
        return {
            message: "Composio did not respond in time. Check your connection and retry.",
            status: 504,
            code: "composio_timeout",
            requestId,
        };
    }
    if (unauthorized) {
        return {
            message:
                "Composio rejected this API key. Copy the complete key when it is created, not the shortened key shown later in the dashboard, then retry.",
            status: 401,
            code: "composio_invalid_key",
            requestId,
        };
    }
    if (forbidden) {
        const permission =
            action === "session"
                ? 'create sessions'
                : action === "authorize"
                  ? "manage auth configs and connected accounts"
                  : action === "disconnect"
                    ? "manage connected accounts"
                    : action === "remove"
                      ? "delete sessions"
                      : "read project toolkits";
        return {
            message: `This Composio key is valid but cannot ${permission}. Create a project API key with the required permissions in dashboard.composio.dev.`,
            status: 403,
            code: "composio_insufficient_permissions",
            requestId,
        };
    }
    if (upstreamStatus === 429) {
        return {
            message: "Composio rate-limited this request. Wait briefly and retry.",
            status: 429,
            code: "composio_rate_limited",
            requestId,
        };
    }
    if (action === "disconnect" && /No connected account|connected_accounts write/.test(raw)) {
        return {
            message: raw.slice(0, 220),
            status: 400,
            code: "composio_disconnect_failed",
            requestId,
        };
    }

    return {
        message:
            upstreamStatus && upstreamStatus >= 500
                ? "Composio is temporarily unavailable. Retry in a moment."
                : upstreamStatus === 404 && action === "disconnect"
                  ? "This app is no longer connected. Refresh the app list and try again."
                  : "Composio could not complete this request. Check the key permissions and retry.",
        status: upstreamStatus && upstreamStatus >= 400 ? upstreamStatus : 502,
        code: "composio_request_failed",
        requestId,
    };
}

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
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > 16_384) {
        return withCors(
            request,
            Response.json({ ok: false, error: "Composio request is too large." }, { status: 413 }),
        );
    }

    let action: ComposioActionBody["action"];
    try {
        let parsed: unknown;
        try {
            parsed = await request.json();
        } catch {
            return withCors(
                request,
                Response.json({ ok: false, error: "Invalid JSON request body." }, { status: 400 }),
            );
        }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return withCors(
                request,
                Response.json({ ok: false, error: "Invalid request body." }, { status: 400 }),
            );
        }
        if (JSON.stringify(parsed).length > 16_384) {
            return withCors(
                request,
                Response.json({ ok: false, error: "Composio request is too large." }, { status: 413 }),
            );
        }
        const body = parsed as ComposioActionBody;
        action = body.action;
        if (
            !["test", "session", "toolkits", "authorize", "disconnect", "remove"].includes(
                action ?? "",
            ) ||
            typeof body.apiKey !== "string" ||
            (body.userId != null && typeof body.userId !== "string") ||
            (body.sessionId != null && typeof body.sessionId !== "string") ||
            (body.toolkit != null && typeof body.toolkit !== "string") ||
            (body.connectedAccountId != null &&
                typeof body.connectedAccountId !== "string") ||
            body.apiKey.length > 512 ||
            (body.userId?.length ?? 0) > 160 ||
            (body.sessionId?.length ?? 0) > 256 ||
            (body.toolkit?.length ?? 0) > 160 ||
            (body.connectedAccountId?.length ?? 0) > 256
        ) {
            return withCors(
                request,
                Response.json({ ok: false, error: "Invalid Composio request." }, { status: 400 }),
            );
        }
        const apiKey = body.apiKey?.trim() ?? "";
        if (!apiKey) {
            return withCors(
                request,
                Response.json({ ok: false, error: "Composio API key required." }, { status: 400 }),
            );
        }

        const ipRateCheck = checkRateLimit(rateLimitKeyFromRequest(request));
        if (!ipRateCheck.ok) {
            return withCors(request, rateLimitResponse(ipRateCheck.retryAfterMs));
        }
        const keyRateCheck = checkRateLimit(rateLimitKeyFromRequest(request, apiKey));
        if (!keyRateCheck.ok) {
            return withCors(request, rateLimitResponse(keyRateCheck.retryAfterMs));
        }

        const userId = body.userId?.trim() || `aidiy-${crypto.randomUUID().slice(0, 12)}`;

        switch (body.action) {
            case "test": {
                await testComposioKey(apiKey);
                return withCors(request, Response.json({ ok: true, userId }));
            }
            case "session": {
                const session = await ensureComposioSession({
                    apiKey,
                    userId,
                    sessionId: body.sessionId ?? null,
                });
                return withCors(request, Response.json({ ok: true, userId, ...session }));
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
                const redirectUrl = await authorizeComposioToolkit({ apiKey, userId, toolkit });
                return withCors(request, Response.json({ ok: true, userId, redirectUrl }));
            }
            case "disconnect": {
                const toolkit = body.toolkit?.trim();
                if (!toolkit) {
                    return withCors(
                        request,
                        Response.json(
                            { ok: false, error: "Toolkit required." },
                            { status: 400 },
                        ),
                    );
                }
                await disconnectComposioToolkit({
                    apiKey,
                    connectedAccountId: body.connectedAccountId,
                    toolkit,
                    userId,
                });
                return withCors(request, Response.json({ ok: true }));
            }
            case "remove": {
                const sessionId = body.sessionId?.trim();
                if (sessionId) {
                    const ownerId = body.userId?.trim();
                    if (!ownerId) {
                        return withCors(
                            request,
                            Response.json(
                                { ok: false, error: "Composio user ID required to remove a session." },
                                { status: 400 },
                            ),
                        );
                    }
                    await deleteComposioSession({
                        apiKey,
                        sessionId,
                        userId: ownerId,
                    });
                }
                return withCors(request, Response.json({ ok: true }));
            }
            default:
                return withCors(
                    request,
                    Response.json({ ok: false, error: "Unknown action." }, { status: 400 }),
                );
        }
    } catch (error) {
        const failure = classifyComposioFailure(action, error);
        console.warn(
            `[composio] ${action ?? "unknown"} failed (${failure.code}${failure.requestId ? `, request ${failure.requestId}` : ""}):`,
            failure.status,
        );
        return withCors(
            request,
            Response.json(
                {
                    ok: false,
                    error: failure.message,
                    code: failure.code,
                    requestId: failure.requestId,
                },
                { status: failure.status },
            ),
        );
    }
}
