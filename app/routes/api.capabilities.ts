import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { probeModelCapabilities, type ProbeRequest } from "~/lib/server/capability-probe";
import { corsPreflight, withCors } from "~/lib/server/cors";
import { normalizeProviderBaseUrl } from "~/lib/server/provider-url";
import { isLocalProvider } from "~/lib/setup";
import { localProviderKey } from "~/lib/provider-credentials";

export function loader({ request }: LoaderFunctionArgs) {
    const preflight = corsPreflight(request);
    if (preflight) return preflight;
    return withCors(
        request,
        new Response("Method Not Allowed", { status: 405 }),
    );
}

export async function action({ request }: ActionFunctionArgs) {
    const preflight = corsPreflight(request);
    if (preflight) return preflight;

    if (request.method !== "POST") {
        return withCors(
            request,
            new Response("Method Not Allowed", { status: 405 }),
        );
    }

    let body: ProbeRequest;
    try {
        body = (await request.json()) as ProbeRequest;
    } catch {
        return withCors(
            request,
            Response.json(
                { error: "Invalid JSON body" },
                { status: 400, headers: { "Cache-Control": "no-store" } },
            ),
        );
    }

    if (!body.provider || !body.model) {
        return withCors(
            request,
            Response.json(
                { error: "Provider and model are required" },
                { status: 400, headers: { "Cache-Control": "no-store" } },
            ),
        );
    }

    const apiKey = body.apiKey?.trim() ?? "";
    if (!apiKey && !isLocalProvider(body.provider)) {
        return withCors(
            request,
            Response.json(
                { error: "API key required" },
                { status: 400, headers: { "Cache-Control": "no-store" } },
            ),
        );
    }

    try {
        normalizeProviderBaseUrl(body.provider, body.baseUrl);
    } catch (err) {
        return withCors(
            request,
            Response.json(
                {
                    error:
                        err instanceof Error
                            ? err.message
                            : "Invalid provider URL",
                },
                { status: 400, headers: { "Cache-Control": "no-store" } },
            ),
        );
    }

    try {
        const report = await probeModelCapabilities({
            ...body,
            // Mirrors the chat request relay: custom endpoints that do not
            // use bearer auth carry their credential in the custom headers,
            // so no key is attached here.
            apiKey:
                body.provider === "custom" &&
                body.openAICompatible?.authMode &&
                body.openAICompatible.authMode !== "bearer"
                    ? ""
                    : apiKey || localProviderKey(body.provider),
        });
        return withCors(
            request,
            Response.json(
                { report },
                { headers: { "Cache-Control": "no-store" } },
            ),
        );
    } catch (err) {
        return withCors(
            request,
            Response.json(
                {
                    error:
                        err instanceof Error
                            ? err.message
                            : "Capability probing failed",
                },
                { status: 502, headers: { "Cache-Control": "no-store" } },
            ),
        );
    }
}
