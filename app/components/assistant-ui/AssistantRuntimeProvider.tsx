/**
 * AssistantRuntimeProvider — Vercel AI SDK runtime + modality-aware attachments
 *
 * BYOK: transport reads live settings from a ref — no server env API keys.
 * Thread-scoped useChat id syncs with IndexedDB via ChatThreadSync.
 */

import {
    AssistantRuntimeProvider as AuiRuntimeProvider,
} from "@assistant-ui/react";
import {
    useAISDKRuntime,
    AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { useChat } from "@ai-sdk/react";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { ChatSessionProvider } from "~/components/assistant-ui/ChatSessionContext";
import { ChatThreadSync } from "~/components/assistant-ui/ChatThreadSync";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { createAttachmentAdapter } from "~/lib/attachments";
import { getModelModalities } from "~/lib/model-modalities";
import { localProviderKey } from "~/lib/provider-credentials";
import { runBrowserPython } from "~/lib/pyodide";
import { artifactContentHash, inferArtifactMimeType } from "~/lib/artifacts";
import { useCanvas } from "~/lib/canvas";
import {
    buildLocalMemoryContext,
    hasLocalMemoryEntries,
    readLocalMemory,
} from "~/lib/memory";
import { askUserInBrowser } from "~/lib/client-tools";
import {
    createWebSpeechDictationAdapter,
    isWebSpeechDictationSupported,
} from "~/lib/dictation";
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
    const { addArtifact } = useCanvas();
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

                    const memoryEnabled = s.memoryEnabled !== false;
                    const memoryContext = memoryEnabled
                        ? await buildLocalMemoryContext()
                        : "";
                    const memoryAvailable =
                        memoryEnabled && (await hasLocalMemoryEntries());
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
                                provider === "custom" &&
                                providerConfig?.openAICompatible?.authMode &&
                                providerConfig.openAICompatible.authMode !== "bearer"
                                    ? ""
                                    : apiKey || localProviderKey(provider),
                            baseUrl,
                            openAICompatible: providerConfig?.openAICompatible,
                            systemPrompt: s.chat.systemPrompt,
                            temperature: s.chat.temperature,
                            maxTokens: s.chat.maxTokens,
                            topP: s.chat.topP,
                             reasoningEffort: s.chat.reasoningEffort,
                             imageSettings: {
                                 size: s.chat.imageSize,
                                 count: s.chat.imageCount,
                             },
                            toolSettings: {
                                webSearchEnabled: s.webSearchEnabled,
                                calculatorEnabled: s.calculatorEnabled,
                                pythonEnabled: s.pythonEnabled,
                                webSearchEngine: s.webSearchEngine,
                                searxngUrl: s.searxngUrl,
                                skillsEnabled: s.skillsEnabled,
                                connectors: s.connectors,
                                memoryAvailable,
                            },
                            mcpServers: s.mcpServers.filter((m) => m.enabled),
                            memoryContext,
                        },
                    };
                },
            }),
        [],
    );

    const chatRef = useRef<ReturnType<typeof useChat> | null>(null);
    const pendingClientCalls = useRef(0);
    const chat = useChat({
        id: threadId ?? "draft",
        transport,
        onToolCall: ({ toolCall }) => {
            if (![
                "run_python",
                "run_code",
                "ask_user",
                "memory",
            ].includes(toolCall.toolName)) return;
            pendingClientCalls.current += 1;
            const input = toolCall.input as {
                code?: string;
                question?: string;
                questionType?: "single" | "multiple" | "short";
                options?: string[];
                query?: string;
            };
            const task =
                toolCall.toolName === "ask_user"
                    ? askUserInBrowser({
                          question: input.question ?? "Please provide more information.",
                          questionType: input.questionType,
                          options: input.options,
                      })
                    : toolCall.toolName === "memory"
                      ? settingsRef.current.memoryEnabled !== false
                          ? readLocalMemory(input.query)
                          : Promise.resolve("Memory is disabled for this chat.")
                      : runBrowserPython(input.code ?? "");
            void task.then(
                (result) => {
                    const output =
                        typeof result === "string" ? result : result.output;
                    const pythonResult =
                        typeof result === "string" ? null : result;
                    if (pythonResult) {
                        for (const artifact of pythonResult.artifacts) {
                            const mimeType = inferArtifactMimeType(artifact.filename);
                            const sourceKey = `python:${artifact.filename}:${artifact.contentEncoding}:${artifact.content.length}:${artifactContentHash(artifact.content)}`;
                            // Python binary artifacts are session-only: saving
                            // Base64 to IndexedDB can consume substantial
                            // browser storage. Canvas still offers download.
                            addArtifact(
                                {
                                    kind: "file",
                                    title: artifact.filename,
                                    filename: artifact.filename,
                                    content: artifact.content,
                                    contentEncoding: artifact.contentEncoding,
                                    mimeType,
                                    sourceKey,
                                },
                                { scopeId: threadId },
                            );
                        }
                    }
                    const addToolOutput = chatRef.current
                        ?.addToolOutput as unknown as
                        | ((args: {
                              tool: string;
                              toolCallId: string;
                              state: "output-available";
                              output: string;
                          }) => void)
                        | undefined;
                    addToolOutput?.({
                        tool: toolCall.toolName,
                        toolCallId: toolCall.toolCallId,
                        state: "output-available",
                        output,
                    });
                },
                (error) => {
                    const addToolOutput = chatRef.current
                        ?.addToolOutput as unknown as
                        | ((args: {
                              tool: string;
                              toolCallId: string;
                              state: "output-error";
                              errorText: string;
                          }) => void)
                        | undefined;
                    addToolOutput?.({
                        tool: toolCall.toolName,
                        toolCallId: toolCall.toolCallId,
                        state: "output-error",
                        errorText:
                            error instanceof Error
                                ? error.message
                                : "Pyodide execution failed",
                    });
                },
            );
        },
        sendAutomaticallyWhen: ({ messages }) => {
            if (pendingClientCalls.current === 0) return false;
            if (!lastAssistantMessageIsCompleteWithToolCalls({ messages })) {
                return false;
            }
            pendingClientCalls.current = 0;
            return true;
        },
        onError: (err) => {
            console.error("[chat]", err);
        },
    });
    chatRef.current = chat;

    const modalities = getModelModalities(
        settings.chat.model,
        settings.chat.provider,
    );
    const dictation = useMemo(() => {
        if (
            typeof window === "undefined" ||
            !isWebSpeechDictationSupported()
        ) {
            return undefined;
        }
        return createWebSpeechDictationAdapter(navigator.language || "en-US");
    }, []);

    const adapters = useMemo(
        () => ({
            attachments: createAttachmentAdapter(modalities),
            dictation,
        }),
        [dictation, modalities.vision, modalities.documents, modalities.tools],
    );

    const runtime = useAISDKRuntime(chat, { adapters });

    useEffect(() => {
        transport.setRuntime(runtime);
    }, [transport, runtime]);

    return (
        <ChatSessionProvider value={chat}>
            <AuiRuntimeProvider runtime={runtime}>
                <ChatThreadSync threadId={threadId} />
                {children}
            </AuiRuntimeProvider>
        </ChatSessionProvider>
    );
}
