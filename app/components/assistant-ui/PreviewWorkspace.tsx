"use client";

import { useChat } from "@ai-sdk/react";
import { AssistantRuntimeProvider as AuiRuntimeProvider } from "@assistant-ui/react";
import {
    AssistantChatTransport,
    useAISDKRuntime,
} from "@assistant-ui/react-ai-sdk";
import {
    ArrowClockwise,
    CaretDown,
    CopySimple,
    DownloadSimple,
    FileText,
    Paperclip,
    Play,
    Plus,
    Sparkle,
    SpinnerGap,
    Stop,
    WarningCircle,
} from "@phosphor-icons/react";
import {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type FC,
    type MutableRefObject,
    type ReactNode,
} from "react";
import { lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from "ai";
import { ChatSessionProvider } from "~/components/assistant-ui/ChatSessionContext";
import {
    ChatThreadSync,
    type SyncedArtifact,
} from "~/components/assistant-ui/ChatThreadSync";
import { Thread } from "~/components/assistant-ui/Thread";
import { createAttachmentAdapter } from "~/lib/attachments";
import { getModelModalities } from "~/lib/model-modalities";
import { ModelLogo } from "~/components/ui/ModelLogo";
import { ModelPicker } from "~/components/ui/ModelPicker";
import { ProviderPicker } from "~/components/ui/ProviderPicker";
import { localProviderKey } from "~/lib/provider-credentials";
import { assertClientUsageAllowed } from "~/lib/usage-ledger.client";
import {
    applyCreditsFallback,
    findCreditsFallbackTarget,
    notifyCreditsFallback,
} from "~/lib/credits-fallback";
import { detectProviderCreditError } from "~/lib/provider-errors";
import { notifyChatGPTRequestFailure } from "~/lib/chatgpt-refresh";
import { collectPythonInputFiles, runBrowserPython } from "~/lib/pyodide";
import {
    artifactContentHash,
    decodeArtifactContent,
    inferArtifactMimeType,
    isImageMimeType,
    preparePreviewDocument,
} from "~/lib/artifacts";
import { useCanvas, type Artifact } from "~/lib/canvas";
import {
    deletePreviewSession,
    loadPreviewSession,
    savePreviewSession,
} from "~/lib/db";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { isProviderReady } from "~/lib/setup";
import { getReasoningEffortOptions } from "~/lib/reasoning";
import { resolveModel } from "~/lib/model-capabilities";
import { PROVIDER_DEFAULTS, type PreviewModelConfig, type ProviderId, type ReasoningEffort } from "~/lib/types";
import { cn } from "~/lib/utils";
import { X } from "lucide-react";
import { toolAccessAllows } from "~/lib/tool-access";

type RunStatus = "running" | "complete" | "error" | "stopped";

type ResolvedConfig = PreviewModelConfig & {
    apiKey: string;
    baseUrl?: string;
    openAICompatible?: import("~/lib/types").ProviderConfig["openAICompatible"];
    systemPrompt: string;
    advancedSystemPrompt?: string;
    temperature: number;
    maxTokens: number | null;
    topP: number;
    imageSize: "1024x1024" | "1536x1024" | "1024x1536";
    imageCount: number;
    toolSettings: {
        webSearchEnabled: boolean;
        calculatorEnabled: boolean;
        pythonEnabled: boolean;
        linuxEnvironment: boolean;
        webSearchEngine: "duckduckgo" | "searxng";
        searxngUrl: string;
        skillsEnabled: boolean;
        subagentsEnabled: boolean;
        connectors: import("~/lib/types").ConnectorConfig[];
        tokenMode?: import("~/lib/token-mode").TokenMode;
        toolAccess?: import("~/lib/tool-access").ToolAccessSettings;
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
    slotIndex?: number;
    label: string;
    prompt: string;
    config: ResolvedConfig;
    status: RunStatus;
    output: string;
    error?: string;
    messages?: UIMessage[];
    artifacts: Artifact[];
    files: PreviewFile[];
    uploadNotice?: string;
    startedAt: number;
    finishedAt?: number;
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
};

const PREVIEW_SESSION_ID = "last-preview-session";

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

function shortModelName(model: string) {
    const parts = model.split("/");
    return parts[parts.length - 1] || model;
}

function formatDuration(ms: number) {
    if (ms < 1000) return `${Math.max(1, Math.round(ms))}ms`;
    return `${(ms / 1000).toFixed(ms >= 10_000 ? 0 : 1)}s`;
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

function serializePreviewSession(
    prompt: string,
    runs: PreviewRun[],
    session: PreviewSession | null,
    stopRunning = false,
): StoredPreviewSession {
    const finishedAt = Date.now();
    return {
        prompt,
        runs: runs.map((run) => {
            const status: RunStatus =
                stopRunning && run.status === "running" ? "stopped" : run.status;
            return {
                ...run,
                status,
                ...(status === "stopped" && run.status === "running"
                    ? { finishedAt }
                    : {}),
                config: {
                    provider: run.config.provider,
                    model: run.config.model,
                    reasoningEffort: run.config.reasoningEffort,
                },
            };
        }),
        session: session
            ? {
                  ...session,
                  fusionConfig: session.fusionConfig
                      ? {
                            provider: session.fusionConfig.provider,
                            model: session.fusionConfig.model,
                            reasoningEffort: session.fusionConfig.reasoningEffort,
                        }
                      : null,
              }
            : null,
    };
}

export const PreviewWorkspace: FC = () => {
    const { settings, updateSettings } = useSettings();
    const { setArtifactScope, closeCanvas } = useCanvas();
    const [prompt, setPrompt] = useState("");
    const [files, setFiles] = useState<PreviewFile[]>([]);
    const [runs, setRuns] = useState<PreviewRun[]>([]);
    const [session, setSession] = useState<PreviewSession | null>(null);
    const [configurationError, setConfigurationError] = useState<string | null>(null);
    const [fusionOpen, setFusionOpen] = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [focusedColumn, setFocusedColumn] = useState(0);
    const previewHydrated = useRef(false);
    const previewStateRef = useRef<{
        prompt: string;
        files: PreviewFile[];
        runs: PreviewRun[];
        session: PreviewSession | null;
    }>({ prompt: "", files: [], runs: [], session: null });
    const stopMap = useRef(new Map<string, () => void>());
    const columnRefs = useRef<Array<HTMLElement | null>>([]);

    previewStateRef.current = { prompt, files, runs, session };

    useEffect(() => {
        setArtifactScope("preview-workspace");
        closeCanvas();
    }, [closeCanvas, setArtifactScope]);

    const resolveConfig = (config: PreviewModelConfig): ResolvedConfig => {
        const provider = settings.providers[config.provider];
        return {
            ...config,
            apiKey:
                config.provider === "chatgpt"
                    ? localProviderKey("chatgpt")
                    : config.provider === "custom" &&
                        provider?.openAICompatible?.authMode &&
                        provider.openAICompatible.authMode !== "bearer"
                      ? ""
                      : provider?.apiKey?.trim() || localProviderKey(config.provider),
            baseUrl: provider?.baseUrl?.trim() || undefined,
            openAICompatible: provider?.openAICompatible,
            systemPrompt: settings.chat.systemPrompt,
            advancedSystemPrompt: settings.chat.advancedSystemPrompt,
            temperature: settings.chat.temperature,
            maxTokens: settings.chat.maxTokens,
            topP: settings.chat.topP,
            imageSize: settings.chat.imageSize,
            imageCount: settings.chat.imageCount,
            toolSettings: {
                webSearchEnabled: settings.webSearchEnabled,
                calculatorEnabled: settings.calculatorEnabled,
                pythonEnabled: settings.pythonEnabled,
                linuxEnvironment: settings.linuxEnvironment,
                webSearchEngine: settings.webSearchEngine,
                searxngUrl: settings.searxngUrl,
                skillsEnabled: settings.skillsEnabled,
                subagentsEnabled: settings.subagentsEnabled,
                connectors: settings.connectors,
                tokenMode: settings.tokenMode ?? "balanced",
                toolAccess: settings.toolAccess,
            },
            mcpServers: settings.mcpServers.filter((server) => server.enabled),
        };
    };

    const seedConfig = (): PreviewModelConfig => ({
        provider: settings.chat.provider,
        model: settings.chat.model,
        reasoningEffort: settings.chat.reasoningEffort,
    });

    useEffect(() => {
        if (settings.preview.primaryModels.length > 0) return;
        updateSettings({
            preview: {
                ...settings.preview,
                primaryModels: [seedConfig()],
            },
        });
        // Seed once when preview opens with no columns.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        let cancelled = false;
        void loadPreviewSession<StoredPreviewSession>(PREVIEW_SESSION_ID).then(
            (stored) => {
                if (cancelled || previewHydrated.current) return;
                const current = previewStateRef.current;
                if (
                    current.prompt.trim() ||
                    current.files.length > 0 ||
                    current.runs.length > 0
                ) {
                    previewHydrated.current = true;
                    return;
                }
                if (!stored) {
                    previewHydrated.current = true;
                    return;
                }
                setPrompt(stored.prompt);
                const primaries = stored.runs.filter((run) => run.kind === "primary");
                setRuns(
                    stored.runs.map((run) => ({
                        ...run,
                        slotIndex:
                            run.kind === "primary"
                                ? (run.slotIndex ?? primaries.indexOf(run))
                                : undefined,
                        startedAt: run.startedAt ?? Date.now(),
                        status: run.status === "running" ? "stopped" : run.status,
                        artifacts: run.artifacts ?? [],
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
                previewHydrated.current = true;
            },
        );
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!previewHydrated.current) return;
        if (!prompt.trim() && runs.length === 0 && !session) return;
        const timer = window.setTimeout(() => {
            void savePreviewSession(
                PREVIEW_SESSION_ID,
                serializePreviewSession(prompt, runs, session),
            );
        }, 300);
        return () => window.clearTimeout(timer);
    }, [prompt, runs, session]);

    // Navigation unmounts Preview. Persist the latest snapshot and mark active
    // runs stopped so re-entry never shows an orphaned stream as running.
    useEffect(() => {
        return () => {
            if (!previewHydrated.current) return;
            const current = previewStateRef.current;
            if (!current.prompt.trim() && current.runs.length === 0 && !current.session) {
                void deletePreviewSession(PREVIEW_SESSION_ID);
                return;
            }
            void savePreviewSession(
                PREVIEW_SESSION_ID,
                serializePreviewSession(
                    current.prompt,
                    current.runs,
                    current.session,
                    true,
                ),
            );
        };
    }, []);

    const primaryModels = settings.preview.primaryModels.slice(0, 3);

    const startRuns = () => {
        const input = prompt.trim();
        const selections = primaryModels;
        const unavailable = selections.find(
            (config) => !isProviderReady(settings, config.provider),
        );

        if (!input) {
            setConfigurationError("Enter a prompt to compare model responses.");
            return;
        }
        if (selections.length === 0) {
            setConfigurationError("Add at least one preview model.");
            return;
        }
        if (unavailable) {
            setConfigurationError(
                `Connect ${PROVIDER_DEFAULTS[unavailable.provider]?.name ?? unavailable.provider} before starting this preview.`,
            );
            return;
        }
        if (
            settings.preview.fusionModel &&
            !isProviderReady(settings, settings.preview.fusionModel.provider)
        ) {
            setConfigurationError(
                `Connect ${PROVIDER_DEFAULTS[settings.preview.fusionModel.provider]?.name ?? settings.preview.fusionModel.provider} before using the fusion model.`,
            );
            return;
        }

        previewHydrated.current = true;
        const id = `preview_${Date.now()}`;
        const now = Date.now();
        const primaryRuns = selections.map((config, index): PreviewRun => ({
            id: `${id}_model_${index + 1}`,
            kind: "primary",
            slotIndex: index,
            label: shortModelName(config.model),
            prompt: input,
            config: resolveConfig(config),
            status: "running",
            output: "",
            artifacts: [],
            files: files.filter((file) => fileSupportedForRun(file, config)),
            uploadNotice: files.some((file) => !fileSupportedForRun(file, config))
                ? "Some files were skipped because this model does not support their modality."
                : undefined,
            startedAt: now,
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
        setFusionOpen(true);
    };

    const addFiles = async (selected: FileList | null) => {
        if (!selected?.length) return;
        previewHydrated.current = true;
        const next = await Promise.all([...selected].map(fileToPreviewPart));
        setFiles((current) => [...current, ...next].slice(0, 8));
    };

    const markComplete = (runId: string, messages: UIMessage[]) => {
        setRuns((current) =>
            current.map((run) =>
                run.id === runId
                    ? {
                          ...run,
                          status: "complete",
                          output: responseText(messages),
                          messages,
                          finishedAt: Date.now(),
                      }
                    : run,
            ),
        );
    };

    const addPreviewArtifact = (runId: string, artifact: SyncedArtifact) => {
        setRuns((current) =>
            current.map((run) => {
                if (run.id !== runId) return run;
                const sourceKey =
                    artifact.sourceKey ??
                    `${artifact.kind}:${artifact.filename ?? artifact.title}:${artifact.contentEncoding ?? "text"}:${artifact.content}`;
                if (run.artifacts.some((item) => item.sourceKey === sourceKey)) {
                    return run;
                }
                const id =
                    typeof crypto !== "undefined" && "randomUUID" in crypto
                        ? `preview_artifact_${crypto.randomUUID()}`
                        : `preview_artifact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                return {
                    ...run,
                    artifacts: [
                        ...run.artifacts,
                        {
                            ...artifact,
                            id,
                            sourceKey,
                            scopeId: runId,
                            createdAt: Date.now(),
                        },
                    ],
                };
            }),
        );
    };

    const markError = (runId: string, error: Error) => {
        setRuns((current) =>
            current.map((run) =>
                run.id === runId
                    ? {
                          ...run,
                          status: "error",
                          error: error.message,
                          finishedAt: Date.now(),
                      }
                    : run,
            ),
        );
    };

    const markStopped = (runId: string) => {
        setRuns((current) =>
            current.map((run) =>
                run.id === runId && run.status === "running"
                    ? { ...run, status: "stopped", finishedAt: Date.now() }
                    : run,
            ),
        );
    };

    const stopRun = (runId: string) => {
        stopMap.current.get(runId)?.();
    };

    const stopAll = () => {
        for (const run of runs) {
            if (run.status === "running") stopRun(run.id);
        }
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
                    `### ${run.label}\n${run.output || `No completed output${run.error ? ` (${run.error})` : run.status === "stopped" ? " (stopped)" : ""}.`}`,
            ),
        ].join("\n");
        const fusionRun: PreviewRun = {
            id: `preview_fusion_${Date.now()}`,
            kind: "fusion",
            label: shortModelName(session.fusionConfig.model),
            prompt: fusionPrompt,
            config: session.fusionConfig,
            status: "running",
            output: "",
            artifacts: [],
            files: [],
            startedAt: Date.now(),
        };
        setSession((current) =>
            current ? { ...current, fusionStarted: true } : current,
        );
        setRuns((current) => [...current, fusionRun]);
        setFusionOpen(true);
    }, [runs, session]);

    const updatePrimaryConfig = (index: number, patch: Partial<PreviewModelConfig>) => {
        const current = primaryModels[index];
        if (!current) return;
        updateSettings({
            preview: {
                ...settings.preview,
                primaryModels: settings.preview.primaryModels.map((config, i) =>
                    i === index ? { ...config, ...patch } : config,
                ),
            },
        });
    };

    const updateFusionConfig = (patch: Partial<PreviewModelConfig>) => {
        if (!settings.preview.fusionModel) return;
        updateSettings({
            preview: {
                ...settings.preview,
                fusionModel: { ...settings.preview.fusionModel, ...patch },
            },
        });
    };

    const addDraftModel = () => {
        if (settings.preview.primaryModels.length >= 3) return;
        updateSettings({
            preview: {
                ...settings.preview,
                primaryModels: [...settings.preview.primaryModels, seedConfig()],
            },
        });
    };

    const addFusionModel = () => {
        if (settings.preview.fusionModel) return;
        updateSettings({
            preview: {
                ...settings.preview,
                fusionModel: seedConfig(),
            },
        });
        setFusionOpen(true);
    };

    const closePrimarySlot = (index: number) => {
        const removedRun = runs.find(
            (run) => run.kind === "primary" && run.slotIndex === index,
        );
        if (removedRun?.status === "running") stopRun(removedRun.id);
        const primaryModelsNext = settings.preview.primaryModels.filter(
            (_, i) => i !== index,
        );
        if (primaryModelsNext.length === 0 && !settings.preview.fusionModel) {
            updateSettings({
                preview: { ...settings.preview, primaryModels: [seedConfig()] },
            });
            setRuns((current) => current.filter((run) => run.kind !== "primary"));
            return;
        }
        updateSettings({
            preview: { ...settings.preview, primaryModels: primaryModelsNext },
        });
        setRuns((current) =>
            current
                .filter(
                    (run) =>
                        !(run.kind === "primary" && run.slotIndex === index) &&
                        run.kind !== "fusion",
                )
                .map((run) =>
                    run.kind === "primary" && (run.slotIndex ?? 0) > index
                        ? { ...run, slotIndex: (run.slotIndex ?? 0) - 1 }
                        : run,
                ),
        );
        if (session && !session.fusionStarted) {
            setSession({
                ...session,
                primaryCount: Math.max(0, session.primaryCount - 1),
            });
        }
        setFocusedColumn((current) => Math.max(0, Math.min(current, primaryModelsNext.length - 1)));
    };

    const closeFusion = () => {
        const fusion = runs.find((run) => run.kind === "fusion");
        if (fusion?.status === "running") stopRun(fusion.id);
        updateSettings({
            preview: { ...settings.preview, fusionModel: null },
        });
        setRuns((current) => current.filter((run) => run.kind !== "fusion"));
        setSession((current) =>
            current ? { ...current, fusionConfig: null, fusionStarted: false } : current,
        );
    };

    const retrySlot = (index: number) => {
        const config = primaryModels[index];
        const input = session?.prompt || prompt.trim();
        if (!config || !input) return;
        if (!isProviderReady(settings, config.provider)) {
            setConfigurationError(
                `Connect ${PROVIDER_DEFAULTS[config.provider]?.name ?? config.provider} before retrying.`,
            );
            return;
        }
        const existing = runs.find(
            (run) => run.kind === "primary" && run.slotIndex === index,
        );
        if (existing?.status === "running") stopRun(existing.id);
        const next: PreviewRun = {
            id: `preview_${Date.now()}_model_${index + 1}`,
            kind: "primary",
            slotIndex: index,
            label: shortModelName(config.model),
            prompt: input,
            config: resolveConfig(config),
            status: "running",
            output: "",
            artifacts: [],
            files: files.filter((file) => fileSupportedForRun(file, config)),
            startedAt: Date.now(),
        };
        setRuns((current) => [
            ...current.filter(
                (run) =>
                    !(run.kind === "primary" && run.slotIndex === index) &&
                    run.kind !== "fusion",
            ),
            next,
        ]);
        setSession((current) =>
            current
                ? {
                      ...current,
                      fusionStarted: false,
                      fusionConfig: settings.preview.fusionModel
                          ? resolveConfig(settings.preview.fusionModel)
                          : current.fusionConfig,
                  }
                : current,
        );
        setConfigurationError(null);
    };

    const copyOutput = async (run: PreviewRun) => {
        const text = run.output.trim();
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(run.id);
            window.setTimeout(() => setCopiedId((id) => (id === run.id ? null : id)), 1400);
        } catch {
            /* clipboard can be unavailable */
        }
    };

    const resetPreview = () => {
        previewHydrated.current = true;
        for (const run of runs) {
            if (run.status === "running") stopRun(run.id);
        }
        setPrompt("");
        setFiles([]);
        setRuns([]);
        setSession(null);
        setFocusedColumn(0);
        void deletePreviewSession(PREVIEW_SESSION_ID);
    };

    const scrollToColumn = (index: number) => {
        setFocusedColumn(index);
        columnRefs.current[index]?.scrollIntoView({
            inline: "center",
            block: "nearest",
            behavior: "smooth",
        });
    };

    const running = runs.some((run) => run.status === "running");
    const fusionRun = runs.find((run) => run.kind === "fusion") ?? null;
    const columnCount = Math.max(1, primaryModels.length);

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex min-h-10 shrink-0 items-center gap-1 overflow-x-auto border-b border-border/70 bg-background px-3 py-1.5">
                <div className="flex min-w-0 flex-1 items-center gap-1 md:hidden">
                    {primaryModels.map((config, index) => {
                        const run = runs.find(
                            (candidate) =>
                                candidate.kind === "primary" &&
                                candidate.slotIndex === index,
                        );
                        return (
                            <button
                                key={`${config.provider}:${index}`}
                                type="button"
                                onClick={() => scrollToColumn(index)}
                                className={cn(
                                    "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium",
                                    focusedColumn === index
                                        ? "border-border bg-accent text-foreground"
                                        : "border-transparent text-muted-foreground hover:bg-accent/60",
                                )}
                            >
                                <StatusDot status={run?.status} />
                                <ModelLogo
                                    provider={config.provider}
                                    modelId={config.model}
                                    size={12}
                                />
                                <span className="max-w-24 truncate">
                                    {shortModelName(config.model)}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <span className="hidden flex-1 text-[11px] text-muted-foreground md:inline">
                    {columnCount} model{columnCount === 1 ? "" : "s"}
                    {settings.preview.fusionModel ? " · fusion" : ""}
                </span>
                {primaryModels.length < 3 ? (
                    <button
                        type="button"
                        onClick={addDraftModel}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground"
                    >
                        <Plus size={13} />
                        Model
                    </button>
                ) : null}
                {runs.length > 0 ? (
                    <button
                        type="button"
                        onClick={resetPreview}
                        className="shrink-0 rounded-lg px-2 py-1.5 text-[11px] font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground"
                    >
                        New compare
                    </button>
                ) : null}
            </div>

            <div className="relative flex min-h-0 flex-1 flex-col">
                {session?.prompt ? (
                    <div className="flex shrink-0 justify-center px-4 pt-3">
                        <p className="max-w-xl truncate rounded-full border border-border/70 bg-muted/40 px-3.5 py-1.5 text-xs text-foreground/90">
                            {session.prompt}
                        </p>
                    </div>
                ) : null}
                <div
                    className={cn(
                        "flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto md:grid md:snap-none md:overflow-hidden",
                        session?.prompt && "pt-2",
                        columnCount === 1 && "md:grid-cols-1",
                        columnCount === 2 && "md:grid-cols-2",
                        columnCount >= 3 && "md:grid-cols-2 xl:grid-cols-3",
                    )}
                >
                    {primaryModels.map((config, index) => {
                        const run = runs.find(
                            (candidate) =>
                                candidate.kind === "primary" &&
                                candidate.slotIndex === index,
                        );
                        return (
                            <PreviewColumn
                                key={`column-${index}`}
                                columnRef={(node) => {
                                    columnRefs.current[index] = node;
                                }}
                                config={config}
                                run={run ?? null}
                                removable={primaryModels.length > 1}
                                copied={copiedId === run?.id}
                                onConfigChange={(patch) => updatePrimaryConfig(index, patch)}
                                onClose={() => closePrimarySlot(index)}
                                onCopy={() => run && void copyOutput(run)}
                                onRetry={() => retrySlot(index)}
                                onStop={() => run && stopRun(run.id)}
                                onComplete={markComplete}
                                onError={markError}
                                onStopped={markStopped}
                                onArtifact={addPreviewArtifact}
                                stopMap={stopMap}
                            />
                        );
                    })}
                </div>

                <FusionStrip
                    fusionModel={settings.preview.fusionModel}
                    run={fusionRun}
                    open={fusionOpen}
                    copied={copiedId === fusionRun?.id}
                    onToggle={() => setFusionOpen((value) => !value)}
                    onAdd={addFusionModel}
                    onClose={closeFusion}
                    onConfigChange={updateFusionConfig}
                    onCopy={() => fusionRun && void copyOutput(fusionRun)}
                    onStop={() => fusionRun && stopRun(fusionRun.id)}
                    onComplete={markComplete}
                    onError={markError}
                    onStopped={markStopped}
                    onArtifact={addPreviewArtifact}
                    stopMap={stopMap}
                />

                <PreviewComposer
                    prompt={prompt}
                    onPromptChange={(value) => {
                        previewHydrated.current = true;
                        setPrompt(value);
                    }}
                    onSubmit={startRuns}
                    onStop={stopAll}
                    running={running}
                    configurationError={configurationError}
                    files={files}
                    onFiles={addFiles}
                    onRemoveFile={(filename) => {
                        previewHydrated.current = true;
                        setFiles((current) =>
                            current.filter((file) => file.filename !== filename),
                        );
                    }}
                />
            </div>
        </div>
    );
};

function StatusDot({ status }: { status?: RunStatus }) {
    return (
        <span
            className={cn(
                "size-1.5 shrink-0 rounded-full",
                status === "running" && "animate-pulse bg-primary",
                status === "complete" && "bg-emerald-500",
                status === "error" && "bg-destructive",
                status === "stopped" && "bg-muted-foreground",
                !status && "bg-border",
            )}
        />
    );
}

const PreviewColumn: FC<{
    columnRef: (node: HTMLElement | null) => void;
    config: PreviewModelConfig;
    run: PreviewRun | null;
    removable: boolean;
    copied: boolean;
    onConfigChange: (patch: Partial<PreviewModelConfig>) => void;
    onClose: () => void;
    onCopy: () => void;
    onRetry: () => void;
    onStop: () => void;
    onComplete: (runId: string, messages: UIMessage[]) => void;
    onError: (runId: string, error: Error) => void;
    onStopped: (runId: string) => void;
    onArtifact: (runId: string, artifact: SyncedArtifact) => void;
    stopMap: MutableRefObject<Map<string, () => void>>;
}> = ({
    columnRef,
    config,
    run,
    removable,
    copied,
    onConfigChange,
    onClose,
    onCopy,
    onRetry,
    onStop,
    onComplete,
    onError,
    onStopped,
    onArtifact,
    stopMap,
}) => {
    return (
        <section
            ref={columnRef}
            className="flex h-full min-h-0 w-[85vw] max-w-md shrink-0 snap-center flex-col border-r border-border/70 last:border-r-0 md:w-auto md:max-w-none md:min-w-0"
        >
            <ColumnHeader
                config={config}
                run={run}
                removable={removable}
                copied={copied}
                onConfigChange={onConfigChange}
                onClose={onClose}
                onCopy={onCopy}
                onRetry={onRetry}
                onStop={onStop}
            />
            <div className="min-h-0 flex-1 overflow-hidden">
                {run ? (
                    <PreviewRunPanel
                        key={run.id}
                        run={run}
                        onComplete={onComplete}
                        onError={onError}
                        onStopped={onStopped}
                        onArtifact={onArtifact}
                        stopMap={stopMap}
                    />
                ) : (
                    <div className="flex h-full items-center justify-center p-6 text-center">
                        <p className="max-w-[16rem] text-xs leading-relaxed text-muted-foreground">
                            Ready. Send a prompt to stream this model beside the others.
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
};

const ColumnHeader: FC<{
    config: PreviewModelConfig;
    run: PreviewRun | null;
    removable: boolean;
    copied: boolean;
    fusion?: boolean;
    onConfigChange: (patch: Partial<PreviewModelConfig>) => void;
    onClose: () => void;
    onCopy: () => void;
    onRetry?: () => void;
    onStop: () => void;
}> = ({
    config,
    run,
    removable,
    copied,
    fusion,
    onConfigChange,
    onClose,
    onCopy,
    onRetry,
    onStop,
}) => {
    const { settings } = useSettings();
    const providerReady = isProviderReady(settings, config.provider);
    const reasoningOptions = getReasoningEffortOptions(config.provider, config.model);
    const duration =
        run?.finishedAt != null ? formatDuration(run.finishedAt - run.startedAt) : null;
    const comparing = run?.status === "running";

    return (
        <div className="flex shrink-0 flex-col gap-1.5 border-b border-border/60 bg-background/80 px-2.5 py-2">
            <div className="flex min-w-0 items-center gap-1.5">
                {fusion ? (
                    <Sparkle size={14} className="shrink-0 text-primary" />
                ) : (
                    <ModelLogo
                        provider={config.provider}
                        modelId={config.model}
                        size={14}
                    />
                )}
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
                    {fusion ? "Fusion · " : ""}
                    {shortModelName(config.model)}
                </span>
                {comparing ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <SpinnerGap size={12} className="animate-spin" />
                        Streaming
                    </span>
                ) : run?.status === "error" ? (
                    <span className="text-[11px] text-destructive">Error</span>
                ) : run?.status === "stopped" ? (
                    <span className="text-[11px] text-muted-foreground">Stopped</span>
                ) : duration ? (
                    <span className="font-mono text-[11px] text-muted-foreground">
                        {duration}
                    </span>
                ) : null}
                {run?.status === "running" ? (
                    <IconButton label="Stop this model" onClick={onStop}>
                        <Stop size={12} weight="fill" />
                    </IconButton>
                ) : null}
                {run && run.status !== "running" ? (
                    <>
                        <IconButton
                            label={copied ? "Copied" : "Copy output"}
                            onClick={onCopy}
                            disabled={!run.output}
                        >
                            <CopySimple size={12} />
                        </IconButton>
                        {onRetry ? (
                            <IconButton label="Retry this model" onClick={onRetry}>
                                <ArrowClockwise size={12} />
                            </IconButton>
                        ) : null}
                    </>
                ) : null}
                {removable ? (
                    <IconButton label={fusion ? "Remove fusion" : "Remove model"} onClick={onClose}>
                        <X size={12} />
                    </IconButton>
                ) : null}
            </div>
            {comparing ? null : (
                <div className="flex min-w-0 flex-wrap items-center gap-1">
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
                        className="max-w-[8.5rem]"
                    />
                    {providerReady ? (
                        <ModelPicker
                            provider={config.provider}
                            value={config.model}
                            onChange={(model) => onConfigChange({ model })}
                            enabled
                            compact
                            className="max-w-[11rem]"
                        />
                    ) : (
                        <span className="text-[10px] text-destructive">Connect provider</span>
                    )}
                    {reasoningOptions.length > 0 ? (
                        <select
                            value={
                                reasoningOptions.some((option) => option.id === config.reasoningEffort)
                                    ? config.reasoningEffort
                                    : reasoningOptions[0].id
                            }
                            onChange={(event) =>
                                onConfigChange({
                                    reasoningEffort: event.target.value as PreviewModelConfig["reasoningEffort"],
                                })
                            }
                            className="h-7 max-w-32 rounded-lg border border-border/70 bg-transparent px-2 text-[11px] font-medium outline-none"
                            aria-label="Reasoning effort"
                        >
                            {reasoningOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    ) : null}
                </div>
            )}
        </div>
    );
};

function IconButton({
    label,
    onClick,
    disabled,
    children,
}: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={onClick}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
        >
            {children}
        </button>
    );
}

const FusionStrip: FC<{
    fusionModel: PreviewModelConfig | null;
    run: PreviewRun | null;
    open: boolean;
    copied: boolean;
    onToggle: () => void;
    onAdd: () => void;
    onClose: () => void;
    onConfigChange: (patch: Partial<PreviewModelConfig>) => void;
    onCopy: () => void;
    onStop: () => void;
    onComplete: (runId: string, messages: UIMessage[]) => void;
    onError: (runId: string, error: Error) => void;
    onStopped: (runId: string) => void;
    onArtifact: (runId: string, artifact: SyncedArtifact) => void;
    stopMap: MutableRefObject<Map<string, () => void>>;
}> = ({
    fusionModel,
    run,
    open,
    copied,
    onToggle,
    onAdd,
    onClose,
    onConfigChange,
    onCopy,
    onStop,
    onComplete,
    onError,
    onStopped,
    onArtifact,
    stopMap,
}) => {
    if (!fusionModel) {
        return (
            <div className="shrink-0 border-t border-border/70 bg-background px-3 py-1.5">
                <button
                    type="button"
                    onClick={onAdd}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground"
                >
                    <Sparkle size={13} />
                    Add fusion
                </button>
            </div>
        );
    }

    return (
        <div
            className={cn(
                "flex shrink-0 flex-col border-t border-border/70 bg-background",
                open && "h-[min(42vh,22rem)] min-h-0",
            )}
        >
            <div className="flex items-center gap-1 px-2">
                <button
                    type="button"
                    onClick={onToggle}
                    className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground"
                    aria-expanded={open}
                    aria-label={open ? "Collapse fusion" : "Expand fusion"}
                >
                    <CaretDown
                        size={14}
                        className={cn("transition-transform", !open && "-rotate-90")}
                    />
                </button>
                <div className="min-w-0 flex-1">
                    <ColumnHeader
                        config={fusionModel}
                        run={run}
                        removable
                        copied={copied}
                        fusion
                        onConfigChange={onConfigChange}
                        onClose={onClose}
                        onCopy={onCopy}
                        onStop={onStop}
                    />
                </div>
            </div>
            {open ? (
                <div className="min-h-0 flex-1 overflow-hidden border-t border-border/50">
                    {run ? (
                        <PreviewRunPanel
                            key={run.id}
                            run={run}
                            onComplete={onComplete}
                            onError={onError}
                            onStopped={onStopped}
                            onArtifact={onArtifact}
                            stopMap={stopMap}
                        />
                    ) : (
                        <p className="px-4 py-3 text-xs text-muted-foreground">
                            Fusion synthesizes a single answer after every comparison model finishes.
                        </p>
                    )}
                </div>
            ) : null}
        </div>
    );
};

const PreviewComposer: FC<{
    prompt: string;
    onPromptChange: (value: string) => void;
    onSubmit: () => void;
    onStop: () => void;
    running: boolean;
    configurationError: string | null;
    files: PreviewFile[];
    onFiles: (files: FileList | null) => void;
    onRemoveFile: (filename: string) => void;
}> = ({
    prompt,
    onPromptChange,
    onSubmit,
    onStop,
    running,
    configurationError,
    files,
    onFiles,
    onRemoveFile,
}) => {
    return (
        <div className="relative z-10 w-full shrink-0 bg-background px-4 pb-4 pt-2">
            <div className="mx-auto w-full max-w-(--thread-max-width) rounded-[1.25rem] border border-border bg-muted/35 p-2.5 shadow-sm">
                <textarea
                    value={prompt}
                    onChange={(event) => onPromptChange(event.target.value)}
                    onKeyDown={(event) => {
                        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                            event.preventDefault();
                            if (running) onStop();
                            else onSubmit();
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
                    <span className="flex-1" />
                    {running ? (
                        <button
                            type="button"
                            onClick={onStop}
                            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-destructive px-3 text-xs font-semibold text-destructive-foreground outline-none transition-colors hover:bg-destructive/90"
                        >
                            <Stop size={13} weight="fill" />
                            Stop
                        </button>
                    ) : (
                        <button
                            type="button"
                            disabled={!prompt.trim()}
                            onClick={onSubmit}
                            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Play size={13} weight="fill" />
                            Compare
                        </button>
                    )}
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
    onComplete: (runId: string, messages: UIMessage[]) => void;
    onError: (runId: string, error: Error) => void;
    onStopped: (runId: string) => void;
    onArtifact: (runId: string, artifact: SyncedArtifact) => void;
    stopMap: MutableRefObject<Map<string, () => void>>;
}> = ({ run, onComplete, onError, onStopped, onArtifact, stopMap }) => {
    const callbacksRef = useRef({ onComplete, onError, onStopped });
    callbacksRef.current = { onComplete, onError, onStopped };
    const sentRef = useRef(false);
    const stoppedRef = useRef(false);
    const { settings } = useSettings();
    const settingsRef = useRef(settings);
    settingsRef.current = settings;
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
                    let payload: Record<string, unknown> | null = null;
                    if (init && typeof init.body === "string") {
                        try {
                            payload = JSON.parse(init.body) as Record<string, unknown>;
                        } catch {
                            payload = null;
                        }
                    }
                    const response = await globalThis.fetch(input, {
                        ...init,
                        credentials: "include",
                    });
                    if (response.ok) return response;
                    const raw = await response.text();
                    if (
                        detectProviderCreditError(raw, response.status) &&
                        payload
                    ) {
                        const fallback = findCreditsFallbackTarget(
                            settingsRef.current,
                            run.config.provider as ProviderId,
                        );
                        if (fallback) {
                            try {
                                const rerun = await globalThis.fetch(input, {
                                    ...init,
                                    credentials: "include",
                                    body: JSON.stringify(
                                        applyCreditsFallback(payload, fallback),
                                    ),
                                });
                                if (rerun.ok) {
                                    notifyCreditsFallback(
                                        run.config.provider,
                                        fallback.provider,
                                    );
                                    return rerun;
                                }
                                throw new Error(
                                    await parseChatError(
                                        rerun,
                                        "Preview run failed",
                                    ),
                                );
                            } catch (err) {
                                console.error("[credits-fallback]", err);
                            }
                        }
                    }
                    throw new Error(
                        await parseChatError(
                            new Response(raw, { status: response.status }),
                            "Preview run failed",
                        ),
                    );
                },
                prepareSendMessagesRequest: async (options) => {
                    await assertClientUsageAllowed(
                        settingsRef.current,
                        run.config.provider as ProviderId,
                        run.config.apiKey,
                    );
                    return {
                        body: {
                            ...options.body,
                            messages: options.messages,
                            chatId: run.id,
                            model: run.config.model,
                            provider: run.config.provider as ProviderId,
                            apiKey:
                                run.config.provider === "chatgpt"
                                    ? ""
                                    : run.config.apiKey,
                            baseUrl: run.config.baseUrl,
                            openAICompatible: run.config.openAICompatible,
                            systemPrompt: run.config.systemPrompt,
                            advancedSystemPrompt: run.config.advancedSystemPrompt,
                            temperature: run.config.temperature,
                            maxTokens: run.config.maxTokens,
                            topP: run.config.topP,
                            reasoningEffort: run.config.reasoningEffort as ReasoningEffort,
                            imageSettings: {
                                size: run.config.imageSize,
                                count: run.config.imageCount,
                            },
                            mcpServers: [],
                            memoryContext: "",
                            toolSettings: {
                                ...run.config.toolSettings,
                                webSearchEnabled: true,
                                calculatorEnabled: false,
                                pythonEnabled: true,
                                linuxEnvironment: false,
                                skillsEnabled: false,
                                subagentsEnabled: false,
                                connectors: [],
                                memoryAvailable: false,
                                knowledgeEnabled: false,
                            },
                            previewMode: true,
                        },
                    };
                },
            }),
        [run.config],
    );
    const chatRef = useRef<ReturnType<typeof useChat> | null>(null);
    const pendingClientCalls = useRef(0);
    const chat = useChat({
        id: run.id,
        transport,
        messages: run.messages,
        onToolCall: ({ toolCall }) => {
            if (toolCall.toolName !== "run_python" && toolCall.toolName !== "run_code") return;
            if (!toolAccessAllows(run.config.toolSettings.toolAccess, toolCall.toolName)) {
                pendingClientCalls.current += 1;
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
                    output: `Tool access is disabled in Settings: ${toolCall.toolName}. Continue without it.`,
                });
                return;
            }
            pendingClientCalls.current += 1;
            const input = toolCall.input as {
                code?: string;
            };
            const task = runBrowserPython(
                input.code ?? "",
                collectPythonInputFiles(
                    ((chatRef.current as unknown as { messages?: unknown[] } | null)
                        ?.messages ?? []),
                ),
            );
            void task.then(
                (result) => {
                    const output =
                        typeof result === "string" ? result : result.output;
                    const pythonResult =
                        typeof result === "string" ? null : result;
                    if (pythonResult) {
                        const sourcePrefix = "python";
                        for (const artifact of pythonResult.artifacts) {
                            onArtifact(run.id, {
                                kind: /\.html?$/i.test(artifact.filename)
                                    ? "html"
                                    : "file",
                                title: artifact.filename,
                                filename: artifact.filename,
                                content: artifact.content,
                                contentEncoding: artifact.contentEncoding,
                                mimeType: inferArtifactMimeType(artifact.filename),
                                sourceKey: `${sourcePrefix}:${artifact.filename}:${artifact.contentEncoding}:${artifact.content.length}:${artifactContentHash(artifact.content)}`,
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
            if (stoppedRef.current) return;
            if (!isError) callbacksRef.current.onComplete(run.id, messages);
        },
        onError: (error) => {
            if (stoppedRef.current) return;
            callbacksRef.current.onError(run.id, error);
            if (run.config.provider === "chatgpt") {
                notifyChatGPTRequestFailure();
            }
        },
    });
    chatRef.current = chat;

    useEffect(() => {
        const stop = () => {
            stoppedRef.current = true;
            void chatRef.current?.stop();
            callbacksRef.current.onStopped(run.id);
        };
        stopMap.current.set(run.id, stop);
        return () => {
            stopMap.current.delete(run.id);
            if (!stoppedRef.current) {
                stoppedRef.current = true;
                void chatRef.current?.stop();
            }
        };
    }, [run.id, stopMap]);

    const runtime = useAISDKRuntime(chat, { adapters });

    useEffect(() => {
        transport.setRuntime(runtime);
    }, [transport, runtime]);

    useLayoutEffect(() => {
        if (run.status !== "running" || sentRef.current || run.messages?.length) return;
        sentRef.current = true;
        void chat.sendMessage({ text: run.prompt, files: run.files });
    }, [chat, run.files, run.messages?.length, run.prompt]);

    return (
        <div className="relative flex h-full min-h-0 flex-col">
            <ChatSessionProvider value={chat}>
                <AuiRuntimeProvider runtime={runtime}>
                    <ChatThreadSync
                        threadId={null}
                        artifactScopeId={run.id}
                        manageArtifactScope={false}
                        openArtifacts={false}
                        onArtifact={(artifact) => onArtifact(run.id, artifact)}
                    />
                    {run.error ? (
                        <div className="mx-4 mt-3 shrink-0 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                            {run.error}
                        </div>
                    ) : run.uploadNotice ? (
                        <div className="mx-4 mt-3 shrink-0 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                            {run.uploadNotice}
                        </div>
                    ) : null}
                    <div className="min-h-0 flex-1">
                        <Thread
                            hideComposer
                            compact
                            components={{ Welcome: PreviewStreamingWelcome }}
                        />
                    </div>
                </AuiRuntimeProvider>
            </ChatSessionProvider>
            {run.artifacts.length > 0 ? <PreviewArtifactTray artifacts={run.artifacts} /> : null}
        </div>
    );
};

function PreviewStreamingWelcome() {
    return (
        <div className="flex justify-start">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
                <SpinnerGap size={14} className="animate-spin" />
                Streaming
            </span>
        </div>
    );
};

function isPreviewHtmlArtifact(artifact: Artifact): boolean {
    return (
        artifact.kind === "html" ||
        Boolean(artifact.mimeType && /text\/html/i.test(artifact.mimeType)) ||
        Boolean(artifact.filename?.match(/\.html?$/i))
    );
}

function isPreviewImageArtifact(artifact: Artifact): boolean {
    return (
        isImageMimeType(artifact.mimeType) ||
        Boolean(artifact.filename?.match(/\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i))
    );
}

function PreviewArtifactContent({ artifact }: { artifact: Artifact }) {
    const binary = useMemo(
        () => decodeArtifactContent(artifact.content, artifact.contentEncoding),
        [artifact.content, artifact.contentEncoding],
    );
    const imageUrl = useMemo(() => {
        if (!isPreviewImageArtifact(artifact)) return null;
        if (artifact.contentEncoding && binary) {
            return URL.createObjectURL(
                new Blob([binary], { type: artifact.mimeType || "image/png" }),
            );
        }
        if (/^data:image\//i.test(artifact.content.trim())) return artifact.content.trim();
        if (artifact.filename?.toLowerCase().endsWith(".svg")) {
            return URL.createObjectURL(new Blob([artifact.content], { type: "image/svg+xml" }));
        }
        return null;
    }, [artifact, binary]);
    useEffect(() => {
        return () => {
            if (imageUrl?.startsWith("blob:")) URL.revokeObjectURL(imageUrl);
        };
    }, [imageUrl]);

    if (isPreviewHtmlArtifact(artifact)) {
        const htmlSource = artifact.contentEncoding
            ? binary
                ? new TextDecoder().decode(binary)
                : null
            : artifact.content;
        return htmlSource ? (
            <iframe
                srcDoc={preparePreviewDocument(htmlSource)}
                title={artifact.title}
                className="h-72 w-full rounded-lg border border-border bg-white"
                sandbox="allow-scripts allow-modals allow-popups allow-popups-to-escape-sandbox"
                referrerPolicy="no-referrer"
            />
        ) : (
            <ArtifactError />
        );
    }

    if (isPreviewImageArtifact(artifact)) {
        return imageUrl ? (
            <div className="flex max-h-72 items-center justify-center overflow-auto rounded-lg border border-border bg-white p-3">
                <img src={imageUrl} alt={artifact.title} className="max-h-64 max-w-full object-contain" />
            </div>
        ) : (
            <ArtifactError />
        );
    }

    if (artifact.contentEncoding && !binary) return <ArtifactError />;

    return (
        <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-background p-3 font-mono text-[11px] leading-relaxed text-foreground">
            <code>{artifact.content}</code>
        </pre>
    );
}

function ArtifactError() {
    return (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            This artifact payload is invalid. Regenerate the file with exact text or valid Base64/hex bytes.
        </p>
    );
}

function PreviewArtifactTray({ artifacts }: { artifacts: Artifact[] }) {
    const [open, setOpen] = useState(false);
    const [activeId, setActiveId] = useState(artifacts[0]?.id ?? null);
    const active = artifacts.find((artifact) => artifact.id === activeId) ?? artifacts[0];

    useEffect(() => {
        if (!artifacts.some((artifact) => artifact.id === activeId)) {
            setActiveId(artifacts[0]?.id ?? null);
        }
    }, [activeId, artifacts]);

    const download = () => {
        if (!active) return;
        const binary = decodeArtifactContent(active.content, active.contentEncoding);
        if (active.contentEncoding && !binary) return;
        const blob = new Blob([binary ?? active.content], {
            type: active.mimeType || "text/plain;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = active.filename || active.title || "artifact.txt";
        anchor.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="absolute bottom-3 right-3 z-30">
            {open && active ? (
                <div
                    className="mb-2 w-[min(25rem,calc(100vw-2rem))] max-w-[calc(100%-0.5rem)] overflow-hidden rounded-2xl border border-border bg-card/95 p-2 shadow-2xl backdrop-blur-xl"
                    role="dialog"
                    aria-label="Preview artifacts"
                >
                    <div className="flex items-center gap-2 px-2 py-1.5">
                        <FileText size={14} className="text-primary" />
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold">{active.title}</span>
                        <button
                            type="button"
                            onClick={download}
                            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                            aria-label="Download artifact"
                            title="Download artifact"
                        >
                            <DownloadSimple size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                            aria-label="Close artifact popup"
                        >
                            <X size={14} />
                        </button>
                    </div>
                    {artifacts.length > 1 ? (
                        <div className="flex gap-1 overflow-x-auto border-y border-border/70 px-1 py-1">
                            {artifacts.map((artifact) => (
                                <button
                                    key={artifact.id}
                                    type="button"
                                    onClick={() => setActiveId(artifact.id)}
                                    className={cn(
                                        "max-w-36 shrink-0 truncate rounded-md px-2 py-1 text-[10px]",
                                        artifact.id === active.id
                                            ? "bg-accent text-foreground"
                                            : "text-muted-foreground hover:bg-accent/60",
                                    )}
                                >
                                    {artifact.filename || artifact.title}
                                </button>
                            ))}
                        </div>
                    ) : null}
                    <div className="mt-2">
                        <PreviewArtifactContent artifact={active} />
                    </div>
                </div>
            ) : null}
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border bg-card/95 px-3 text-[11px] font-semibold text-foreground shadow-lg backdrop-blur transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                aria-expanded={open}
                aria-label={`${open ? "Close" : "Open"} ${artifacts.length} preview artifact${artifacts.length === 1 ? "" : "s"}`}
            >
                <FileText size={13} />
                <span>Artifacts</span>
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                    {artifacts.length}
                </span>
            </button>
        </div>
    );
}
