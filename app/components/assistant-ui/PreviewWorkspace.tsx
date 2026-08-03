"use client";

import { useChat } from "@ai-sdk/react";
import { AssistantRuntimeProvider as AuiRuntimeProvider } from "@assistant-ui/react";
import {
    AssistantChatTransport,
    useAISDKRuntime,
} from "@assistant-ui/react-ai-sdk";
import {
    Flask,
    Play,
    Paperclip,
    Plus,
    Sparkle,
    SpinnerGap,
    WarningCircle,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState, type FC } from "react";
import { lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from "ai";
import { ChatSessionProvider } from "~/components/assistant-ui/ChatSessionContext";
import { ChatThreadSync } from "~/components/assistant-ui/ChatThreadSync";
import { Thread } from "~/components/assistant-ui/Thread";
import { createAttachmentAdapter } from "~/lib/attachments";
import { getModelModalities } from "~/lib/model-modalities";
import { ModelPicker } from "~/components/ui/ModelPicker";
import { ProviderPicker } from "~/components/ui/ProviderPicker";
import { localProviderKey } from "~/lib/provider-credentials";
import { runBrowserPython } from "~/lib/pyodide";
import { artifactContentHash, inferArtifactMimeType } from "~/lib/artifacts";
import { useCanvas } from "~/lib/canvas";
import {
    buildLocalMemoryContext,
    hasLocalMemoryEntries,
    readLocalMemory,
} from "~/lib/memory";
import { useAskUser } from "~/components/assistant-ui/ask-user";
import {
    deletePreviewSession,
    loadPreviewSession,
    savePreviewSession,
} from "~/lib/db";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { isProviderReady } from "~/lib/setup";
import { getReasoningEffortOptions } from "~/lib/reasoning";
import { resolveModel } from "~/lib/model-capabilities";
import type {
    PreviewModelConfig,
    PreviewSettings,
    ProviderId,
    ReasoningEffort,
} from "~/lib/types";
import { cn } from "~/lib/utils";
import { X } from "lucide-react";

type RunStatus = "running" | "complete" | "error";

type ResolvedConfig = PreviewModelConfig & {
    apiKey: string;
    baseUrl?: string;
    openAICompatible?: import("~/lib/types").ProviderConfig["openAICompatible"];
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
        subagentsEnabled: boolean;
        connectors: import("~/lib/types").ConnectorConfig[];
    };
    mcpServers: Array<{
        id: string;
        name: string;
        kind: "sse" | "stdio" | "http";
        url?: string;
        command?: string;
        args?: string[];
        env?: Record<string, string>;
        headers?: Record<string, string>;
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
    messages?: UIMessage[];
    files: PreviewFile[];
    uploadNotice?: string;
};

type PreviewFile = {
    type: "file";
    url: string;
    mediaType: string;
    filename: string;
};

async function fileToPreviewPart(file: File): Promise<PreviewFile> {
    const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error("File read failed."));
        reader.readAsDataURL(file);
    });
    return {
        type: "file",
        url,
        mediaType: file.type || "application/octet-stream",
        filename: file.name,
    };
}

function fileSupportedForRun(file: PreviewFile, config: PreviewModelConfig): boolean {
    const modalities = getModelModalities(config.model, config.provider);
    if (file.mediaType.startsWith("image/")) return modalities.vision;
    if (file.mediaType === "application/pdf" || !file.mediaType.startsWith("text/")) {
        return modalities.documents;
    }
    return true;
}

type PreviewSession = {
    prompt: string;
    fusionConfig: ResolvedConfig | null;
    primaryCount: number;
    fusionStarted: boolean;
};

type StoredPreviewRun = Omit<PreviewRun, "config"> & {
    config: PreviewModelConfig;
};

type StoredPreviewSession = {
    prompt: string;
    runs: StoredPreviewRun[];
    session: {
        prompt: string;
        fusionConfig: PreviewModelConfig | null;
        primaryCount: number;
        fusionStarted: boolean;
    } | null;
    activeTab: string | null;
    activeSlot: DraftSlot;
};

const PREVIEW_SESSION_ID = "last-preview-session";

type DraftSlot = `primary:${number}` | "fusion";

function responseText(messages: UIMessage[]): string {
    return messages
        .filter((message) => message.role === "assistant")
        .flatMap((message) => message.parts)
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n")
        .trim()
        .slice(0, 64_000);
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
    const { settings, updateSettings } = useSettings();
    const [prompt, setPrompt] = useState("");
    const [files, setFiles] = useState<PreviewFile[]>([]);
    const [runs, setRuns] = useState<PreviewRun[]>([]);
    const [session, setSession] = useState<PreviewSession | null>(null);
    const [activeTab, setActiveTab] = useState<string | null>(null);
    const [activeSlot, setActiveSlot] = useState<DraftSlot>("primary:0");
    const [configurationError, setConfigurationError] = useState<string | null>(null);
    const previewHydrated = useRef(false);

    const resolveConfig = (config: PreviewModelConfig): ResolvedConfig => {
        const provider = settings.providers[config.provider];
        return {
            ...config,
            apiKey:
                config.provider === "custom" &&
                provider?.openAICompatible?.authMode &&
                provider.openAICompatible.authMode !== "bearer"
                    ? ""
                    : provider?.apiKey?.trim() || localProviderKey(config.provider),
            baseUrl: provider?.baseUrl?.trim() || undefined,
            openAICompatible: provider?.openAICompatible,
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
                subagentsEnabled: settings.subagentsEnabled,
                connectors: settings.connectors,
            },
            mcpServers: settings.mcpServers.filter((server) => server.enabled),
        };
    };

    useEffect(() => {
        let cancelled = false;
        void loadPreviewSession<StoredPreviewSession>(PREVIEW_SESSION_ID).then(
            (stored) => {
                if (cancelled || !stored) {
                    previewHydrated.current = true;
                    return;
                }
                setPrompt(stored.prompt);
                setRuns(
                    stored.runs.map((run) => ({
                        ...run,
                        config: resolveConfig(run.config),
                    })),
                );
                setSession(
                    stored.session
                        ? {
                              ...stored.session,
                              fusionConfig: stored.session.fusionConfig
                                  ? resolveConfig(stored.session.fusionConfig)
                                  : null,
                          }
                        : null,
                );
                setActiveTab(stored.activeTab);
                setActiveSlot(stored.activeSlot);
                previewHydrated.current = true;
            },
        );
        return () => {
            cancelled = true;
        };
        // Preview is restored once when this workspace mounts. Credentials are
        // deliberately re-resolved from current local settings, never stored.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!previewHydrated.current) return;
        const timer = window.setTimeout(() => {
            const stored: StoredPreviewSession = {
                prompt,
                runs: runs.map((run) => ({
                    ...run,
                    config: {
                        provider: run.config.provider,
                        model: run.config.model,
                        reasoningEffort: run.config.reasoningEffort,
                    },
                })),
                session: session
                    ? {
                          ...session,
                          fusionConfig: session.fusionConfig
                              ? {
                                    provider: session.fusionConfig.provider,
                                    model: session.fusionConfig.model,
                                    reasoningEffort:
                                        session.fusionConfig.reasoningEffort,
                                }
                              : null,
                      }
                    : null,
                activeTab,
                activeSlot,
            };
            void savePreviewSession(PREVIEW_SESSION_ID, stored);
        }, 300);
        return () => window.clearTimeout(timer);
    }, [activeSlot, activeTab, prompt, runs, session]);

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
            files: files.filter((file) => fileSupportedForRun(file, config)),
            uploadNotice: files.some((file) => !fileSupportedForRun(file, config))
                ? "Some files were skipped because this model does not support their modality."
                : undefined,
        }));

        setConfigurationError(null);
        setSession({
            prompt: input,
            fusionConfig: settings.preview.fusionModel
                ? resolveConfig(settings.preview.fusionModel)
                : null,
            primaryCount: primaryRuns.length,
            fusionStarted: false,
        });
        setRuns(primaryRuns);
        setActiveTab(primaryRuns[0]?.id ?? null);
    };

    const addFiles = async (selected: FileList | null) => {
        if (!selected?.length) return;
        const next = await Promise.all([...selected].map(fileToPreviewPart));
        setFiles((current) => [...current, ...next].slice(0, 8));
    };

    const markComplete = (runId: string, messages: UIMessage[]) => {
        setRuns((current) =>
            current.map((run) =>
                run.id === runId
                    ? { ...run, status: "complete", output: responseText(messages), messages }
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
        if (!session?.fusionConfig || session.fusionStarted) return;
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
            files: [],
        };
        setSession((current) =>
            current ? { ...current, fusionStarted: true } : current,
        );
        setRuns((current) => [...current, fusionRun]);
        setActiveTab(fusionRun.id);
    }, [runs, session]);

    const closeRun = (runId: string) => {
        const run = runs.find((candidate) => candidate.id === runId);
        if (!run || run.status === "running") return;
        const remaining = runs.filter((candidate) => candidate.id !== runId);
        setRuns(remaining);
        if (run.kind === "primary" && session && !session.fusionStarted) {
            setSession({
                ...session,
                primaryCount: Math.max(0, session.primaryCount - 1),
            });
        }
        if (activeTab === runId) {
            setActiveTab(remaining[0]?.id ?? null);
        }
    };

    const running = runs.some((run) => run.status === "running");
    const draftSlots: DraftSlot[] = [
        ...settings.preview.primaryModels
            .slice(0, 3)
            .map((_, index) => `primary:${index}` as DraftSlot),
        ...(settings.preview.fusionModel ? ["fusion" as const] : []),
    ];
    const activeDraftConfig =
        activeSlot === "fusion"
            ? settings.preview.fusionModel
            : settings.preview.primaryModels[Number(activeSlot.split(":")[1])];
    const updateDraftConfig = (patch: Partial<PreviewModelConfig>) => {
        if (!activeDraftConfig) return;
        if (activeSlot === "fusion") {
            updateSettings({
                preview: {
                    ...settings.preview,
                    fusionModel: { ...activeDraftConfig, ...patch },
                },
            });
            return;
        }
        const index = Number(activeSlot.split(":")[1]);
        updateSettings({
            preview: {
                ...settings.preview,
                primaryModels: settings.preview.primaryModels.map((config, current) =>
                    current === index ? { ...config, ...patch } : config,
                ),
            },
        });
    };
    const addDraftModel = () => {
        if (settings.preview.primaryModels.length >= 3) return;
        updateSettings({
            preview: {
                ...settings.preview,
                primaryModels: [
                    ...settings.preview.primaryModels,
                    {
                        provider: settings.chat.provider,
                        model: settings.chat.model,
                        reasoningEffort: settings.chat.reasoningEffort,
                    },
                ],
            },
        });
        setActiveSlot(`primary:${settings.preview.primaryModels.length}`);
    };
    const addFusionModel = () => {
        if (settings.preview.fusionModel) return;
        updateSettings({
            preview: {
                ...settings.preview,
                fusionModel: {
                    provider: settings.chat.provider,
                    model: settings.chat.model,
                    reasoningEffort: settings.chat.reasoningEffort,
                },
            },
        });
        setActiveSlot("fusion");
    };
    const closeDraftSlot = (slot: DraftSlot) => {
        if (slot === "fusion") {
            updateSettings({
                preview: { ...settings.preview, fusionModel: null },
            });
            setActiveSlot(
                settings.preview.primaryModels.length > 0 ? "primary:0" : "fusion",
            );
            return;
        }

        const removedIndex = Number(slot.split(":")[1]);
        const primaryModels = settings.preview.primaryModels.filter(
            (_, index) => index !== removedIndex,
        );
        updateSettings({
            preview: { ...settings.preview, primaryModels },
        });

        if (primaryModels.length === 0) {
            setActiveSlot(settings.preview.fusionModel ? "fusion" : "primary:0");
        } else if (activeSlot === slot) {
            setActiveSlot(
                `primary:${Math.min(removedIndex, primaryModels.length - 1)}`,
            );
        } else if (activeSlot.startsWith("primary:")) {
            const activeIndex = Number(activeSlot.split(":")[1]);
            if (activeIndex > removedIndex) {
                setActiveSlot(`primary:${activeIndex - 1}`);
            }
        }
    };
    const resetPreview = () => {
        setRuns([]);
        setSession(null);
        setActiveTab(null);
        setActiveSlot("primary:0");
        void deletePreviewSession(PREVIEW_SESSION_ID);
    };

    return (
        <div className="flex h-full min-h-0 flex-col">
            <PreviewTabs
                runs={runs}
                draftSlots={draftSlots}
                settings={settings}
                activeTab={activeTab}
                activeSlot={activeSlot}
                onTabChange={setActiveTab}
                onSlotChange={setActiveSlot}
                onAddModel={addDraftModel}
                onAddFusion={addFusionModel}
                onNew={resetPreview}
                onClose={closeRun}
                onCloseSlot={closeDraftSlot}
            />
            <div className="relative flex min-h-0 flex-1 flex-col">
                {runs.length === 0 ? (
                    <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center">
                        <div className="max-w-sm space-y-2">
                            <Flask size={24} className="mx-auto text-primary" />
                            <p className="text-sm font-semibold">Experimental comparison</p>
                            <p className="text-xs leading-relaxed text-muted-foreground">
                                Send one prompt to the configured model tabs and inspect each model&apos;s complete work.
                            </p>
                        </div>
                    </div>
                ) : (
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
                )}
                <PreviewComposer
                    prompt={prompt}
                    onPromptChange={setPrompt}
                    onSubmit={startRuns}
                    running={running}
                    configurationError={configurationError}
                    config={activeDraftConfig}
                    onConfigChange={updateDraftConfig}
                    onAddModel={addDraftModel}
                    files={files}
                    onFiles={addFiles}
                    onRemoveFile={(filename) =>
                        setFiles((current) => current.filter((file) => file.filename !== filename))
                    }
                />
            </div>
        </div>
    );
};

const PreviewTabs: FC<{
    runs: PreviewRun[];
    draftSlots: DraftSlot[];
    settings: { preview: PreviewSettings };
    activeTab: string | null;
    activeSlot: DraftSlot;
    onTabChange: (id: string) => void;
    onSlotChange: (slot: DraftSlot) => void;
    onAddModel: () => void;
    onAddFusion: () => void;
    onNew: () => void;
    onClose: (id: string) => void;
    onCloseSlot: (slot: DraftSlot) => void;
}> = ({
    runs,
    draftSlots,
    settings,
    activeTab,
    activeSlot,
    onTabChange,
    onSlotChange,
    onAddModel,
    onAddFusion,
    onNew,
    onClose,
    onCloseSlot,
}) => {
    const hasRuns = runs.length > 0;
    return (
        <div className="flex min-h-10 shrink-0 items-center gap-1 overflow-x-auto border-b border-border/70 bg-background px-3 py-1.5">
            <div className="flex min-w-0 flex-1 items-center gap-1">
                {hasRuns
                    ? runs.map((run) => (
                          <div
                              key={run.id}
                              className={cn(
                                  "flex max-w-60 shrink-0 items-center gap-0.5 rounded-lg px-1 py-0.5 text-xs font-medium outline-none transition-colors",
                                  activeTab === run.id
                                      ? "bg-accent text-foreground"
                                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                              )}
                          >
                              <button
                                  type="button"
                                  onClick={() => onTabChange(run.id)}
                                  className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 outline-none"
                                  aria-label={`Open ${run.label} tab`}
                              >
                                  {run.status === "running" ? (
                                      <SpinnerGap
                                          size={12}
                                          className="shrink-0 animate-spin text-primary"
                                      />
                                  ) : run.kind === "fusion" ? (
                                      <Sparkle size={12} className="shrink-0 text-primary" />
                                  ) : null}
                                  <span className="truncate">{run.label}</span>
                              </button>
                              <button
                                  type="button"
                                  disabled={run.status === "running"}
                                  onClick={() => onClose(run.id)}
                                  className="rounded-md p-1 text-muted-foreground outline-none hover:bg-background/70 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                                  aria-label={
                                      run.status === "running"
                                          ? `${run.label} is still running`
                                          : `Close ${run.label} tab`
                                  }
                              >
                                  <X size={12} />
                              </button>
                          </div>
                      ))
                    : draftSlots.map((slot, index) => {
                          const config =
                              slot === "fusion"
                                  ? settings.preview.fusionModel
                                  : settings.preview.primaryModels[index];
                          if (!config) return null;
                           return (
                               <div
                                   key={slot}
                                   className={cn(
                                       "flex max-w-60 shrink-0 items-center gap-0.5 rounded-lg px-1 py-0.5 text-xs font-medium outline-none transition-colors",
                                       activeSlot === slot
                                           ? "bg-accent text-foreground"
                                           : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                                   )}
                               >
                                   <button
                                       type="button"
                                       onClick={() => onSlotChange(slot)}
                                       className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 outline-none"
                                       aria-label={`Configure ${slot === "fusion" ? "fusion" : `model ${index + 1}`} tab`}
                                   >
                                       {slot === "fusion" ? (
                                           <Sparkle size={12} className="shrink-0 text-primary" />
                                       ) : null}
                                       <span className="truncate">
                                           {slot === "fusion"
                                               ? `Fusion · ${config.model}`
                                               : `${index + 1} · ${config.model}`}
                                       </span>
                                   </button>
                                   <button
                                       type="button"
                                       onClick={() => onCloseSlot(slot)}
                                       className="rounded-md p-1 text-muted-foreground outline-none hover:bg-background/70 hover:text-foreground"
                                       aria-label={`Close ${slot === "fusion" ? "fusion" : `model ${index + 1}`} tab`}
                                   >
                                       <X size={12} />
                                   </button>
                               </div>
                           );
                      })}
            </div>

            {!hasRuns ? (
                <>
                    {settings.preview.primaryModels.length < 3 ? (
                        <button
                            type="button"
                            onClick={onAddModel}
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground"
                        >
                            <Plus size={13} />
                            Model
                        </button>
                    ) : null}
                    {!settings.preview.fusionModel ? (
                        <button
                            type="button"
                            onClick={onAddFusion}
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground"
                        >
                            <Sparkle size={13} />
                            Fusion
                        </button>
                    ) : null}
                </>
            ) : (
                <button
                    type="button"
                    onClick={onNew}
                    className="shrink-0 rounded-lg px-2 py-1.5 text-[11px] font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground"
                >
                    New compare
                </button>
            )}
        </div>
    );
};

const PreviewComposer: FC<{
    prompt: string;
    onPromptChange: (value: string) => void;
    onSubmit: () => void;
    running: boolean;
    configurationError: string | null;
    config: PreviewModelConfig | undefined | null;
    onConfigChange: (patch: Partial<PreviewModelConfig>) => void;
    onAddModel: () => void;
    files: PreviewFile[];
    onFiles: (files: FileList | null) => void;
    onRemoveFile: (filename: string) => void;
}> = ({
    prompt,
    onPromptChange,
    onSubmit,
    running,
    configurationError,
    config,
    onConfigChange,
    files,
    onFiles,
    onRemoveFile,
}) => {
    const { settings } = useSettings();
    const providerReady = config
        ? isProviderReady(settings, config.provider)
        : false;
    const reasoningOptions = config
        ? getReasoningEffortOptions(config.provider, config.model)
        : [];

    return (
        <div className="relative z-10 w-full shrink-0 bg-background px-4 pb-4 pt-2">
            <div className="mx-auto w-full max-w-(--thread-max-width) rounded-[1.25rem] border border-border bg-muted/35 p-2.5 shadow-sm">
                <textarea
                    value={prompt}
                    onChange={(event) => onPromptChange(event.target.value)}
                    onKeyDown={(event) => {
                        if (
                            (event.metaKey || event.ctrlKey) &&
                            event.key === "Enter"
                        ) {
                            event.preventDefault();
                            if (!running) onSubmit();
                        }
                    }}
                    placeholder="Send a message to the selected models…"
                    className="min-h-16 w-full resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
                />
                {files.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 px-2 pb-2">
                        {files.map((file) => (
                            <button
                                key={file.filename}
                                type="button"
                                onClick={() => onRemoveFile(file.filename)}
                                className="max-w-48 truncate rounded-full border border-border/70 bg-background px-2 py-1 text-[10px] text-muted-foreground hover:bg-accent"
                                title="Remove file"
                            >
                                {file.filename} ×
                            </button>
                        ))}
                    </div>
                ) : null}
                <div className="flex min-w-0 flex-wrap items-center gap-1.5 px-1">
                    <label className="inline-flex size-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
                        <Paperclip size={15} />
                        <input
                            type="file"
                            multiple
                            accept="image/*,.pdf,.txt,.md,.csv,.json,.js,.jsx,.ts,.tsx,.css,.html,.xml,.yaml,.yml"
                            className="sr-only"
                            onChange={(event) => {
                                void onFiles(event.target.files);
                                event.currentTarget.value = "";
                            }}
                        />
                    </label>
                    {config ? (
                        <ProviderPicker
                            value={config.provider}
                            onChange={(provider) =>
                                onConfigChange({
                                    provider,
                                    model: resolveModel(provider, config.model),
                                    reasoningEffort: "medium",
                                })
                            }
                            compact
                            className="max-w-[9rem]"
                        />
                    ) : null}
                    {config && providerReady ? (
                        <ModelPicker
                            provider={config.provider}
                            value={config.model}
                            onChange={(model) => onConfigChange({ model })}
                            enabled
                            compact
                            className="max-w-[13rem]"
                        />
                    ) : null}
                    {config && reasoningOptions.length > 0 ? (
                        <select
                            value={
                                reasoningOptions.some(
                                    (option) => option.id === config.reasoningEffort,
                                )
                                    ? config.reasoningEffort
                                    : reasoningOptions[0].id
                            }
                            onChange={(event) =>
                                onConfigChange({
                                    reasoningEffort: event.target
                                        .value as PreviewModelConfig["reasoningEffort"],
                                })
                            }
                            className="h-7 max-w-36 rounded-lg border border-border/70 bg-transparent px-2 text-[11px] font-medium outline-none"
                            aria-label="Reasoning effort"
                        >
                            {reasoningOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    ) : null}
                    <span className="flex-1" />
                    <button
                        type="button"
                        disabled={running || !prompt.trim()}
                        onClick={onSubmit}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {running ? (
                            <SpinnerGap size={14} className="animate-spin" />
                        ) : (
                            <Play size={13} weight="fill" />
                        )}
                        {running ? "Running" : "Compare"}
                    </button>
                </div>
                {configurationError ? (
                    <p className="flex items-center gap-1.5 px-2 pt-2 text-[11px] text-destructive">
                        <WarningCircle size={13} />
                        {configurationError}
                    </p>
                ) : null}
            </div>
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
    const { settings } = useSettings();
    const { addArtifact } = useCanvas();
    const { ask: askUser } = useAskUser();
    const settingsRef = useRef(settings);
    settingsRef.current = settings;
    const memoryEnabled = settings.memoryEnabled !== false;
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
        prepareSendMessagesRequest: async (options) => {
                    return { body: {
                        ...options.body,
                        messages: options.messages,
                        model: run.config.model,
                        provider: run.config.provider as ProviderId,
                        apiKey: run.config.apiKey,
                        baseUrl: run.config.baseUrl,
                        openAICompatible: run.config.openAICompatible,
                        systemPrompt: run.config.systemPrompt,
                        temperature: run.config.temperature,
                        maxTokens: run.config.maxTokens,
                        topP: run.config.topP,
                        reasoningEffort: run.config.reasoningEffort as ReasoningEffort,
                        imageSettings: {
                            size: run.config.imageSize,
                            count: run.config.imageCount,
                        },
                        mcpServers: run.config.mcpServers,
                        memoryContext: memoryEnabled
                            ? await buildLocalMemoryContext()
                            : "",
                        toolSettings: {
                            ...run.config.toolSettings,
                            memoryAvailable:
                                memoryEnabled && await hasLocalMemoryEntries(),
                        },
                    },
                    };
                },
            }),
        [run.config, memoryEnabled],
    );
    const chatRef = useRef<ReturnType<typeof useChat> | null>(null);
    const pendingClientCalls = useRef(0);
    const chat = useChat({
        id: run.id,
        transport,
        messages: run.messages,
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
                    ? askUser(
                          input.question ?? "Please provide more information.",
                          input.questionType ?? "short",
                          input.options,
                      )
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
                            addArtifact(
                                {
                                    kind: "file",
                                    title: artifact.filename,
                                    filename: artifact.filename,
                                    content: artifact.content,
                                    contentEncoding: artifact.contentEncoding,
                                    mimeType: inferArtifactMimeType(artifact.filename),
                                    sourceKey: `python:${artifact.filename}:${artifact.contentEncoding}:${artifact.content.length}:${artifactContentHash(artifact.content)}`,
                                },
                                { scopeId: run.id },
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
        onFinish: ({ messages, isError }) => {
            if (!isError) callbacksRef.current.onComplete(run.id, messages);
        },
        onError: (error) => callbacksRef.current.onError(run.id, error),
    });
    chatRef.current = chat;
    const runtime = useAISDKRuntime(chat, { adapters });

    useEffect(() => {
        transport.setRuntime(runtime);
    }, [transport, runtime]);

    useEffect(() => {
        if (sentRef.current || run.messages?.length) return;
        sentRef.current = true;
        void chat.sendMessage({ text: run.prompt, files: run.files });
    }, [chat, run.messages?.length, run.prompt]);

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
