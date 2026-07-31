/**
 * ChatModelAdapter — Bridge between assistant-ui runtime and the API
 * 
 * Implements the ChatModelAdapter interface to call the /api/chat endpoint
 * with BYOK credentials and stream the response back to assistant-ui.
 * Sends tool settings so the server can build and execute tools.
 */

import { useSettings } from "~/lib/providers/SettingsProvider";
import type { ChatModelAdapter, ChatModelRunOptions, ChatModelRunResult } from "@assistant-ui/core";
import { UIMessageStreamDecoder, AssistantMessageAccumulator } from "assistant-stream";
import type { ChatMessage } from "~/lib/llm/types";

export function useChatModelAdapter(): ChatModelAdapter {
    const { settings } = useSettings();

    const adapter: ChatModelAdapter = {
        run: async function* (options: ChatModelRunOptions): AsyncGenerator<ChatModelRunResult, void> {
            const { messages, abortSignal } = options;
            const provider = settings.chat.provider;
            const providerConfig = settings.providers[provider];

            if (!providerConfig.apiKey) {
                throw new Error(
                    `No API key configured for ${providerConfig.name}. Please add your API key in Settings.`
                );
            }

            // Convert ThreadMessage[] to ChatMessage[]
            const apiMessages: ChatMessage[] = messages.map((m) => {
                const content = typeof m.content === "string"
                    ? m.content
                    : Array.isArray(m.content)
                        ? m.content.map((p: { text?: string }) => p.text ?? "").join("")
                        : "";
                return {
                    role: m.role === "user" ? "user" : m.role === "assistant" ? "assistant" : "system",
                    content,
                };
            });

            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: apiMessages,
                    model: settings.chat.model,
                    provider,
                    apiKey: providerConfig.apiKey,
                    baseUrl: providerConfig.baseUrl,
                    systemPrompt: settings.chat.systemPrompt || undefined,
                    temperature: settings.chat.temperature,
                    maxTokens: settings.chat.maxTokens,
                    topP: settings.chat.topP,
                    toolSettings: {
                        webSearchEnabled: settings.webSearchEnabled,
                        calculatorEnabled: settings.calculatorEnabled,
                    },
                }),
                signal: abortSignal,
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Chat API error (${response.status}): ${errText}`);
            }

            if (!response.body) {
                throw new Error("No response body from chat API");
            }

            // Pipe the response through the decoder and accumulator
            const decodedStream = response.body
                .pipeThrough(new UIMessageStreamDecoder())
                .pipeThrough(new AssistantMessageAccumulator());

            const reader = decodedStream.getReader();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // value is an AssistantMessage with content parts
                yield {
                    content: value.content,
                };
            }
        },
    };

    return adapter;
}