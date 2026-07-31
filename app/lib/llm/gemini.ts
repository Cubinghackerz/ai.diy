/**
 * Google Gemini Provider Adapter
 * 
 * Handles streaming chat completions for Google Gemini models
 * using the Gemini API with SSE streaming.
 */

import type { ChatRequest, StreamCallbacks, LLMProvider } from "./types";

export class GeminiProvider implements LLMProvider {
    id = "gemini" as const;

    async streamChat(request: ChatRequest, callbacks: StreamCallbacks): Promise<void> {
        const baseUrl = request.baseUrl ?? "https://generativelanguage.googleapis.com";
        const url = `${baseUrl}/v1beta/models/${request.model}:streamGenerateContent?alt=sse`;

        // Convert messages to Gemini format
        const systemInstruction = request.systemPrompt
            ? { parts: [{ text: request.systemPrompt }] }
            : undefined;

        const contents = request.messages
            .filter((m) => m.role !== "system")
            .map((m) => {
                const role = m.role === "assistant" ? "model" : "user";
                const parts: Array<{ text: string } | { functionCall: { name: string; args: Record<string, unknown> } } | { functionResponse: { name: string; response: Record<string, unknown> } }> = [];

                if (m.role === "tool" && m.tool_call_id) {
                    parts.push({
                        functionResponse: {
                            name: m.tool_call_id,
                            response: { result: m.content },
                        },
                    });
                } else if (m.role === "assistant" && m.tool_calls) {
                    for (const tc of m.tool_calls) {
                        parts.push({
                            functionCall: {
                                name: tc.function.name,
                                args: JSON.parse(tc.function.arguments || "{}"),
                            },
                        });
                    }
                } else if (m.content) {
                    parts.push({ text: m.content });
                }

                return { role, parts };
            });

        const body: Record<string, unknown> = {
            contents,
            generationConfig: {
                temperature: request.temperature ?? 0.7,
                ...(request.maxTokens ? { maxOutputTokens: request.maxTokens } : {}),
                topP: request.topP ?? 1,
            },
        };

        if (systemInstruction) body.systemInstruction = systemInstruction;

        if (request.tools && request.tools.length > 0) {
            body.tools = [
                {
                    functionDeclarations: request.tools.map((t) => ({
                        name: t.function.name,
                        description: t.function.description,
                        parameters: t.function.parameters,
                    })),
                },
            ];
        }

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": request.apiKey,
            },
            body: JSON.stringify(body),
            signal: request.signal,
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini API error (${response.status}): ${errText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

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

                    // Text content
                    const candidates = event.candidates ?? [];
                    for (const candidate of candidates) {
                        const parts = candidate.content?.parts ?? [];
                        for (const part of parts) {
                            if (part.text) {
                                callbacks.onText(part.text);
                            }
                            if (part.functionCall && callbacks.onToolCall) {
                                callbacks.onToolCall({
                                    id: `call_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                                    name: part.functionCall.name,
                                    args: part.functionCall.args ?? {},
                                });
                            }
                            if (part.thought && part.text && callbacks.onReasoning) {
                                callbacks.onReasoning(part.text);
                            }
                        }
                    }

                    // Usage
                    if (event.usageMetadata && callbacks.onUsage) {
                        callbacks.onUsage({
                            promptTokens: event.usageMetadata.promptTokenCount,
                            completionTokens: event.usageMetadata.candidatesTokenCount,
                        });
                    }
                } catch {
                    // Skip malformed JSON
                }
            }
        }
    }

    async listModels(apiKey: string, baseUrl?: string): Promise<{ id: string; name: string }[]> {
        const base = baseUrl ?? "https://generativelanguage.googleapis.com";
        const res = await fetch(`${base}/v1beta/models?key=${apiKey}`);
        if (!res.ok) {
            const detail = (await res.text()).slice(0, 240);
            if (res.status === 400 || res.status === 401 || res.status === 403) {
                throw new Error("Invalid Google Gemini API key.");
            }
            throw new Error(
                `Gemini models API failed (HTTP ${res.status})${detail ? `: ${detail}` : ""}`,
            );
        }
        const data = await res.json();
        return (data.models ?? [])
            .filter((m: { supportedGenerationMethods?: string[] }) =>
                m.supportedGenerationMethods?.includes("generateContent")
            )
            .map((m: { name: string; displayName?: string }) => ({
                id: m.name.replace("models/", ""),
                name: m.displayName ?? m.name,
            }))
            .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id));
    }
}