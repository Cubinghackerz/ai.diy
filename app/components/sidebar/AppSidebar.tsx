/**
 * AppSidebar — chats list + inline settings (BYOK live key test, models, tools, theme).
 * Settings live in the sidebar (no modal) — TypingMind-style operate surface.
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { ModelPicker } from "~/components/ui/ModelPicker";
import { ProviderPicker } from "~/components/ui/ProviderPicker";
import { haptic, hapticConfirm, hapticSelect } from "~/lib/haptics";
import { testProviderKey } from "~/lib/key-test";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { isLocalProvider, isProviderReady } from "~/lib/setup";
import {
    DEFAULT_MODELS,
    PROVIDER_DEFAULTS,
    type McpServerConfig,
    type PreviewModelConfig,
    type ProviderId,
} from "~/lib/types";
import { resolveModel } from "~/lib/model-capabilities";
import { getReasoningEffortOptions } from "~/lib/reasoning";
import { cn } from "~/lib/utils";
import { localProviderKey } from "~/lib/provider-credentials";
import {
    ChatCircleDots,
    CheckCircle,
    Desktop,
    Flask,
    GearSix,
    Globe,
    HardDrives,
    Key,
    Moon,
    Plus,
    Plug,
    SpinnerGap,
    Sun,
    Trash,
    WarningCircle,
    XCircle,
} from "@phosphor-icons/react";
import * as Switch from "@radix-ui/react-switch";

type SidebarPanel = "chats" | "settings";
type SettingsSection = "keys" | "tools" | "mcp" | "experimental" | "appearance";

type ThreadItem = { id: string; title: string };

export function AppSidebar({
    threads,
    activeThreadId,
    onSelectThread,
    onNewChat,
    onDeleteThread,
    panel,
    onPanelChange,
}: {
    threads: ThreadItem[];
    activeThreadId: string | null;
    onSelectThread: (id: string) => void;
    onNewChat: () => void;
    onDeleteThread: (id: string) => void;
    panel: SidebarPanel;
    onPanelChange: (panel: SidebarPanel) => void;
}) {
    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
                <div className="flex items-center gap-2 min-w-0">
                    <img
                        src="/ai-diy.png"
                        alt=""
                        className="size-7 shrink-0 rounded-lg object-cover"
                    />
                    <span className="truncate text-sm font-semibold tracking-tight">ai.diy</span>
                    <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-primary">
                        Beta
                    </span>
                </div>
            </div>

            <div className="mx-3 mb-2 grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1">
                <button
                    type="button"
                    onClick={() => {
                        hapticSelect();
                        onPanelChange("chats");
                    }}
                    className={cn(
                        "flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors outline-none focus-visible:bg-background/80",
                        panel === "chats"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                    )}
                >
                    <ChatCircleDots size={14} />
                    Chats
                </button>
                <button
                    type="button"
                    onClick={() => {
                        hapticSelect();
                        onPanelChange("settings");
                    }}
                    className={cn(
                        "flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors outline-none focus-visible:bg-background/80",
                        panel === "settings"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                    )}
                >
                    <GearSix size={14} />
                    Settings
                </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3">
                {panel === "chats" ? (
                    <ChatsPanel
                        threads={threads}
                        activeThreadId={activeThreadId}
                        onSelectThread={onSelectThread}
                        onNewChat={onNewChat}
                        onDeleteThread={onDeleteThread}
                    />
                ) : (
                    <SettingsPanel />
                )}
            </div>
        </div>
    );
}

function ChatsPanel({
    threads,
    activeThreadId,
    onSelectThread,
    onNewChat,
    onDeleteThread,
}: {
    threads: ThreadItem[];
    activeThreadId: string | null;
    onSelectThread: (id: string) => void;
    onNewChat: () => void;
    onDeleteThread: (id: string) => void;
}) {
    return (
        <div className="flex flex-col gap-3">
            <Button
                type="button"
                variant="outline"
                onClick={() => {
                    haptic();
                    onNewChat();
                }}
                className="h-9 w-full justify-center gap-2 rounded-xl text-xs font-medium outline-none focus-visible:ring-0 focus-visible:border-border"
            >
                <Plus size={15} weight="bold" data-icon="inline-start" />
                New Thread
            </Button>

            <div className="flex flex-col gap-1">
                <div className="px-1 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Recent Chats
                </div>
                {threads.length === 0 ? (
                    <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                        No chats yet. Start a new thread.
                    </p>
                ) : (
                    threads.map((t) => {
                        const isActive = t.id === activeThreadId;
                        return (
                            <div
                                key={t.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                    hapticSelect();
                                    onSelectThread(t.id);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        onSelectThread(t.id);
                                    }
                                }}
                                className={cn(
                                    "group flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium outline-none transition-colors",
                                    isActive
                                        ? "bg-accent text-foreground"
                                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                                )}
                            >
                                <div className="flex min-w-0 items-center gap-2">
                                    <ChatCircleDots
                                        size={14}
                                        className="shrink-0"
                                    />
                                    <span className="truncate">{t.title}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        haptic();
                                        onDeleteThread(t.id);
                                    }}
                                    className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity outline-none hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                                    title="Delete chat"
                                    aria-label={`Delete ${t.title}`}
                                >
                                    <Trash size={13} />
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

function SettingsPanel() {
    const {
        settings,
        updateProvider,
        updateSettings,
        addMcpServer,
        removeMcpServer,
        updateMcpServer,
        resetSettings,
    } = useSettings();
    const [section, setSection] = useState<SettingsSection>("keys");
    const [mcpName, setMcpName] = useState("");
    const [mcpUrl, setMcpUrl] = useState("");

    const sections: {
        id: SettingsSection;
        label: string;
        icon: typeof Key;
    }[] = [
        { id: "keys", label: "API Keys", icon: Key },
        { id: "tools", label: "Tools", icon: Globe },
        { id: "mcp", label: "MCP", icon: Plug },
        { id: "experimental", label: "Experimental", icon: Flask },
        { id: "appearance", label: "Theme", icon: Sun },
    ];

    const handleAddMcp = () => {
        if (!mcpName.trim() || !mcpUrl.trim()) return;
        hapticConfirm();
        const url = mcpUrl.trim();
        const kind: McpServerConfig["kind"] = /\/mcp\/?$/i.test(url)
            ? "http"
            : "sse";
        const newServer: McpServerConfig = {
            id: `mcp_${Date.now()}`,
            name: mcpName.trim(),
            kind,
            url,
            enabled: true,
        };
        addMcpServer(newServer);
        setMcpName("");
        setMcpUrl("");
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1">
                {sections.map((s) => {
                    const Icon = s.icon;
                    return (
                        <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                                hapticSelect();
                                setSection(s.id);
                            }}
                            className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium outline-none transition-colors",
                                section === s.id
                                    ? "border-primary/40 bg-primary/10 text-foreground"
                                    : "border-border/70 text-muted-foreground hover:bg-accent hover:text-foreground",
                            )}
                        >
                            <Icon size={12} />
                            {s.label}
                        </button>
                    );
                })}
            </div>

            {section === "keys" && <KeysSection />}

            {section === "tools" && (
                <div className="flex flex-col gap-2">
                    <ToolToggle
                        title="Web search"
                        description={
                            settings.webSearchEngine === "searxng"
                                ? "SearXNG (self-hosted)"
                                : "DuckDuckGo — no API key"
                        }
                        checked={settings.webSearchEnabled}
                        onChange={(v) =>
                            updateSettings({ webSearchEnabled: v })
                        }
                    />
                    {settings.webSearchEnabled ? (
                        <div className="flex flex-col gap-1.5 rounded-xl border border-border/70 p-2.5">
                            <label className="text-[11px] font-medium text-muted-foreground">
                                Search engine
                            </label>
                            <select
                                value={settings.webSearchEngine}
                                onChange={(e) =>
                                    updateSettings({
                                        webSearchEngine: e.target.value as
                                            | "duckduckgo"
                                            | "searxng",
                                    })
                                }
                                className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none"
                            >
                                <option value="duckduckgo">DuckDuckGo</option>
                                <option value="searxng">SearXNG</option>
                            </select>
                            {settings.webSearchEngine === "searxng" ? (
                                <Input
                                    value={settings.searxngUrl}
                                    onChange={(e) =>
                                        updateSettings({
                                            searxngUrl: e.target.value,
                                        })
                                    }
                                    placeholder="https://searx.example.com"
                                    className="h-8 rounded-lg text-xs"
                                />
                            ) : null}
                        </div>
                    ) : null}
                    <ToolToggle
                        title="Calculator"
                        description="Math & trig evaluations"
                        checked={settings.calculatorEnabled}
                        onChange={(v) =>
                            updateSettings({ calculatorEnabled: v })
                        }
                    />
                    <ToolToggle
                        title="Python"
                        description="Server python3 (self-host/Docker only)"
                        checked={settings.pythonEnabled}
                        onChange={(v) => updateSettings({ pythonEnabled: v })}
                    />
                </div>
            )}

            {section === "mcp" && (
                <div className="flex flex-col gap-3">
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                        HTTP/SSE MCP tools are sent with each chat request.
                        Stdio servers launch server-side on your host.
                    </p>
                    <div className="flex flex-col gap-1.5">
                        <Input
                            value={mcpName}
                            onChange={(e) => setMcpName(e.target.value)}
                            placeholder="Server name"
                            className="h-9 rounded-xl text-xs"
                        />
                        <Input
                            value={mcpUrl}
                            onChange={(e) => setMcpUrl(e.target.value)}
                            placeholder="https://…/sse or /mcp"
                            className="h-9 rounded-xl text-xs"
                        />
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleAddMcp}
                            className="rounded-xl"
                        >
                            Add MCP server
                        </Button>
                    </div>
                    {settings.mcpServers.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                            No MCP servers yet.
                        </p>
                    ) : (
                        settings.mcpServers.map((s) => (
                            <div
                                key={s.id}
                                className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2"
                            >
                                <div className="min-w-0">
                                    <div className="truncate text-xs font-semibold">
                                        {s.name}
                                    </div>
                                    <div className="truncate text-[10px] text-muted-foreground">
                                        {s.kind.toUpperCase()} · {s.url}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            updateMcpServer(s.id, {
                                                enabled: !s.enabled,
                                            })
                                        }
                                        className={cn(
                                            "rounded-md px-1.5 py-0.5 text-[10px] font-medium outline-none",
                                            s.enabled
                                                ? "bg-primary/15 text-primary"
                                                : "bg-muted text-muted-foreground",
                                        )}
                                    >
                                        {s.enabled ? "On" : "Off"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => removeMcpServer(s.id)}
                                        className="rounded-md p-1 text-muted-foreground outline-none hover:text-destructive"
                                        aria-label={`Remove ${s.name}`}
                                    >
                                        <Trash size={14} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {section === "experimental" && <PreviewSettingsSection />}

            {section === "appearance" && (
                <div className="grid grid-cols-3 gap-2">
                    {(
                        [
                            { id: "dark", label: "Dark", icon: Moon },
                            { id: "light", label: "Light", icon: Sun },
                            { id: "system", label: "System", icon: Desktop },
                        ] as const
                    ).map((t) => {
                        const Icon = t.icon;
                        const selected = settings.theme === t.id;
                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => {
                                    hapticSelect();
                                    updateSettings({ theme: t.id });
                                }}
                                className={cn(
                                    "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-[11px] font-medium outline-none transition-colors",
                                    selected
                                        ? "border-primary/50 bg-primary/10 text-foreground"
                                        : "border-border text-muted-foreground hover:bg-accent",
                                )}
                            >
                                <Icon size={18} />
                                {t.label}
                            </button>
                        );
                    })}
                </div>
            )}

            <button
                type="button"
                onClick={() => {
                    haptic();
                    resetSettings();
                }}
                className="mt-auto pt-2 text-left text-[11px] text-destructive outline-none hover:underline"
            >
                Reset all settings
            </button>
        </div>
    );
}

function PreviewSettingsSection() {
    const { settings, updateSettings } = useSettings();
    const preview = settings.preview;

    const seedConfig = (): PreviewModelConfig => ({
        provider: settings.chat.provider,
        model: settings.chat.model,
        reasoningEffort: settings.chat.reasoningEffort,
    });
    const updatePreview = (patch: Partial<typeof preview>) => {
        updateSettings({ preview: { ...preview, ...patch } });
    };
    const updatePrimary = (index: number, patch: Partial<PreviewModelConfig>) => {
        updatePreview({
            primaryModels: preview.primaryModels.map((config, current) =>
                current === index ? { ...config, ...patch } : config,
            ),
        });
    };
    const updateFusion = (patch: Partial<PreviewModelConfig>) => {
        if (!preview.fusionModel) return;
        updatePreview({ fusionModel: { ...preview.fusionModel, ...patch } });
    };

    return (
        <div className="flex flex-col gap-3">
            <ToolToggle
                title="Multi-model preview"
                description="Run up to three models in parallel, then optionally synthesize their answers."
                checked={preview.enabled}
                onChange={(enabled) =>
                    updatePreview({
                        enabled,
                        primaryModels:
                            enabled && preview.primaryModels.length === 0
                                ? [seedConfig()]
                                : preview.primaryModels,
                    })
                }
            />

            {preview.enabled ? (
                <>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Preview runs are isolated from regular chat history. Each
                        tab keeps its own tool calls, reasoning, images, and
                        artifacts while it runs.
                    </p>

                    <div className="flex flex-col gap-2">
                        {preview.primaryModels.map((config, index) => (
                            <PreviewModelRow
                                key={`${config.provider}:${config.model}:${index}`}
                                label={`Model ${index + 1}`}
                                config={config}
                                removable={preview.primaryModels.length > 1}
                                onChange={(patch) => updatePrimary(index, patch)}
                                onRemove={() =>
                                    updatePreview({
                                        primaryModels: preview.primaryModels.filter(
                                            (_, current) => current !== index,
                                        ),
                                    })
                                }
                            />
                        ))}
                    </div>

                    {preview.primaryModels.length < 3 ? (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                                updatePreview({
                                    primaryModels: [
                                        ...preview.primaryModels,
                                        seedConfig(),
                                    ],
                                })
                            }
                            className="rounded-xl"
                        >
                            Add comparison model
                        </Button>
                    ) : null}

                    {preview.fusionModel ? (
                        <PreviewModelRow
                            label="Fusion model"
                            config={preview.fusionModel}
                            removable
                            onChange={updateFusion}
                            onRemove={() => updatePreview({ fusionModel: null })}
                        />
                    ) : (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => updatePreview({ fusionModel: seedConfig() })}
                            className="rounded-xl"
                        >
                            Add fusion model
                        </Button>
                    )}
                </>
            ) : null}
        </div>
    );
}

function PreviewModelRow({
    label,
    config,
    removable,
    onChange,
    onRemove,
}: {
    label: string;
    config: PreviewModelConfig;
    removable: boolean;
    onChange: (patch: Partial<PreviewModelConfig>) => void;
    onRemove: () => void;
}) {
    const { settings } = useSettings();
    const ready = isProviderReady(settings, config.provider);
    const reasoningOptions = getReasoningEffortOptions(
        config.provider,
        config.model,
    );

    return (
        <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-background/50 p-2.5">
            <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold">{label}</span>
                {removable ? (
                    <button
                        type="button"
                        onClick={onRemove}
                        className="rounded-md p-1 text-muted-foreground outline-none hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Remove ${label.toLowerCase()}`}
                    >
                        <Trash size={13} />
                    </button>
                ) : null}
            </div>
            <div className="flex min-w-0 items-center gap-1.5">
                <ProviderPicker
                    value={config.provider}
                    onChange={(provider) =>
                        onChange({
                            provider,
                            model: resolveModel(provider),
                            reasoningEffort: "medium",
                        })
                    }
                    compact
                    className="min-w-0 max-w-[8rem]"
                />
                {ready ? (
                    <ModelPicker
                        provider={config.provider}
                        value={config.model}
                        onChange={(model) => onChange({ model })}
                        enabled
                        compact
                        className="min-w-0 flex-1"
                    />
                ) : (
                    <span className="truncate rounded-lg border border-warning/40 bg-warning/10 px-2 py-1 text-[10px] text-warning">
                        Connect provider first
                    </span>
                )}
            </div>
            {reasoningOptions.length > 0 ? (
                <select
                    value={
                        reasoningOptions.some(
                            (option) => option.id === config.reasoningEffort,
                        )
                            ? config.reasoningEffort
                            : reasoningOptions[0].id
                    }
                    onChange={(event) =>
                        onChange({
                            reasoningEffort: event.target
                                .value as PreviewModelConfig["reasoningEffort"],
                        })
                    }
                    className="h-7 w-full rounded-lg border border-border bg-background px-2 text-[11px] outline-none"
                >
                    {reasoningOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                            {option.label}
                        </option>
                    ))}
                </select>
            ) : null}
        </div>
    );
}

function KeysSection() {
    const { settings, updateProvider, updateChat, updateSettings } =
        useSettings();
    const [active, setActive] = useState<ProviderId>(settings.chat.provider);
    const [draftKey, setDraftKey] = useState(
        settings.providers[active]?.apiKey || "",
    );
    const [draftUrl, setDraftUrl] = useState(
        settings.providers[active]?.baseUrl ||
            PROVIDER_DEFAULTS[active].baseUrl ||
            "",
    );
    const [testing, setTesting] = useState(false);
    const [status, setStatus] = useState<{
        kind: "idle" | "ok" | "error";
        message?: string;
    }>({ kind: "idle" });

    useEffect(() => {
        const cfg = settings.providers[active];
        setDraftKey(cfg?.apiKey || "");
        setDraftUrl(cfg?.baseUrl || PROVIDER_DEFAULTS[active].baseUrl || "");
        setStatus({ kind: "idle" });
    }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

    const local = isLocalProvider(active);
    const keyReady = local || draftKey.trim().length > 0;

    const runTest = useCallback(async () => {
        haptic();
        setTesting(true);
        setStatus({ kind: "idle" });
        const result = await testProviderKey({
            provider: active,
            apiKey: draftKey,
            baseUrl: draftUrl,
        });
        setTesting(false);

        if (!result.ok) {
            setStatus({ kind: "error", message: result.error });
            return;
        }

        hapticConfirm();
        const storedKey = local
            ? draftKey.trim() || localProviderKey(active)
            : draftKey.trim();
        updateProvider(active, {
            apiKey: storedKey,
            baseUrl: draftUrl || PROVIDER_DEFAULTS[active].baseUrl,
            enabled: true,
        });
        const nextModel = resolveModel(
            active,
            settings.chat.model,
            (DEFAULT_MODELS[active] ?? []).map((m) => ({ ...m, provider: active })),
        );
        updateChat({ provider: active, model: nextModel });
        updateSettings({ setupComplete: true });
        setStatus({
            kind: "ok",
            message: `Connected — ${result.models.length} model${result.models.length === 1 ? "" : "s"} available.`,
        });
    }, [
        active,
        draftKey,
        draftUrl,
        local,
        settings.chat.model,
        updateProvider,
        updateChat,
        updateSettings,
    ]);

    return (
        <div className="flex flex-col gap-3">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
                Keys stay in this browser. Test makes a live{" "}
                <span className="font-medium text-foreground">/models</span>{" "}
                call with the key you entered — nothing is read from env vars.
            </p>

            <div className="flex flex-wrap gap-1">
                {(Object.keys(PROVIDER_DEFAULTS) as ProviderId[]).map((id) => {
                    const ready = isProviderReady(settings, id);
                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={() => {
                                hapticSelect();
                                setActive(id);
                            }}
                            className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium outline-none transition-colors",
                                active === id
                                    ? "border-primary/40 bg-primary/10 text-foreground"
                                    : "border-border/70 text-muted-foreground hover:bg-accent",
                            )}
                        >
                            {isLocalProvider(id) ? (
                                <HardDrives size={11} />
                            ) : null}
                            {PROVIDER_DEFAULTS[id].name}
                            {ready ? (
                                <CheckCircle
                                    size={11}
                                    className="text-success"
                                    weight="fill"
                                />
                            ) : null}
                        </button>
                    );
                })}
            </div>

            {!local ? (
                <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">
                        API key
                    </label>
                    <Input
                        type="password"
                        autoComplete="off"
                        spellCheck={false}
                        value={draftKey}
                        onChange={(e) => {
                            setDraftKey(e.target.value);
                            setStatus({ kind: "idle" });
                        }}
                        placeholder={`${PROVIDER_DEFAULTS[active].name} key`}
                        className="h-9 rounded-xl font-mono text-xs"
                    />
                </div>
            ) : null}

            <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-muted-foreground">
                    Endpoint
                </label>
                <Input
                    type="url"
                    value={draftUrl}
                    onChange={(e) => setDraftUrl(e.target.value)}
                    className="h-9 rounded-xl font-mono text-xs"
                />
            </div>

            <Button
                type="button"
                size="sm"
                disabled={!keyReady || testing}
                onClick={runTest}
                className="h-9 rounded-xl"
            >
                {testing ? (
                    <>
                        <SpinnerGap
                            className="animate-spin"
                            data-icon="inline-start"
                        />
                        Testing…
                    </>
                ) : (
                    "Test & save"
                )}
            </Button>

            {status.kind === "ok" && (
                <p className="flex items-start gap-1.5 text-[11px] text-success">
                    <CheckCircle size={14} className="mt-0.5 shrink-0" />
                    {status.message}
                </p>
            )}
            {status.kind === "error" && (
                <p className="flex items-start gap-1.5 text-[11px] text-destructive">
                    <XCircle size={14} className="mt-0.5 shrink-0" />
                    {status.message}
                </p>
            )}

            {status.kind === "idle" && keyReady && !local && (
                <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                    <WarningCircle size={14} className="mt-0.5 shrink-0" />
                    Models unlock after a successful test call.
                </p>
            )}
        </div>
    );
}

function ToolToggle({
    title,
    description,
    checked,
    onChange,
}: {
    title: string;
    description: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-background/50 px-3 py-2.5">
            <div className="min-w-0">
                <div className="text-xs font-semibold">{title}</div>
                <div className="text-[11px] text-muted-foreground">
                    {description}
                </div>
            </div>
            <Switch.Root
                checked={checked}
                onCheckedChange={(v) => {
                    hapticSelect();
                    onChange(v);
                }}
                className="relative h-5 w-9 shrink-0 rounded-full bg-muted transition-colors outline-none data-[state=checked]:bg-primary"
            >
                <Switch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white transition-transform data-[state=checked]:translate-x-4" />
            </Switch.Root>
        </div>
    );
}
