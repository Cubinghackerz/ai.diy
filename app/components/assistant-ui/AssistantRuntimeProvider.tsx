/**
 * AssistantRuntimeProvider — Vercel AI SDK runtime + modality-aware attachments
 *
 * BYOK: transport reads live settings from a ref — no server env API keys.
 * Thread-scoped useChat id syncs with IndexedDB via ChatThreadSync.
 */

import { AssistantRuntimeProvider as AuiRuntimeProvider } from "@assistant-ui/react";
import {
    useAISDKRuntime,
    AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { useChat } from "@ai-sdk/react";
import { ChatSessionProvider } from "~/components/assistant-ui/ChatSessionContext";
import { ChatThreadSync } from "~/components/assistant-ui/ChatThreadSync";
import { RuntimeSync } from "~/components/assistant-ui/RuntimeSync";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { createAttachmentAdapter } from "~/lib/attachments";
import { getModelModalities } from "~/lib/model-modalities";
import { useEffect, useMemo, useRef, type ReactNode } from "react";

async function parseChatError(res: Response): Promise<string> {
    const text = await res.text();
    try {
        const json = JSON.parse(text) as { error?: string; message?: string };
        if (json.error) return json.error;
        if (json.message) return json.message;
    } catch {
        // not JSON
    }
    return text.trim() || `Chat request failed (HTTP ${res.status})`;
}

export function AssistantRuntimeProvider({
    threadId,
    children,
}: {
    threadId: string | null;
    children: ReactNode;
}) {
    const { settings } = useSettings();
    const settingsRef = useRef(settings);
    settingsRef.current = settings;

    const transport = useMemo(
        () =>
            new AssistantChatTransport({
                api: "/api/chat",
                fetch: async (input, init) => {
                    const res = await globalThis.fetch(input, init);
                    if (!res.ok) {
                        throw new Error(await parseChatError(res));
                    }
                    return res;
                },
                prepareSendMessagesRequest: async (options) => {
                    const s = settingsRef.current;
                    const provider = s.chat.provider;
                    const providerConfig = s.providers[provider];
                    const apiKey = providerConfig?.apiKey?.trim() || "";
                    const baseUrl = providerConfig?.baseUrl?.trim() || undefined;

                    return {
                        body: {
                            // Keep assistant-ui forwarded context (tools/system/etc).
                            ...options.body,
                            messages: options.messages,
                            id: options.id,
                            trigger: options.trigger,
                            messageId: options.messageId,
                            metadata: options.requestMetadata,
                            model: s.chat.model,
                            provider,
                            apiKey:
                                apiKey ||
                                (provider === "ollama"
                                    ? "ollama"
                                    : provider === "custom"
                                      ? "custom"
                                      : ""),
                            baseUrl,
                            systemPrompt: s.chat.systemPrompt,
                            temperature: s.chat.temperature,
                            maxTokens: s.chat.maxTokens,
                            topP: s.chat.topP,
                            reasoningEffort: s.chat.reasoningEffort,
                             toolSettings: {
                                webSearchEnabled: s.webSearchEnabled,
                                calculatorEnabled: s.calculatorEnabled,
                                pythonEnabled: s.pythonEnabled,
                                webSearchEngine: s.webSearchEngine,
                                 searxngUrl: s.searxngUrl,
                                 skillsEnabled: true,
                             },
                            mcpServers: s.mcpServers.filter((m) => m.enabled),
                        },
                    };
                },
            }),
        [],
    );

    const chat = useChat({
        id: threadId ?? "draft",
        transport,
        onError: (err) => {
            console.error("[chat]", err);
        },
    });

    const modalities = getModelModalities(
        settings.chat.model,
        settings.chat.provider,
    );

    const adapters = useMemo(
        () => ({
            attachments: createAttachmentAdapter(modalities),
        }),
        [modalities.vision, modalities.documents, modalities.tools],
    );

    const runtime = useAISDKRuntime(chat, { adapters });

    useEffect(() => {
        transport.setRuntime(runtime);
    }, [transport, runtime]);

    return (
        <ChatSessionProvider value={chat}>
            <AuiRuntimeProvider runtime={runtime}>
                <RuntimeSync>
                    <ChatThreadSync threadId={threadId} />
                    {children}
                </RuntimeSync>
            </AuiRuntimeProvider>
        </ChatSessionProvider>
    );
}
