"use client";

import { useChat } from "@ai-sdk/react";
import { AssistantRuntimeProvider as AuiRuntimeProvider } from "@assistant-ui/react";
import {
    AssistantChatTransport,
    useAISDKRuntime,
} from "@assistant-ui/react-ai-sdk";
import { Flask, Play, Sparkle, SpinnerGap, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState, type FC } from "react";
import type { UIMessage } from "ai";
import { ChatSessionProvider } from "~/components/assistant-ui/ChatSessionContext";
import { ChatThreadSync } from "~/components/assistant-ui/ChatThreadSync";
import { Thread } from "~/components/assistant-ui/Thread";
import { createAttachmentAdapter } from "~/lib/attachments";
import { getModelModalities } from "~/lib/model-modalities";
import { localProviderKey } from "~/lib/provider-credentials";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { isProviderReady } from "~/lib/setup";
import type { PreviewModelConfig, ProviderId, ReasoningEffort } from "~/lib/types";
import { cn } from "~/lib/utils";

type RunStatus = "running" | "complete" | "error";

type ResolvedConfig = PreviewModelConfig & {
    apiKey: string;
    baseUrl?: string;
    systemPrompt: string;
    temperature: number;
    maxTokens: number | null;
    topP: number;
    imageSize: "1024x1024" | "1536x1024" | "1024x1536";
    imageCount: number;
    toolSettings: {
        webSearchEnabled: boolean;
        calculatorEnabled: boolean;
        pythonEnabled: boolean;
        webSearchEngine: "duckduckgo" | "searxng";
        searxngUrl: string;
        skillsEnabled: boolean;
    };
    mcpServers: Array<{
        id: string;
        name: string;
        kind: "sse" | "stdio" | "http";
        url?: string;
        command?: string;
        args?: string[];
        env?: Record<string, string>;
        enabled: boolean;
    }>;
};

type PreviewRun = {
    id: string;
    kind: "primary" | "fusion";
    label: string;
    prompt: string;
    config: ResolvedConfig;
    status: RunStatus;
    output: string;
    error?: string;
};

type PreviewSession = {
    prompt: string;
    fusionConfig: ResolvedConfig | null;
    primaryCount: number;
};

function responseText(messages: UIMessage[]): string {
    return messages
        .filter((message) => message.role === "assistant")
        .flatMap((message) => message.parts)
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n")
        .trim()
        .slice(0, 24_000);
}

function modelLabel(config: PreviewModelConfig, fusion = false): string {
    return fusion ? `Fusion · ${config.model}` : config.model;
}

function parseChatError(response: Response, fallback: string): Promise<string> {
    return response.text().then((text) => {
        try {
            const parsed = JSON.parse(text) as { error?: string; message?: string };
            return parsed.error || parsed.message || fallback;
        } catch {
            return text.trim() || fallback;
        }
    });
}

export const PreviewWorkspace: FC = () => {
    const { settings } = useSettings();
    const [prompt, setPrompt] = useState("");
    const [runs, setRuns] = useState<PreviewRun[]>([]);
    const [session, setSession] = useState<PreviewSession | null>(null);
    const [activeTab, setActiveTab] = useState<string | null>(null);
    const [configurationError, setConfigurationError] = useState<string | null>(null);

    const resolveConfig = (config: PreviewModelConfig): ResolvedConfig => {
        const provider = settings.providers[config.provider];
        return {
            ...config,
            apiKey: provider?.apiKey?.trim() || localProviderKey(config.provider),
            baseUrl: provider?.baseUrl?.trim() || undefined,
            systemPrompt: settings.chat.systemPrompt,
            temperature: settings.chat.temperature,
            maxTokens: settings.chat.maxTokens,
            topP: settings.chat.topP,
            imageSize: settings.chat.imageSize,
            imageCount: settings.chat.imageCount,
            toolSettings: {
                webSearchEnabled: settings.webSearchEnabled,
                calculatorEnabled: settings.calculatorEnabled,
                pythonEnabled: settings.pythonEnabled,
                webSearchEngine: settings.webSearchEngine,
                searxngUrl: settings.searxngUrl,
                skillsEnabled: settings.skillsEnabled,
            },
            mcpServers: settings.mcpServers.filter((server) => server.enabled),
        };
    };

    const startRuns = () => {
        const input = prompt.trim();
        const selections = settings.preview.primaryModels.slice(0, 3);
        const unavailable = selections.find(
            (config) => !isProviderReady(settings, config.provider),
        );

        if (!input) {
            setConfigurationError("Enter a prompt to compare model responses.");
            return;
        }
        if (selections.length === 0) {
            setConfigurationError("Add at least one preview model in Settings > Experimental.");
            return;
        }
        if (unavailable) {
            setConfigurationError(
                `Connect ${unavailable.provider} before starting this preview.`,
            );
            return;
        }
        if (
            settings.preview.fusionModel &&
            !isProviderReady(settings, settings.preview.fusionModel.provider)
        ) {
            setConfigurationError(
                `Connect ${settings.preview.fusionModel.provider} before using the fusion model.`,
            );
            return;
        }

        const id = `preview_${Date.now()}`;
        const primaryRuns = selections.map((config, index): PreviewRun => ({
            id: `${id}_model_${index + 1}`,
            kind: "primary",
            label: modelLabel(config),
            prompt: input,
            config: resolveConfig(config),
            status: "running",
            output: "",
        }));

        setConfigurationError(null);
        setSession({
            prompt: input,
            fusionConfig: settings.preview.fusionModel
                ? resolveConfig(settings.preview.fusionModel)
                : null,
            primaryCount: primaryRuns.length,
        });
        setRuns(primaryRuns);
        setActiveTab(primaryRuns[0]?.id ?? null);
    };

    const markComplete = (runId: string, messages: UIMessage[]) => {
        setRuns((current) =>
            current.map((run) =>
                run.id === runId
                    ? { ...run, status: "complete", output: responseText(messages) }
                    : run,
            ),
        );
    };

    const markError = (runId: string, error: Error) => {
        setRuns((current) =>
            current.map((run) =>
                run.id === runId
                    ? { ...run, status: "error", error: error.message }
                    : run,
            ),
        );
    };

    useEffect(() => {
        if (!session?.fusionConfig) return;
        const primaryRuns = runs.filter((run) => run.kind === "primary");
        if (
            primaryRuns.length !== session.primaryCount ||
            primaryRuns.some((run) => run.status === "running") ||
            runs.some((run) => run.kind === "fusion")
        ) {
            return;
        }

        const fusionPrompt = [
            "Synthesize the candidate answers below into one accurate, direct answer.",
            "Resolve conflicts, retain useful specifics, and do not mention that multiple models were used unless it materially helps the user.",
            "",
            `User prompt:\n${session.prompt}`,
            "",
            ...primaryRuns.map(
                (run) =>
                    `### ${run.label}\n${run.output || `No completed output${run.error ? ` (${run.error})` : ""}.`}`,
            ),
        ].join("\n");
        const fusionRun: PreviewRun = {
            id: `preview_fusion_${Date.now()}`,
            kind: "fusion",
            label: modelLabel(session.fusionConfig, true),
            prompt: fusionPrompt,
            config: session.fusionConfig,
            status: "running",
            output: "",
        };
        setRuns((current) => [...current, fusionRun]);
        setActiveTab(fusionRun.id);
    }, [runs, session]);

    const running = runs.some((run) => run.status === "running");

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-border/70 bg-background px-4 py-3 md:px-6">
                <div className="mx-auto flex w-full max-w-4xl flex-col gap-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Flask size={14} className="text-primary" />
                        <span>Experimental multi-model preview</span>
                        <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-primary">
                            Beta
                        </span>
                    </div>
                    <textarea
                        value={prompt}
                        onChange={(event) => setPrompt(event.target.value)}
                        onKeyDown={(event) => {
                            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                                event.preventDefault();
                                if (!running) startRuns();
                            }
                        }}
                        placeholder="Ask the configured models a question…"
                        className="min-h-20 w-full resize-y rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
                    />
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] text-muted-foreground">
                            {settings.preview.primaryModels.length} comparison model{settings.preview.primaryModels.length === 1 ? "" : "s"}
                            {settings.preview.fusionModel ? " + fusion" : ""}
                        </p>
                        <button
                            type="button"
                            disabled={running}
                            onClick={startRuns}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {running ? <SpinnerGap size={14} className="animate-spin" /> : <Play size={13} weight="fill" />}
                            {running ? "Running…" : "Compare"}
                        </button>
                    </div>
                    {configurationError ? (
                        <p className="flex items-center gap-1.5 text-[11px] text-destructive">
                            <WarningCircle size={13} />
                            {configurationError}
                        </p>
                    ) : null}
                </div>
            </div>

            {runs.length === 0 ? (
                <div className="flex flex-1 items-center justify-center p-6 text-center">
                    <div className="max-w-sm space-y-2">
                        <Sparkle size={24} className="mx-auto text-primary" />
                        <p className="text-sm font-semibold">Compare model work side by side</p>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Configure primary and optional fusion models in Settings → Experimental, then run a prompt to inspect their outputs, tool calls, reasoning, and artifacts in separate tabs.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex min-h-0 flex-1 flex-col">
                    <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border/70 px-3 pt-2">
                        {runs.map((run) => (
                            <button
                                key={run.id}
                                type="button"
                                onClick={() => setActiveTab(run.id)}
                                className={cn(
                                    "flex max-w-52 shrink-0 items-center gap-1.5 rounded-t-lg border border-b-0 px-2.5 py-1.5 text-xs font-medium outline-none transition-colors",
                                    activeTab === run.id
                                        ? "border-border bg-background text-foreground"
                                        : "border-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                                )}
                            >
                                {run.status === "running" ? (
                                    <SpinnerGap size={12} className="shrink-0 animate-spin text-primary" />
                                ) : run.kind === "fusion" ? (
                                    <Sparkle size={12} className="shrink-0 text-primary" />
                                ) : null}
                                <span className="truncate">{run.label}</span>
                            </button>
                        ))}
                    </div>
                    <div className="min-h-0 flex-1">
                        {runs.map((run) => (
                            <div
                                key={run.id}
                                className={cn("h-full", activeTab === run.id ? "block" : "hidden")}
                            >
                                <PreviewRunPanel
                                    run={run}
                                    active={activeTab === run.id}
                                    onComplete={markComplete}
                                    onError={markError}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const PreviewRunPanel: FC<{
    run: PreviewRun;
    active: boolean;
    onComplete: (runId: string, messages: UIMessage[]) => void;
    onError: (runId: string, error: Error) => void;
}> = ({ run, active, onComplete, onError }) => {
    const callbacksRef = useRef({ onComplete, onError });
    callbacksRef.current = { onComplete, onError };
    const sentRef = useRef(false);
    const modalities = getModelModalities(run.config.model, run.config.provider);
    const adapters = useMemo(
        () => ({ attachments: createAttachmentAdapter(modalities) }),
        [modalities.documents, modalities.tools, modalities.vision],
    );
    const transport = useMemo(
        () =>
            new AssistantChatTransport({
                api: "/api/chat",
                fetch: async (input, init) => {
                    const response = await globalThis.fetch(input, init);
                    if (!response.ok) {
                        throw new Error(
                            await parseChatError(response, "Preview run failed"),
                        );
                    }
                    return response;
                },
                prepareSendMessagesRequest: async (options) => ({
                    body: {
                        ...options.body,
                        messages: options.messages,
                        model: run.config.model,
                        provider: run.config.provider as ProviderId,
                        apiKey: run.config.apiKey,
                        baseUrl: run.config.baseUrl,
                        systemPrompt: run.config.systemPrompt,
                        temperature: run.config.temperature,
                        maxTokens: run.config.maxTokens,
                        topP: run.config.topP,
                        reasoningEffort: run.config.reasoningEffort as ReasoningEffort,
                        imageSettings: {
                            size: run.config.imageSize,
                            count: run.config.imageCount,
                        },
                        toolSettings: run.config.toolSettings,
                        mcpServers: run.config.mcpServers,
                    },
                }),
            }),
        [run.config],
    );
    const chat = useChat({
        id: run.id,
        transport,
        onFinish: ({ messages, isError }) => {
            if (!isError) callbacksRef.current.onComplete(run.id, messages);
        },
        onError: (error) => callbacksRef.current.onError(run.id, error),
    });
    const runtime = useAISDKRuntime(chat, { adapters });

    useEffect(() => {
        transport.setRuntime(runtime);
    }, [transport, runtime]);

    useEffect(() => {
        if (sentRef.current) return;
        sentRef.current = true;
        void chat.sendMessage({ text: run.prompt });
    }, [chat, run.prompt]);

    return (
        <ChatSessionProvider value={chat}>
            <AuiRuntimeProvider runtime={runtime}>
                {active ? (
                    <ChatThreadSync threadId={null} artifactScopeId={run.id} />
                ) : null}
                {run.error ? (
                    <div className="mx-4 mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        {run.error}
                    </div>
                ) : null}
                <Thread hideComposer />
            </AuiRuntimeProvider>
        </ChatSessionProvider>
    );
};
