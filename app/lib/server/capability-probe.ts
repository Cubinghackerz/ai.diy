/**
 * Capability probing — bounded, best-effort per-model checks for
 * OpenAI-compatible endpoints.
 *
 * Probes use the same model construction as the chat path (createChatModel),
 * so results reflect what the app will actually do. Every probe is bounded
 * (timeout, tiny max tokens) and a single probe failure never aborts the
 * report — it degrades to `{ capability: false, error }` (or `null` when the
 * check is genuinely inconclusive).
 */

import { generateText, Output, streamText, tool, zodSchema } from "ai";
import { z } from "zod";
import { createCompatibleFetch } from "~/lib/server/compatible-fetch";
import { createChatModel } from "~/lib/server/model";
import { normalizeProviderBaseUrl } from "~/lib/server/provider-url";
import type { ProviderConfig, ProviderId } from "~/lib/types";

export type ProbeKey =
    | "streaming"
    | "tools"
    | "structuredOutput"
    | "vision"
    | "embeddings"
    | "responses"
    | "reasoning";

export type ProbeResult = {
    capability: boolean | null;
    latencyMs: number;
    error?: string;
};

export type ProbeReport = {
    model: string;
    provider: ProviderId;
    capabilities: Record<ProbeKey, ProbeResult>;
    latencyMs: number;
};

export type ProbeRequest = {
    provider: ProviderId;
    apiKey: string;
    baseUrl?: string;
    model: string;
    openAICompatible?: ProviderConfig["openAICompatible"];
};

const PROBE_TIMEOUT_MS = 15_000;

/** 1x1 PNG data URL used as a minimal vision probe payload. */
const RED_1PX_PNG =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function modelRequest(body: ProbeRequest) {
    return {
        provider: body.provider,
        apiKey: body.apiKey,
        baseUrl: body.baseUrl,
        model: body.model,
        openAICompatible: body.openAICompatible,
    };
}

async function probeStreaming(body: ProbeRequest): Promise<ProbeResult> {
    const startedAt = Date.now();
    try {
        const result = await streamText({
            model: createChatModel(modelRequest(body)),
            prompt: "Reply with the single word: OK",
            maxOutputTokens: 10,
            temperature: 0,
            timeout: { firstChunkMs: 10_000, totalMs: PROBE_TIMEOUT_MS },
        });
        for await (const chunk of result.textStream) {
            if (chunk.trim()) {
                return { capability: true, latencyMs: Date.now() - startedAt };
            }
        }
        return {
            capability: false,
            latencyMs: Date.now() - startedAt,
            error: "No text chunks received.",
        };
    } catch (error) {
        return {
            capability: false,
            latencyMs: Date.now() - startedAt,
            error: errorMessage(error),
        };
    }
}

async function probeTools(body: ProbeRequest): Promise<ProbeResult> {
    const startedAt = Date.now();
    try {
        const result = await generateText({
            model: createChatModel(modelRequest(body)),
            prompt:
                "Call the echo_probe tool with ok set to true. Do not reply in plain text.",
            tools: {
                echo_probe: tool({
                    description: "Echoes a boolean back to the caller.",
                    inputSchema: z.object({ ok: z.boolean() }),
                    execute: async ({ ok }) => ok,
                }),
            },
            maxOutputTokens: 120,
            temperature: 0,
            timeout: PROBE_TIMEOUT_MS,
        });
        const called = result.toolCalls.some(
            (call) => call.toolName === "echo_probe",
        );
        return {
            capability: called,
            latencyMs: Date.now() - startedAt,
            ...(called ? {} : { error: "No tool call received." }),
        };
    } catch (error) {
        return {
            capability: false,
            latencyMs: Date.now() - startedAt,
            error: errorMessage(error),
        };
    }
}

async function probeStructuredOutput(
    body: ProbeRequest,
): Promise<ProbeResult> {
    const startedAt = Date.now();
    try {
        await generateText({
            model: createChatModel(modelRequest(body)),
            prompt: "Return the JSON object {\"ok\": true}.",
            output: Output.object({
                schema: zodSchema(z.object({ ok: z.boolean() })),
            }),
            maxOutputTokens: 120,
            temperature: 0,
            timeout: PROBE_TIMEOUT_MS,
        });
        return { capability: true, latencyMs: Date.now() - startedAt };
    } catch (error) {
        return {
            capability: false,
            latencyMs: Date.now() - startedAt,
            error: errorMessage(error),
        };
    }
}

async function probeVision(body: ProbeRequest): Promise<ProbeResult> {
    const startedAt = Date.now();
    try {
        const result = await generateText({
            model: createChatModel(modelRequest(body)),
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "image",
                            image: RED_1PX_PNG,
                        },
                        {
                            type: "text",
                            text: "What color is this image? Reply with a single word.",
                        },
                    ],
                },
            ],
            maxOutputTokens: 20,
            temperature: 0,
            timeout: PROBE_TIMEOUT_MS,
        });
        const hasText = result.text.trim().length > 0;
        return {
            capability: hasText,
            latencyMs: Date.now() - startedAt,
            ...(hasText ? {} : { error: "No text response to the image part." }),
        };
    } catch (error) {
        return {
            capability: false,
            latencyMs: Date.now() - startedAt,
            error: errorMessage(error),
        };
    }
}

async function probeReasoning(body: ProbeRequest): Promise<ProbeResult> {
    const startedAt = Date.now();
    try {
        const result = await generateText({
            model: createChatModel(modelRequest(body)),
            prompt:
                "What is 17 * 23? Show brief step-by-step reasoning, then the final number.",
            reasoning: "low",
            maxOutputTokens: 300,
            temperature: 0,
            timeout: PROBE_TIMEOUT_MS,
        });
        const reasoned = (result.reasoning?.length ?? 0) > 0;
        return {
            capability: reasoned,
            latencyMs: Date.now() - startedAt,
            ...(reasoned ? {} : { error: "No reasoning parts emitted." }),
        };
    } catch (error) {
        // Some endpoints reject the reasoning parameter outright. Retry
        // without it: if the plain request succeeds, reasoning is unsupported
        // (false); if it also fails, the endpoint is unreachable for this
        // model and the result is inconclusive (null).
        try {
            await generateText({
                model: createChatModel(modelRequest(body)),
                prompt: "Reply with the number 1.",
                maxOutputTokens: 10,
                temperature: 0,
                timeout: PROBE_TIMEOUT_MS,
            });
            return {
                capability: false,
                latencyMs: Date.now() - startedAt,
                error: errorMessage(error),
            };
        } catch {
            return {
                capability: null,
                latencyMs: Date.now() - startedAt,
                error: errorMessage(error),
            };
        }
    }
}

function useBearerAuth(openAICompatible?: ProviderConfig["openAICompatible"]) {
    const mode = openAICompatible?.authMode;
    return mode !== "none" && mode !== "api-key-header" && mode !== "custom-header";
}

/** Direct OpenAI-compatible HTTP probes (embeddings, Responses API). */
async function probeHttp(
    body: ProbeRequest,
    path: "embeddings" | "responses",
): Promise<ProbeResult> {
    const startedAt = Date.now();
    try {
        const root = normalizeProviderBaseUrl(body.provider, body.baseUrl) ?? "";
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...(body.openAICompatible?.headers ?? {}),
        };
        if (useBearerAuth(body.openAICompatible) && body.apiKey.trim()) {
            headers.Authorization = `Bearer ${body.apiKey.trim()}`;
        }
        const payload =
            path === "embeddings"
                ? { model: body.model, input: "capability probe" }
                : { model: body.model, input: "Hi" };
        const response = await createCompatibleFetch(
            PROBE_TIMEOUT_MS,
            0,
            { stripAuthorization: false },
        )(`${root.replace(/\/+$/, "")}/${path}`, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
        });
        if (path === "embeddings") {
            if (!response.ok) {
                return {
                    capability: false,
                    latencyMs: Date.now() - startedAt,
                    error: `HTTP ${response.status}`,
                };
            }
            const data = (await response.json()) as {
                data?: Array<{ embedding?: unknown }>;
            };
            const ok = Array.isArray(data?.data) && Array.isArray(data.data[0]?.embedding);
            return {
                capability: ok,
                latencyMs: Date.now() - startedAt,
                ...(ok ? {} : { error: "Unexpected embeddings response shape." }),
            };
        }
        return {
            capability: response.ok,
            latencyMs: Date.now() - startedAt,
            ...(response.ok ? {} : { error: `HTTP ${response.status}` }),
        };
    } catch (error) {
        return {
            capability: false,
            latencyMs: Date.now() - startedAt,
            error: errorMessage(error),
        };
    }
}

export async function probeModelCapabilities(
    body: ProbeRequest,
): Promise<ProbeReport> {
    const startedAt = Date.now();
    const capabilities: Record<ProbeKey, ProbeResult> = {
        streaming: await probeStreaming(body),
        tools: await probeTools(body),
        structuredOutput: await probeStructuredOutput(body),
        vision: await probeVision(body),
        reasoning: await probeReasoning(body),
        // Direct HTTP probes only apply to OpenAI-compatible custom endpoints;
        // built-in providers keep their own SDK paths and are not probed.
        embeddings:
            body.provider === "custom"
                ? await probeHttp(body, "embeddings")
                : { capability: null, latencyMs: 0 },
        responses:
            body.provider === "custom"
                ? await probeHttp(body, "responses")
                : { capability: null, latencyMs: 0 },
    };
    return {
        model: body.model,
        provider: body.provider,
        capabilities,
        latencyMs: Date.now() - startedAt,
    };
}

function errorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : "";
    if (!message) return "Probe failed.";
    return message.length > 300 ? `${message.slice(0, 300)}…` : message;
}
