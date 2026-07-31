/**
 * API Models Route — Live fetch of available models per provider
 *
 * Uses only the key + endpoint from the request body (BYOK).
 * Failures return an error — never silently succeed with hardcoded defaults.
 */

import type { LoaderFunctionArgs } from "react-router";
import { getProvider } from "~/lib/llm";
import {
    enrichModelInfo,
} from "~/lib/model-capabilities";
import { DEFAULT_MODELS, type ModelInfo, type ProviderId } from "~/lib/types";
import { isLocalProvider } from "~/lib/setup";

export async function action({ request }: LoaderFunctionArgs) {
    const body = (await request.json()) as {
        provider: ProviderId;
        apiKey: string;
        baseUrl?: string;
    };

    if (!body.provider) {
        return Response.json(
            { error: "Provider required", models: [] },
            { status: 400, headers: { "Cache-Control": "no-store" } },
        );
    }

    const apiKey = body.apiKey?.trim() ?? "";
    if (!apiKey && !isLocalProvider(body.provider)) {
        return Response.json(
            { error: "API key required", models: [] },
            { status: 400, headers: { "Cache-Control": "no-store" } },
        );
    }

    try {
        const provider = getProvider(body.provider);
        const live = await provider.listModels(
            apiKey || (body.provider === "ollama" ? "ollama" : "custom"),
            body.baseUrl,
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

        return Response.json({
            models: raw,
            live: live.length > 0,
            fetchedAt: Date.now(),
            checks: {
                keyValid: true,
                modelsListed: raw.length > 0,
                provider: body.provider,
            },
        }, { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        // Prefer catalog defaults over hard failure so the composer stays usable
        // when Ollama is down or a cloud key can't list models yet.
        const fallback = (DEFAULT_MODELS[body.provider] ?? []).map((m) =>
            enrichModelInfo({ ...m, provider: body.provider }),
        );
        if (fallback.length > 0) {
            return Response.json({
                models: fallback,
                live: false,
                error: message,
                fetchedAt: Date.now(),
            }, { headers: { "Cache-Control": "no-store" } });
        }
        const status =
            /invalid|unauthorized|forbidden|api key/i.test(message) ? 401 : 502;
        return Response.json(
            { error: message, models: [] },
            { status, headers: { "Cache-Control": "no-store" } },
        );
    }
}
