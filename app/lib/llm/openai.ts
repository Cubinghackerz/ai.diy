/**
 * OpenAI-Compatible Provider Adapter
 * 
 * Handles streaming chat completions for OpenAI, Groq, and OpenRouter
 * using the official OpenAI SDK.
 */

import OpenAI from "openai";
import type { ChatRequest, StreamCallbacks, LLMProvider } from "./types";
import type { ProviderId } from "~/lib/types";
import { createCompatibleFetch } from "~/lib/server/compatible-fetch";

export class OpenAIProvider implements LLMProvider {
    id: ProviderId;

    constructor(id: ProviderId = "openai") {
        this.id = id;
    }

    async streamChat(request: ChatRequest, callbacks: StreamCallbacks): Promise<void> {
        const client = new OpenAI({
            apiKey: request.apiKey || undefined,
            baseURL: request.baseUrl,
        });

        const messages = request.systemPrompt
            ? [{ role: "system" as const, content: request.systemPrompt }, ...request.messages]
            : request.messages;

        const stream = await client.chat.completions.create(
            {
                model: request.model,
                messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
                temperature: request.temperature ?? 0.7,
                max_tokens: request.maxTokens ?? undefined,
                top_p: request.topP ?? 1,
                tools: request.tools as OpenAI.Chat.Completions.ChatCompletionTool[] | undefined,
                stream: true,
                stream_options: { include_usage: true },
            },
            { signal: request.signal }
        );

        const toolCallBuffers = new Map<number, { id: string; name: string; args: string }>();

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            const usage = chunk.usage;

            if (usage && callbacks.onUsage) {
                callbacks.onUsage({
                    promptTokens: usage.prompt_tokens,
                    completionTokens: usage.completion_tokens,
                });
            }

            if (!delta) continue;

            // Text content
            if (delta.content) {
                callbacks.onText(delta.content);
            }

            // Reasoning content (for o1/o3 models)
            const reasoning = (delta as Record<string, unknown>).reasoning_content;
            if (typeof reasoning === "string" && callbacks.onReasoning) {
                callbacks.onReasoning(reasoning);
            }

            // Tool calls
            if (delta.tool_calls && callbacks.onToolCall) {
                for (const tc of delta.tool_calls) {
                    const idx = tc.index;
                    if (!toolCallBuffers.has(idx)) {
                        toolCallBuffers.set(idx, {
                            id: tc.id ?? "",
                            name: tc.function?.name ?? "",
                            args: "",
                        });
                    }
                    const buf = toolCallBuffers.get(idx)!;
                    if (tc.id) buf.id = tc.id;
                    if (tc.function?.name) buf.name += tc.function.name;
                    if (tc.function?.arguments) buf.args += tc.function.arguments;
                }
            }
        }

        // Emit completed tool calls
        if (callbacks.onToolCall) {
            for (const [, buf] of toolCallBuffers) {
                if (buf.name && buf.id) {
                    try {
                        const args = buf.args ? JSON.parse(buf.args) : {};
                        callbacks.onToolCall({ id: buf.id, name: buf.name, args });
                    } catch {
                        callbacks.onToolCall({ id: buf.id, name: buf.name, args: { raw: buf.args } });
                    }
                }
            }
        }
    }

    async listModels(
        apiKey: string,
        baseUrl?: string,
        headers?: Record<string, string>,
        timeoutMs?: number,
        maxRetries?: number,
        authMode?: "bearer" | "api-key-header" | "custom-header" | "none",
    ): Promise<{ id: string; name: string }[]> {
        try {
            const client = new OpenAI({
                apiKey: apiKey || "custom",
                baseURL: baseUrl,
                defaultHeaders: headers,
                fetch: createCompatibleFetch(timeoutMs, maxRetries, {
                    stripAuthorization:
                        authMode === "api-key-header" ||
                        authMode === "custom-header" ||
                        authMode === "none",
                }),
            });
            const list = await client.models.list();
            return list.data
                .map((m) => ({ id: m.id, name: m.id }))
                .sort((a, b) => a.id.localeCompare(b.id));
        } catch (err) {
            throw new Error(formatProviderError(this.id, err));
        }
    }
}

function formatProviderError(provider: ProviderId, err: unknown): string {
    if (err && typeof err === "object") {
        const anyErr = err as {
            status?: number;
            message?: string;
            error?: { message?: string };
        };
        const msg =
            anyErr.error?.message ||
            anyErr.message ||
            (err instanceof Error ? err.message : null);
        if (anyErr.status === 401 || anyErr.status === 403) {
            return `Invalid API key for ${provider}.`;
        }
        if (msg) return msg;
    }
    return err instanceof Error
        ? err.message
        : `Failed to reach ${provider} models API.`;
}
