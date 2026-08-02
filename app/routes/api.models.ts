import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getProvider } from "~/lib/llm";
import { enrichModelInfo } from "~/lib/model-capabilities";
import { DEFAULT_MODELS, type ModelInfo, type ProviderId } from "~/lib/types";
import { isLocalProvider } from "~/lib/setup";
import { localProviderKey } from "~/lib/provider-credentials";
import { corsPreflight, withCors } from "~/lib/server/cors";
import { normalizeProviderBaseUrl } from "~/lib/server/provider-url";

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

    let body: {
        provider: ProviderId;
        apiKey: string;
        baseUrl?: string;
        headers?: Record<string, string>;
        timeoutMs?: number;
        maxRetries?: number;
        authMode?: "bearer" | "api-key-header" | "custom-header" | "none";
    };
    try {
        body = (await request.json()) as typeof body;
    } catch {
        return withCors(
            request,
            Response.json(
                { error: "Invalid JSON body", models: [] },
                { status: 400 },
            ),
        );
    }

    if (!body.provider) {
        return withCors(
            request,
            Response.json(
                { error: "Provider required", models: [] },
                { status: 400, headers: { "Cache-Control": "no-store" } },
            ),
        );
    }

    const apiKey = body.apiKey?.trim() ?? "";
    if (!apiKey && !isLocalProvider(body.provider)) {
        return withCors(
            request,
            Response.json(
                { error: "API key required", models: [] },
                { status: 400, headers: { "Cache-Control": "no-store" } },
            ),
        );
    }

    let baseUrl: string | undefined;
    try {
        baseUrl = normalizeProviderBaseUrl(body.provider, body.baseUrl);
    } catch (err) {
        return withCors(
            request,
            Response.json(
                { error: err instanceof Error ? err.message : "Invalid provider URL", models: [] },
                { status: 400, headers: { "Cache-Control": "no-store" } },
            ),
        );
    }

    try {
        const provider = getProvider(body.provider);
        const live = await provider.listModels(
            body.provider === "custom"
                ? apiKey
                : apiKey || localProviderKey(body.provider),
            baseUrl,
            body.headers,
            body.timeoutMs,
            body.maxRetries,
            body.authMode,
        );

        const raw: ModelInfo[] =
            live.length > 0
                ? live.map((m) =>
                      enrichModelInfo({
                          id: m.id,
                          name: m.name || m.id,
                          provider: body.provider,
                      }),
                  )
                : (DEFAULT_MODELS[body.provider] ?? []).map((m) =>
                      enrichModelInfo({ ...m, provider: body.provider }),
                  );

        return withCors(
            request,
            Response.json(
                {
                    models: raw,
                    live: live.length > 0,
                    fetchedAt: Date.now(),
                    checks: {
                        keyValid: true,
                        modelsListed: raw.length > 0,
                        provider: body.provider,
                    },
                    resolvedBaseUrl: baseUrl,
                },
                { headers: { "Cache-Control": "no-store" } },
            ),
        );
    } catch (err) {
        const message = modelDiscoveryError(err);
        const fallback = (DEFAULT_MODELS[body.provider] ?? []).map((m) =>
            enrichModelInfo({ ...m, provider: body.provider }),
        );
        if (fallback.length > 0) {
            return withCors(
                request,
                Response.json(
                    {
                        models: fallback,
                        live: false,
                        error: message,
                        resolvedBaseUrl: baseUrl,
                        fetchedAt: Date.now(),
                    },
                    { headers: { "Cache-Control": "no-store" } },
                ),
            );
        }
        const status =
            /invalid|unauthorized|forbidden|api key/i.test(message) ? 401 : 502;
        return withCors(
            request,
            Response.json(
                { error: message, models: [] },
                { status, headers: { "Cache-Control": "no-store" } },
            ),
        );
    }
}

function modelDiscoveryError(error: unknown): string {
    const message = error instanceof Error ? error.message : "";
    if (/invalid|unauthorized|forbidden|api key|authentication/i.test(message)) {
        return "Provider authentication failed. Check the API key and permissions.";
    }
    if (/timeout|timed out|network|fetch failed|econn/i.test(message)) {
        return "Could not reach the provider. Check the API root and network connection.";
    }
    return "Model discovery failed. Check the API root and provider compatibility.";
}
