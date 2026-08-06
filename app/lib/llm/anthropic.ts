/**
 * Anthropic Provider Adapter
 * 
 * Handles streaming chat completions for Anthropic Claude models
 * using the Anthropic Messages API with SSE streaming.
 */

import type { ChatRequest, StreamCallbacks, LLMProvider } from "./types";

export class AnthropicProvider implements LLMProvider {
    id = "anthropic" as const;

    async streamChat(request: ChatRequest, callbacks: StreamCallbacks): Promise<void> {
        const baseUrl = request.baseUrl ?? "https://api.anthropic.com";
        const url = `${baseUrl}/v1/messages`;

        // Convert messages: separate system prompt, convert tool messages
        const systemPrompt = request.systemPrompt || "";
        const messages = request.messages
            .filter((m) => m.role !== "system")
            .map((m) => {
                if (m.role === "tool") {
                    return {
                        role: "user" as const,
                        content: [
                            {
                                type: "tool_result",
                                tool_use_id: m.tool_call_id ?? "",
                                content: m.content,
                            },
                        ],
                    };
                }
                if (m.role === "assistant" && m.tool_calls) {
                    return {
                        role: "assistant" as const,
                        content: m.tool_calls.map((tc) => ({
                            type: "tool_use",
                            id: tc.id,
                            name: tc.function.name,
                            input: JSON.parse(tc.function.arguments || "{}"),
                        })),
                    };
                }
                return { role: m.role as "user" | "assistant", content: m.content };
            });

        const body: Record<string, unknown> = {
            model: request.model,
            messages,
            max_tokens: request.maxTokens ?? 4096,
            stream: true,
        };

        if (systemPrompt) body.system = systemPrompt;
        if (request.temperature != null) body.temperature = request.temperature;
        if (request.topP != null) body.top_p = request.topP;

        if (request.tools && request.tools.length > 0) {
            body.tools = request.tools.map((t) => ({
                name: t.function.name,
                description: t.function.description,
                input_schema: t.function.parameters,
            }));
        }

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": request.apiKey,
                "anthropic-version": "2023-06-01",
                "anthropic-dangerous-direct-browser-access": "true",
            },
            body: JSON.stringify(body),
            signal: request.signal,
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Anthropic API error (${response.status}): ${errText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        const toolCallBuffers = new Map<string, { id: string; name: string; args: string }>();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();
                if (!data) continue;

                try {
                    const event = JSON.parse(data);

                    switch (event.type) {
                        case "content_block_start": {
                            const block = event.content_block;
                            if (block.type === "tool_use" && callbacks.onToolCall) {
                                toolCallBuffers.set(event.index, {
                                    id: block.id,
                                    name: block.name,
                                    args: "",
                                });
                            }
                            break;
                        }
                        case "content_block_delta": {
                            const delta = event.delta;
                            if (delta.type === "text_delta" && delta.text) {
                                callbacks.onText(delta.text);
                            } else if (delta.type === "thinking_delta" && delta.thinking && callbacks.onReasoning) {
                                callbacks.onReasoning(delta.thinking);
                            } else if (delta.type === "input_json_delta") {
                                const buf = toolCallBuffers.get(event.index);
                                if (buf) buf.args += delta.partial_json;
                            }
                            break;
                        }
                        case "content_block_stop": {
                            const buf = toolCallBuffers.get(event.index);
                            if (buf && callbacks.onToolCall) {
                                try {
                                    const args = buf.args ? JSON.parse(buf.args) : {};
                                    callbacks.onToolCall({ id: buf.id, name: buf.name, args });
                                } catch {
                                    callbacks.onToolCall({ id: buf.id, name: buf.name, args: { raw: buf.args } });
                                }
                            }
                            break;
                        }
                        case "message_delta": {
                            if (event.usage && callbacks.onUsage) {
                                callbacks.onUsage({
                                    completionTokens: event.usage.output_tokens,
                                });
                            }
                            break;
                        }
                        case "message_start": {
                            if (event.message?.usage && callbacks.onUsage) {
                                callbacks.onUsage({
                                    promptTokens: event.message.usage.input_tokens,
                                });
                            }
                            break;
                        }
                    }
                } catch {
                    // Skip malformed JSON
                }
            }
        }
    }

    async listModels(apiKey: string, baseUrl?: string): Promise<{ id: string; name: string }[]> {
        const base = baseUrl ?? "https://api.anthropic.com";
        const res = await fetch(`${base}/v1/models`, {
            headers: {
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "anthropic-dangerous-direct-browser-access": "true",
            },
        });
        if (!res.ok) {
            const detail = (await res.text()).slice(0, 240);
            if (res.status === 401 || res.status === 403) {
                throw new Error("Invalid Anthropic API key.");
            }
            throw new Error(
                `Anthropic models API failed (HTTP ${res.status})${detail ? `: ${detail}` : ""}`,
            );
        }
        const data = await res.json();
        return (data.data ?? [])
            .map((m: { id: string; display_name?: string }) => ({
                id: m.id,
                name: m.display_name ?? m.id,
            }))
            .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id));
    }
}
