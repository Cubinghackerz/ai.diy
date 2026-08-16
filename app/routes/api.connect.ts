import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { corsPreflight, withCors } from "~/lib/server/cors";
import {
    connectAvailable,
    inspectConnectConnector,
    listConnectConnectors,
    requestConnectToken,
    startConnectAuthorization,
} from "~/lib/server/connect";

/**
 * Vercel Connect support endpoints used by the Settings UI:
 * - `list` → env-declared connectors + availability
 * - `status` → connector metadata + token state (no secrets)
 * - `test` → mint an app-subject token (dry run)
 * - `authorize` → start the operator consent flow, returns the URL to open
 */
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
        const body = (await request.json()) as {
            action?: "list" | "status" | "test" | "authorize";
            connectorId?: string;
            scopes?: string[];
        };

        const action = body.action;
        if (!action) {
            return withCors(
                request,
                Response.json({ error: "Action required." }, { status: 400 }),
            );
        }

        if (action === "list") {
            return withCors(
                request,
                Response.json({
                    available: connectAvailable(),
                    connectors: listConnectConnectors(),
                }),
            );
        }

        if (action === "authorize") {
            if (!body.connectorId?.trim()) {
                return withCors(
                    request,
                    Response.json({ error: "connectorId required." }, { status: 400 }),
                );
            }
            const result = await startConnectAuthorization(
                body.connectorId.trim(),
                body.scopes,
            );
            return withCors(request, Response.json(result));
        }

        if (action === "status") {
            if (!body.connectorId?.trim()) {
                return withCors(
                    request,
                    Response.json({ error: "connectorId required." }, { status: 400 }),
                );
            }
            const inspection = await inspectConnectConnector(body.connectorId.trim());
            return withCors(request, Response.json(inspection));
        }

        if (action === "test") {
            if (!body.connectorId?.trim()) {
                return withCors(
                    request,
                    Response.json({ error: "connectorId required." }, { status: 400 }),
                );
            }
            const result = await requestConnectToken(body.connectorId.trim(), body.scopes);
            if (result.ok) {
                return withCors(
                    request,
                    Response.json({
                        ok: true,
                        expiresAt: result.expiresAt,
                        connectorId: result.connectorId,
                    }),
                );
            }
            return withCors(
                request,
                Response.json({
                    ok: false,
                    kind: result.kind,
                    message: result.message,
                    authorizeUrl: result.kind === "authorization-required" ? result.authorizeUrl : undefined,
                }),
            );
        }

        return withCors(
            request,
            Response.json({ error: "Unknown action." }, { status: 400 }),
        );
    } catch (error) {
        return withCors(
            request,
            Response.json(
                { ok: false, error: error instanceof Error ? error.message : "Vercel Connect request failed." },
                { status: 502 },
            ),
        );
    }
}