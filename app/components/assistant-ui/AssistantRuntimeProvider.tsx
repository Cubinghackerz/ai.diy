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
import { persistArtifactForScope } from "~/lib/artifact-persist.client";
import { useCanvas } from "~/lib/canvas";
import {
    buildLocalMemoryContext,
    hasLocalMemoryEntries,
    readLocalMemory,
} from "~/lib/memory";
import {
    buildLocalKnowledgeContext,
    listKnowledgeDocuments,
    readLocalKnowledge,
} from "~/lib/knowledge/store.client";
import { askUserInBrowser } from "~/lib/client-tools";
import { forcedSkillStore, toolNameForForcedSkill } from "~/lib/skill-command";
import { useSubagent } from "~/components/assistant-ui/subagents";
import {
    createWebSpeechDictationAdapter,
    isWebSpeechDictationSupported,
} from "~/lib/dictation";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { assertClientUsageAllowed } from "~/lib/usage-ledger.client";

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
    projectInstructions,
    children,
}: {
    threadId: string | null;
    /** Project-level instructions appended to the system prompt. */
    projectInstructions?: string;
    children: ReactNode;
}) {
    const { settings } = useSettings();
    const { addArtifact } = useCanvas();
    const { runSubagent, runSubagentsBatch } = useSubagent();
    const settingsRef = useRef(settings);
    settingsRef.current = settings;
    const projectInstructionsRef = useRef(projectInstructions ?? "");
    projectInstructionsRef.current = projectInstructions ?? "";

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
                    const resolvedApiKey =
                        provider === "custom" &&
                        providerConfig?.openAICompatible?.authMode &&
                        providerConfig.openAICompatible.authMode !== "bearer"
                            ? ""
                            : apiKey || localProviderKey(provider);

                    await assertClientUsageAllowed(s, provider, resolvedApiKey);

                    const memoryEnabled = s.memoryEnabled !== false;
                    const knowledgeEnabled = s.knowledgeEnabled !== false;
                    const memoryContext = memoryEnabled
                        ? await buildLocalMemoryContext()
                        : "";
                    const lastMsg = [...(options.messages ?? [])]
                        .reverse()
                        .find((m) => m.role === "user") as
                        | { parts?: Array<{ type?: string; text?: string }> }
                        | undefined;
                    const lastUserText =
                        lastMsg?.parts
                            ?.filter((p) => p.type === "text" && typeof p.text === "string")
                            .map((p) => p.text ?? "")
                            .join(" ") ?? "";
                    const knowledgeContext =
                        knowledgeEnabled && lastUserText.trim()
                            ? await buildLocalKnowledgeContext(lastUserText)
                            : "";
                    const combinedContext = [memoryContext, knowledgeContext]
                        .filter(Boolean)
                        .join("\n\n");
                    const memoryAvailable =
                        memoryEnabled && (await hasLocalMemoryEntries());
                    const forcedSkills = forcedSkillStore.current;
                    forcedSkillStore.current = [];
                    const forceSubagents = forcedSkills.some(
                        (skill) =>
                            toolNameForForcedSkill(skill.name) === "spawn_subagents",
                    );
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
                            apiKey: resolvedApiKey,
                            baseUrl,
                            openAICompatible: providerConfig?.openAICompatible,
                             systemPrompt: s.chat.systemPrompt,
                             projectInstructions: projectInstructionsRef.current || undefined,
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
                                knowledgeEnabled,
                                subagentsEnabled:
                                    s.subagentsEnabled === true || forceSubagents,
                                tokenMode: s.tokenMode ?? "balanced",
                            },
                            mcpServers: s.mcpServers.filter((m) => m.enabled),
                            memoryContext: combinedContext,
                            agentMode: s.agentModeEnabled === true,
                            ...(forcedSkills.length ? { customSkills: forcedSkills } : {}),
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
                "knowledge_search",
                "knowledge_list",
                "spawn_subagent",
                "spawn_subagents",
            ].includes(toolCall.toolName)) return;
            pendingClientCalls.current += 1;
            const input = toolCall.input as {
                code?: string;
                question?: string;
                questionType?: "single" | "multiple" | "short";
                options?: string[];
                query?: string;
                k?: number;
                task?: string;
                tasks?: string[];
            };
            const task =
                toolCall.toolName === "ask_user"
                    ? askUserInBrowser({
                          question: input.question ?? "Please provide more information.",
                          questionType: input.questionType,
                          options: input.options,
                      })
                    : toolCall.toolName === "spawn_subagents"
                      ? runSubagentsBatch(
                            toolCall.toolCallId,
                            input.tasks ?? [],
                        )
                      : toolCall.toolName === "spawn_subagent"
                        ? runSubagent(toolCall.toolCallId, input.task ?? "")
                        : toolCall.toolName === "memory"
                        ? settingsRef.current.memoryEnabled !== false
                            ? readLocalMemory(input.query)
                            : Promise.resolve("Memory is disabled for this chat.")
                        : toolCall.toolName === "knowledge_list"
                          ? settingsRef.current.knowledgeEnabled !== false
                              ? listKnowledgeDocuments().then((docs) =>
                                    docs.length
                                        ? docs
                                              .map(
                                                  (d, i) =>
                                                      `${i + 1}. ${d.name} (${d.chunkCount} chunks)`,
                                              )
                                              .join("\n")
                                        : "Knowledge base is empty.",
                                )
                              : Promise.resolve("Knowledge base is disabled.")
                          : toolCall.toolName === "knowledge_search"
                            ? settingsRef.current.knowledgeEnabled !== false
                                ? readLocalKnowledge(input.query)
                                : Promise.resolve("Knowledge base is disabled.")
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
                            const artifactId = addArtifact(
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
                            persistArtifactForScope(threadId, {
                                id: artifactId,
                                kind: "file",
                                title: artifact.filename,
                                filename: artifact.filename,
                                content: artifact.content,
                                contentEncoding: artifact.contentEncoding,
                                mimeType,
                                sourceKey,
                                scopeId: threadId,
                                createdAt: Date.now(),
                            });
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
                    const isSubagent =
                        toolCall.toolName === "spawn_subagent" ||
                        toolCall.toolName === "spawn_subagents";
                    const errorText =
                        error instanceof Error
                            ? error.message
                            : isSubagent
                              ? "Subagent run failed"
                              : "Pyodide execution failed";
                    // Always resume the main chat — never leave spawn_* hanging.
                    const addToolOutput = chatRef.current
                        ?.addToolOutput as unknown as
                        | ((args: {
                              tool: string;
                              toolCallId: string;
                              state: "output-available" | "output-error";
                              output?: string;
                              errorText?: string;
                          }) => void)
                        | undefined;
                    if (isSubagent) {
                        addToolOutput?.({
                            tool: toolCall.toolName,
                            toolCallId: toolCall.toolCallId,
                            state: "output-available",
                            output: `Status: error\n${errorText}\nContinue without this subagent result, or finish the work yourself.`,
                        });
                    } else {
                        addToolOutput?.({
                            tool: toolCall.toolName,
                            toolCallId: toolCall.toolCallId,
                            state: "output-error",
                            errorText,
                        });
                    }
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
