/**
 * AppSidebar — chats list + inline settings (BYOK live key test, models, tools, theme).
 * Settings live in the sidebar (no modal) — TypingMind-style operate surface.
 */

import { useCallback, useEffect, useRef, useState } from "react";
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
    type CustomSkill,
    type McpServerConfig,
    type ConnectorConfig,
    type ConnectorKind,
    type ModelInfo,
    type PreviewModelConfig,
    type ProviderId,
} from "~/lib/types";
import { resolveModel } from "~/lib/model-capabilities";
import { getReasoningEffortOptions } from "~/lib/reasoning";
import {
    UNIVERSAL_MEMORY_EXPORT_PROMPT,
    importMemoryEntries,
} from "~/lib/memory";
import {
    clearMemoryEntries,
    exportLocalBackup,
    getMemoryEntries,
    saveMemoryEntries,
} from "~/lib/db";
import { cn } from "~/lib/utils";
import { localProviderKey } from "~/lib/provider-credentials";
import {
    ChatCircleDots,
    CheckCircle,
    Desktop,
    Brain,
    CloudArrowUp,
    Flask,
    GearSix,
    Globe,
    HardDrives,
    Key,
    Moon,
    Plus,
    Pencil,
    Plug,
    SpinnerGap,
    Sun,
    Trash,
    WarningCircle,
    XCircle,
} from "@phosphor-icons/react";
import * as Switch from "@radix-ui/react-switch";

type SidebarPanel = "chats" | "settings";
type SettingsSection =
    | "keys"
    | "tools"
    | "mcp"
    | "experimental"
    | "memory"
    | "connectors"
    | "cloud"
    | "appearance";

type ThreadItem = { id: string; title: string };

export function AppSidebar({
    threads,
    activeThreadId,
    onSelectThread,
    onNewChat,
    onDeleteThread,
    onRenameThread,
    panel,
    onPanelChange,
}: {
    threads: ThreadItem[];
    activeThreadId: string | null;
    onSelectThread: (id: string) => void;
    onNewChat: () => void;
    onDeleteThread: (id: string) => void;
    onRenameThread: (id: string, title: string) => void;
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
                        onRenameThread={onRenameThread}
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
    onRenameThread,
}: {
    threads: ThreadItem[];
    activeThreadId: string | null;
    onSelectThread: (id: string) => void;
    onNewChat: () => void;
    onDeleteThread: (id: string) => void;
    onRenameThread: (id: string, title: string) => void;
}) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draftTitle, setDraftTitle] = useState("");
    const cancelEditRef = useRef(false);
    const { settings, updateSettings } = useSettings();
    const memoryEnabled = settings.memoryEnabled !== false;

    const beginEditing = (thread: ThreadItem) => {
        cancelEditRef.current = false;
        setEditingId(thread.id);
        setDraftTitle(thread.title);
    };

    const finishEditing = (thread: ThreadItem) => {
        if (editingId !== thread.id) return;
        const title = draftTitle.trim();
        cancelEditRef.current = true;
        setEditingId(null);
        if (title && title !== thread.title) {
            onRenameThread(thread.id, title);
        }
    };

    const cancelEditing = () => {
        cancelEditRef.current = true;
        setEditingId(null);
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                        haptic();
                        onNewChat();
                    }}
                    className="h-9 flex-1 justify-center gap-2 rounded-xl text-xs font-medium outline-none focus-visible:ring-0 focus-visible:border-border"
                >
                    <Plus size={15} weight="bold" data-icon="inline-start" />
                    New Thread
                </Button>
                <button
                    type="button"
                    aria-pressed={memoryEnabled}
                    aria-label={
                        memoryEnabled
                            ? "Memory is on. Saved memories are attached to every message."
                            : "Memory is off. No saved memories are attached."
                    }
                    title={
                        memoryEnabled
                            ? "Memory on: saved memories are attached to every request."
                            : "Memory off: no saved memories are attached. Click to turn on."
                    }
                    onClick={() => {
                        haptic();
                        updateSettings({ memoryEnabled: !memoryEnabled });
                    }}
                    className={cn(
                        "flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-2.5 text-xs font-medium outline-none transition-colors focus-visible:border-border focus-visible:ring-0",
                        memoryEnabled
                            ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                            : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                >
                    <Brain size={16} weight={memoryEnabled ? "fill" : "regular"} />
                    <span>Memory</span>
                </button>
            </div>

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
                                {editingId === t.id ? (
                                    <input
                                        autoFocus
                                        value={draftTitle}
                                        onChange={(e) => setDraftTitle(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        onBlur={() => {
                                            if (cancelEditRef.current) {
                                                cancelEditRef.current = false;
                                                return;
                                            }
                                            finishEditing(t);
                                        }}
                                        onKeyDown={(e) => {
                                            e.stopPropagation();
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                e.currentTarget.blur();
                                            } else if (e.key === "Escape") {
                                                e.preventDefault();
                                                cancelEditing();
                                            }
                                        }}
                                        className="min-w-0 flex-1 rounded border border-input bg-background px-1.5 py-0.5 text-xs text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        aria-label={`Rename ${t.title}`}
                                    />
                                ) : (
                                    <div className="flex min-w-0 items-center gap-2">
                                        <ChatCircleDots
                                            size={14}
                                            className="shrink-0"
                                        />
                                        <span className="truncate">{t.title}</span>
                                    </div>
                                )}
                                {editingId !== t.id ? (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            hapticSelect();
                                            beginEditing(t);
                                        }}
                                        className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity outline-none hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                                        title="Rename chat"
                                        aria-label={`Rename ${t.title}`}
                                    >
                                        <Pencil size={13} />
                                    </button>
                                ) : null}
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
    const [mcpKind, setMcpKind] = useState<McpServerConfig["kind"]>("http");
    const [mcpHeaders, setMcpHeaders] = useState("");
    const [mcpError, setMcpError] = useState<string | null>(null);

    const sections: {
        id: SettingsSection;
        label: string;
        icon: typeof Key;
    }[] = [
        { id: "keys", label: "API Keys", icon: Key },
        { id: "tools", label: "Tools", icon: Globe },
        { id: "mcp", label: "MCP Beta", icon: Plug },
        { id: "experimental", label: "Experimental", icon: Flask },
        { id: "memory", label: "Memory Beta", icon: Brain },
        { id: "connectors", label: "Connectors Beta", icon: HardDrives },
        { id: "cloud", label: "Cloud Storage Beta", icon: CloudArrowUp },
        { id: "appearance", label: "Theme", icon: Sun },
    ];

    const handleAddMcp = () => {
        if (!mcpName.trim() || !mcpUrl.trim()) return;
        let headers: Record<string, string> | undefined;
        if (mcpHeaders.trim()) {
            try {
                const parsed = JSON.parse(mcpHeaders) as unknown;
                if (
                    !parsed ||
                    typeof parsed !== "object" ||
                    Array.isArray(parsed) ||
                    Object.values(parsed).some((value) => typeof value !== "string")
                ) {
                    throw new Error();
                }
                headers = parsed as Record<string, string>;
            } catch {
                setMcpError("Headers must be a JSON object with string values.");
                return;
            }
        }
        hapticConfirm();
        const newServer: McpServerConfig = {
            id: `mcp_${Date.now()}`,
            name: mcpName.trim(),
            kind: mcpKind,
            url: mcpUrl.trim(),
            headers,
            enabled: true,
        };
        addMcpServer(newServer);
        setMcpName("");
        setMcpUrl("");
        setMcpHeaders("");
        setMcpError(null);
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
                    {(() => {
                        const activeSearchConnector = settings.connectors.find(
                            (connector) =>
                                connector.enabled &&
                                Boolean(connector.apiKey?.trim()) &&
                                ["tavily", "brave", "exa", "parallel"].includes(connector.kind),
                        );
                        const searchConnectorKinds = ["tavily", "brave", "exa", "parallel"];
                        return (
                            <>
                    <ToolToggle
                        title="Web search"
                        description={
                            activeSearchConnector?.name ||
                            (settings.webSearchEngine === "searxng"
                                ? "SearXNG (self-hosted)"
                                : "DuckDuckGo — no API key")
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
                                value={activeSearchConnector?.kind || settings.webSearchEngine}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    if (searchConnectorKinds.includes(value)) {
                                        updateSettings({
                                            webSearchEnabled: true,
                                            connectors: settings.connectors.map((connector) =>
                                                searchConnectorKinds.includes(connector.kind)
                                                    ? { ...connector, enabled: connector.kind === value }
                                                    : connector,
                                            ),
                                        });
                                    } else {
                                        updateSettings({
                                            webSearchEngine: value as "duckduckgo" | "searxng",
                                            connectors: settings.connectors.map((connector) =>
                                                searchConnectorKinds.includes(connector.kind)
                                                    ? { ...connector, enabled: false }
                                                    : connector,
                                            ),
                                        });
                                    }
                                }}
                                className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none"
                            >
                                <option value="duckduckgo">DuckDuckGo</option>
                                <option value="searxng">SearXNG</option>
                                {settings.connectors
                                    .filter(
                                        (connector) =>
                                            searchConnectorKinds.includes(connector.kind) &&
                                            Boolean(connector.apiKey?.trim()),
                                    )
                                    .map((connector) => (
                                        <option key={connector.kind} value={connector.kind}>
                                            {connector.name}
                                        </option>
                                    ))}
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
                            <p className="text-[10px] leading-relaxed text-muted-foreground">
                                DuckDuckGo Instant Answers are included by default as a fast research overview. This free service is intended for non-commercial use; review DuckDuckGo&apos;s current terms before commercial deployment. Verify important claims with fetched sources.
                            </p>
                        </div>
                    ) : null}
                            </>
                        );
                    })()}
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
                        description="Browser Pyodide with NumPy, pandas, SciPy, plotting, and more"
                        checked={settings.pythonEnabled}
                        onChange={(v) => updateSettings({ pythonEnabled: v })}
                    />
                    <CustomSkillsSection />
                </div>
            )}

            {section === "mcp" && (
                <div className="flex flex-col gap-3">
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Remote HTTP/SSE MCP tools are loaded for each chat request.
                        Add any required request headers below; local/private targets
                        require the self-hosted opt-in environment setting.
                    </p>
                    <div className="flex flex-col gap-1.5">
                        <Input
                            value={mcpName}
                            onChange={(e) => setMcpName(e.target.value)}
                            placeholder="Server name"
                            className="h-9 rounded-xl text-xs"
                        />
                        <select
                            value={mcpKind}
                            onChange={(event) =>
                                setMcpKind(event.target.value as "http" | "sse")
                            }
                            className="h-9 rounded-xl border border-border bg-background px-2 text-xs outline-none"
                            aria-label="MCP transport"
                        >
                            <option value="http">Streamable HTTP</option>
                            <option value="sse">Server-sent events</option>
                        </select>
                        <Input
                            value={mcpHeaders}
                            onChange={(event) => setMcpHeaders(event.target.value)}
                            placeholder='Optional headers JSON, e.g. {"Authorization":"Bearer …"}'
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
                        {mcpError ? <p className="text-[11px] text-destructive">{mcpError}</p> : null}
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
                                        {s.kind.toUpperCase()} · {s.url}{s.headers && Object.keys(s.headers).length > 0 ? " · headers" : ""}
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

            {section === "experimental" && (
                <div className="flex flex-col gap-3">
                    <SubagentsSettingsSection />
                    <PreviewSettingsSection />
                </div>
            )}

            {section === "memory" && <MemorySettingsSection />}

            {section === "connectors" && <ConnectorsSection />}

            {section === "cloud" && <CloudStorageSection />}

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

function MemorySettingsSection() {
    const [count, setCount] = useState(0);
    const [status, setStatus] = useState<string | null>(null);
    const [pastedMemory, setPastedMemory] = useState("");
    const { settings, updateSettings } = useSettings();
    const memoryEnabled = settings.memoryEnabled !== false;

    useEffect(() => {
        void getMemoryEntries().then((entries) => setCount(entries.length));
    }, []);

    const importText = async (raw: string) => {
        try {
            let payload: unknown = raw;
            try {
                payload = JSON.parse(raw);
            } catch {
                // Plain text and markdown are supported as universal imports.
            }
            const entries = importMemoryEntries(payload);
            if (entries.length === 0) {
                setStatus("No usable memories found. Use a memory fact or supported JSON export.");
                return;
            }
            await saveMemoryEntries(entries);
            const storedEntries = await getMemoryEntries();
            setCount(storedEntries.length);
            setStatus(`${entries.length} memories imported locally.`);
            setPastedMemory("");
        } catch (error) {
            setStatus(error instanceof Error ? error.message : "Import failed.");
        }
    };

    const importFile = async (file: File) => importText(await file.text());

    const copyPrompt = async () => {
        await navigator.clipboard.writeText(UNIVERSAL_MEMORY_EXPORT_PROMPT);
        setStatus("Universal export prompt copied.");
    };

    const downloadMemory = async () => {
        const entries = await getMemoryEntries();
        const blob = new Blob([JSON.stringify({ version: 1, memories: entries }, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "ai-diy-memory.json";
        anchor.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col gap-3">
            <ToolToggle
                title="Attach memory to chats"
                description={
                    memoryEnabled
                        ? "Saved memories are attached to every request; the AI can also read more on demand."
                        : "No saved memories are attached. Turn on to give the AI memory."
                }
                checked={memoryEnabled}
                onChange={(value) => updateSettings({ memoryEnabled: value })}
            />
            <div>
                <h3 className="text-xs font-semibold">Local memory</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Saved memories stay in this browser. A bounded set of historical
                    memories is attached to the system prompt; they are separate from
                    active app preferences and the full archive is never sent automatically.
                </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-[11px] leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Import from another AI:</strong>{" "}
                copy the export prompt below into ChatGPT, Gemini, Claude, or Grok,
                save its JSON response, then import that file here.
            </div>
            <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={copyPrompt} className="rounded-xl">
                    Copy export prompt
                </Button>
                <label className="inline-flex h-8 cursor-pointer items-center rounded-xl border border-border px-3 text-xs font-medium hover:bg-accent">
                    Import memory
                    <input
                        type="file"
                        accept=".json,.txt,.md,text/plain,application/json"
                        className="sr-only"
                        onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void importFile(file);
                            event.currentTarget.value = "";
                        }}
                    />
                </label>
            </div>
            <textarea
                value={pastedMemory}
                onChange={(event) => setPastedMemory(event.target.value)}
                placeholder='Paste exported JSON or a concise memory list here…'
                rows={4}
                className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
                aria-label="Paste memory export"
            />
            <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!pastedMemory.trim()}
                onClick={() => void importText(pastedMemory)}
                className="self-start rounded-xl"
            >
                Import pasted memory
            </Button>
            <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-xs">
                <span>{count} stored memories</span>
                <div className="flex items-center gap-1">
                    <button type="button" onClick={() => void downloadMemory()} className="rounded-md px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                        Export
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            void clearMemoryEntries();
                            setCount(0);
                            setStatus("Local memory cleared.");
                        }}
                        className="rounded-md px-2 py-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                        Clear
                    </button>
                </div>
            </div>
            {status ? <p className="text-[11px] text-primary">{status}</p> : null}
        </div>
    );
}

const SEARCH_CONNECTOR_OPTIONS: Array<{
    kind: Extract<ConnectorKind, "tavily" | "brave" | "exa" | "parallel">;
    label: string;
    placeholder: string;
}> = [
    { kind: "tavily", label: "Tavily", placeholder: "tvly-…" },
    { kind: "brave", label: "Brave Search", placeholder: "Subscription token" },
    { kind: "exa", label: "Exa", placeholder: "Exa API key" },
    { kind: "parallel", label: "Parallel", placeholder: "Parallel API key" },
];

function ConnectorsSection() {
    const { settings, updateSettings } = useSettings();
    const [status, setStatus] = useState<Record<string, string>>({});
    const [helpKind, setHelpKind] = useState<ConnectorKind | null>(null);
    const connectors = settings.connectors ?? [];

    const getConnector = (kind: ConnectorKind): ConnectorConfig =>
        connectors.find((connector) => connector.kind === kind) ?? {
            id: `connector_${kind}`,
            kind,
            name: kind,
            enabled: false,
            apiKey: "",
        };

    const saveConnector = (connector: ConnectorConfig, exclusive = false) => {
        const next = exclusive
            ? connectors.map((current) =>
                  ["tavily", "brave", "exa", "parallel"].includes(current.kind) &&
                  current.kind !== connector.kind
                      ? { ...current, enabled: false }
                      : current,
              )
            : [...connectors];
        const index = next.findIndex((current) => current.kind === connector.kind);
        if (index >= 0) next[index] = connector;
        else next.push(connector);
        updateSettings({ connectors: next });
    };

    const testConnector = async (connector: ConnectorConfig) => {
        setStatus((current) => ({ ...current, [connector.kind]: "Testing…" }));
        try {
            const response = await fetch("/api/connectors", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "test", connector }),
            });
            const data = (await response.json()) as { ok?: boolean; error?: string };
            setStatus((current) => ({
                ...current,
                [connector.kind]: data.ok ? "Connected" : data.error || "Test failed",
            }));
            if (data.ok) saveConnector({ ...connector, enabled: true }, true);
        } catch (error) {
            setStatus((current) => ({
                ...current,
                [connector.kind]: error instanceof Error ? error.message : "Test failed",
            }));
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <div>
                <h3 className="text-xs font-semibold">Connectors <span className="text-[9px] uppercase tracking-wider text-primary">Beta</span></h3>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Search connectors are BYOK and sent only for the current request. The first enabled connector wins.
                </p>
            </div>
            {SEARCH_CONNECTOR_OPTIONS.map((option) => {
                const connector = getConnector(option.kind);
                return (
                    <div key={option.kind} className="flex flex-col gap-2 rounded-xl border border-border/70 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold">{option.label}</span>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setHelpKind(helpKind === option.kind ? null : option.kind)}
                                    className="flex size-6 items-center justify-center rounded-md border border-border text-[11px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
                                    aria-label={`How to get a ${option.label} key`}
                                >
                                    ?
                                </button>
                                <button
                                    type="button"
                                    onClick={() => saveConnector({ ...connector, enabled: !connector.enabled }, true)}
                                    className={cn(
                                        "rounded-md px-2 py-1 text-[10px] font-medium",
                                        connector.enabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                                    )}
                                >
                                    {connector.enabled ? "On" : "Off"}
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-1.5">
                            <Input
                                type="password"
                                value={connector.apiKey ?? ""}
                                onChange={(event) => saveConnector({ ...connector, apiKey: event.target.value })}
                                placeholder={option.placeholder}
                                className="h-8 min-w-0 flex-1 rounded-lg text-xs"
                            />
                            <Button type="button" size="sm" variant="outline" onClick={() => void testConnector(connector)} className="h-8 rounded-lg px-2 text-[11px]">
                                Test
                            </Button>
                        </div>
                        {status[option.kind] ? <p className="text-[10px] text-muted-foreground">{status[option.kind]}</p> : null}
                        {helpKind === option.kind ? (
                            <ConnectorHelp kind={option.kind} />
                        ) : null}
                    </div>
                );
            })}
            <div className="rounded-xl border border-dashed border-border/70 p-3 text-[11px] leading-relaxed text-muted-foreground">
                <strong className="text-foreground">GitHub, Supabase, PostgreSQL, S3:</strong> connect these through a permission-scoped Remote MCP server in MCP Beta. Direct database/service-role proxying is intentionally blocked.
            </div>
        </div>
    );
}

function ConnectorHelp({
    kind,
}: {
    kind: Extract<ConnectorKind, "tavily" | "brave" | "exa" | "parallel">;
}) {
    const details = {
        tavily: {
            text: "Create an API key in Tavily, then paste it here. Requests use Bearer authentication and basic search defaults.",
            url: "https://app.tavily.com/home",
            label: "Open Tavily dashboard",
        },
        brave: {
            text: "Create a Brave Search subscription token. Requests use the X-Subscription-Token header and rate-limit-safe result counts.",
            url: "https://api.search.brave.com/app/keys",
            label: "Open Brave API keys",
        },
        exa: {
            text: "Create an Exa API key. Results include semantic matches and highlights for cited research.",
            url: "https://dashboard.exa.ai/api-keys",
            label: "Open Exa API keys",
        },
        parallel: {
            text: "Create a Parallel API key. The connector uses advanced search with bounded result counts and citations.",
            url: "https://platform.parallel.ai/settings/api-keys",
            label: "Open Parallel API keys",
        },
    }[kind];
    return (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-2 text-[10px] leading-relaxed text-muted-foreground">
            <p>{details.text}</p>
            <a
                href={details.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block font-medium text-primary underline-offset-2 hover:underline"
            >
                {details.label} ↗
            </a>
        </div>
    );
}

function CloudStorageSection() {
    const [guideOpen, setGuideOpen] = useState(false);

    const downloadBackup = async () => {
        const backup = await exportLocalBackup();
        const blob = new Blob([JSON.stringify(backup, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `ai-diy-backup-${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col gap-3">
            <div>
                <h3 className="text-xs font-semibold">
                    Cloud storage <span className="text-[9px] uppercase tracking-wider text-primary">Beta</span> <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Coming soon</span>
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Automatic cloud sync is coming soon. Download a complete local backup now; local IndexedDB remains the source of truth.
                </p>
            </div>
            <div className="rounded-xl border border-dashed border-border/70 p-3 text-[11px] leading-relaxed text-muted-foreground">
                A backup can contain chat content and generated artifacts. Store it securely and do not upload it to a service you do not trust.
            </div>
            <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void downloadBackup()}
                className="self-start rounded-xl"
            >
                Download local backup
            </Button>
            <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setGuideOpen((open) => !open)}
                className="rounded-xl"
            >
                {guideOpen ? "Hide setup guide" : "View Google Drive setup"}
            </Button>
            {guideOpen ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
                    <p>
                        Google Drive backup is not connected yet. The safe planned
                        flow uses a user-supplied OAuth client ID, PKCE, and the
                        restricted <code>drive.appdata</code> scope. No Drive key,
                        refresh token, or chat data is accepted by this Beta panel.
                    </p>
                    <a
                        href="https://developers.google.com/drive/api/quickstart/js"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block font-medium text-primary underline-offset-2 hover:underline"
                    >
                        Read Google&apos;s official setup guide ↗
                    </a>
                </div>
            ) : null}
        </div>
    );
}

function CustomSkillsSection() {
    const { settings, updateSettings } = useSettings();
    const [name, setName] = useState("");
    const [content, setContent] = useState("");

    const addSkill = () => {
        const trimmedName = name.trim();
        const trimmedContent = content.trim();
        if (!trimmedName || !trimmedContent) return;
        const skill: CustomSkill = {
            id: `skill_${Date.now()}`,
            name: trimmedName,
            description: "",
            content: trimmedContent,
            enabled: true,
        };
        updateSettings({
            customSkills: [...settings.customSkills, skill],
        });
        setName("");
        setContent("");
        hapticConfirm();
    };

    const patchSkill = (id: string, patch: Partial<CustomSkill>) => {
        updateSettings({
            customSkills: settings.customSkills.map((skill) =>
                skill.id === id ? { ...skill, ...patch } : skill,
            ),
        });
    };

    const removeSkill = (id: string) => {
        updateSettings({
            customSkills: settings.customSkills.filter((skill) => skill.id !== id),
        });
    };

    return (
        <div className="flex flex-col gap-2 rounded-xl border border-border/70 p-2.5">
            <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-medium text-muted-foreground">
                    Custom skills
                </label>
                <span className="text-[10px] text-muted-foreground">
                    Type / in the composer to force one
                </span>
            </div>
            {settings.customSkills.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                    {settings.customSkills.map((skill) => (
                        <div
                            key={skill.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background px-2 py-1.5"
                        >
                            <span className="min-w-0 truncate text-xs font-medium">
                                {skill.name}
                            </span>
                            <div className="flex shrink-0 items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() =>
                                        patchSkill(skill.id, {
                                            enabled: !skill.enabled,
                                        })
                                    }
                                    className={cn(
                                        "rounded-md px-1.5 py-0.5 text-[10px] font-medium outline-none",
                                        skill.enabled
                                            ? "bg-primary/15 text-primary"
                                            : "bg-muted text-muted-foreground",
                                    )}
                                >
                                    {skill.enabled ? "On" : "Off"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => removeSkill(skill.id)}
                                    className="rounded-md p-1 text-muted-foreground outline-none hover:text-destructive"
                                    aria-label={`Remove ${skill.name}`}
                                >
                                    <Trash size={13} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-[10px] text-muted-foreground">
                    No custom skills yet. Add one below; built-in skills
                    (Research, Ultimate Frontend UI, …) are always available in
                    the slash menu.
                </p>
            )}
            <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Skill name"
                className="h-8 rounded-lg text-xs"
            />
            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Instructions the AI must follow when this skill is forced"
                rows={3}
                className="h-auto w-full resize-none rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none placeholder:text-muted-foreground"
            />
            <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!name.trim() || !content.trim()}
                onClick={addSkill}
                className="rounded-lg"
            >
                <Plus size={13} />
                Add skill
            </Button>
        </div>
    );
}

function SubagentsSettingsSection() {
    const { settings, updateSettings } = useSettings();
    return (
        <div className="flex flex-col gap-3">
            <ToolToggle
                title="Subagents"
                description="Let the AI delegate subtasks to subagents. Every subagent requires your approval, runs in a watchable popup, and can use the same tools as the main chat."
                checked={settings.subagentsEnabled}
                onChange={(enabled) => updateSettings({ subagentsEnabled: enabled })}
            />
            {settings.subagentsEnabled ? (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                    The model can call{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                        spawn_subagent
                    </code>{" "}
                    for deep research or long multi-step work. You approve each
                    subagent before it runs, you cannot prompt it mid-run, and
                    the main model waits for its result before synthesizing the
                    answer.
                </p>
            ) : null}
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
    const [draftName, setDraftName] = useState(
        settings.providers[active]?.name || PROVIDER_DEFAULTS[active].name,
    );
    const [draftKey, setDraftKey] = useState(
        settings.providers[active]?.apiKey || "",
    );
    const [draftUrl, setDraftUrl] = useState(
        settings.providers[active]?.baseUrl ||
            PROVIDER_DEFAULTS[active].baseUrl ||
            "",
    );
    const [draftCompatible, setDraftCompatible] = useState(
        settings.providers[active]?.openAICompatible ?? {
            apiMode: "auto" as const,
            reasoningWithTools: "auto" as const,
            authMode: "bearer" as const,
            timeoutMs: 60_000,
            maxRetries: 2,
        },
    );
    const [draftHeaders, setDraftHeaders] = useState("");
    const [manualModelId, setManualModelId] = useState("");
    const [discoveredModels, setDiscoveredModels] = useState<ModelInfo[]>([]);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [testResult, setTestResult] = useState<{
        models: ModelInfo[];
        live: boolean;
        latencyMs: number;
        resolvedBaseUrl?: string;
    } | null>(null);
    const [testing, setTesting] = useState(false);
    const [status, setStatus] = useState<{
        kind: "idle" | "ok" | "error";
        message?: string;
    }>({ kind: "idle" });

    useEffect(() => {
        const cfg = settings.providers[active];
        setDraftName(cfg?.name || PROVIDER_DEFAULTS[active].name);
        setDraftKey(cfg?.apiKey || "");
        setDraftUrl(cfg?.baseUrl || PROVIDER_DEFAULTS[active].baseUrl || "");
        setDraftCompatible(
            cfg?.openAICompatible ?? {
                apiMode: "auto",
                reasoningWithTools: "auto",
                authMode: "bearer",
                timeoutMs: 60_000,
                maxRetries: 2,
            },
        );
        setDraftHeaders(
            cfg?.openAICompatible?.headers
                ? JSON.stringify(cfg.openAICompatible.headers)
                : "",
        );
        setManualModelId("");
        setDiscoveredModels([]);
        setTestResult(null);
        setStatus({ kind: "idle" });
    }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

    const local = isLocalProvider(active);
    const custom = active === "custom";
    const keyReady = local || draftKey.trim().length > 0;

    const parseHeaders = (): Record<string, string> | undefined => {
        let headers: Record<string, string> = {};
        if (draftHeaders.trim()) {
            const parsed = JSON.parse(draftHeaders) as unknown;
            if (
                !parsed ||
                typeof parsed !== "object" ||
                Array.isArray(parsed) ||
                Object.values(parsed).some((value) => typeof value !== "string")
            ) {
                throw new Error("Custom headers must be a JSON object with string values.");
            }
            headers = { ...(parsed as Record<string, string>) };
        }
        if (draftCompatible.authMode === "api-key-header" && draftKey.trim()) {
            headers["X-API-Key"] = draftKey.trim();
        }
        if (
            draftCompatible.authMode === "custom-header" &&
            draftCompatible.authHeader?.trim() &&
            draftKey.trim()
        ) {
            headers[draftCompatible.authHeader.trim()] = draftKey.trim();
        }
        return Object.keys(headers).length > 0 ? headers : undefined;
    };

    const runTest = useCallback(async () => {
        haptic();
        setTesting(true);
        setStatus({ kind: "idle" });
        if (custom && !draftUrl.trim()) {
            setTesting(false);
            setStatus({ kind: "error", message: "Enter the custom provider API root first." });
            return;
        }
        let result;
        try {
            result = await testProviderKey({
                provider: active,
                apiKey:
                    custom && draftCompatible.authMode && draftCompatible.authMode !== "bearer"
                        ? ""
                        : draftKey,
                baseUrl: draftUrl,
                    headers: parseHeaders(),
                    timeoutMs: draftCompatible.timeoutMs,
                    maxRetries: draftCompatible.maxRetries,
                    authMode: draftCompatible.authMode,
            });
        } catch (error) {
            setTesting(false);
            setStatus({
                kind: "error",
                message: error instanceof Error ? error.message : "Invalid connection settings.",
            });
            return;
        }
        setTesting(false);

        if (!result.ok) {
            setDiscoveredModels([]);
            setTestResult(null);
            setStatus({ kind: "error", message: result.error });
            return;
        }

        setDiscoveredModels(result.models);
        setTestResult({
            models: result.models,
            live: result.live === true,
            latencyMs: result.latencyMs ?? 0,
            resolvedBaseUrl: result.resolvedBaseUrl,
        });

        if (custom) {
            setStatus({
                kind: "ok",
                message: `Connected — ${result.models.length} model${result.models.length === 1 ? "" : "s"} found in ${result.latencyMs ?? 0} ms.`,
            });
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
            openAICompatible: custom ? draftCompatible : undefined,
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
        custom,
        local,
        settings.chat.model,
        updateProvider,
        updateChat,
        updateSettings,
    ]);

    const saveCustomConnection = () => {
        try {
            if (!draftUrl.trim()) throw new Error("Enter the custom provider API root first.");
            const headers = parseHeaders();
            const model =
                manualModelId.trim() || discoveredModels[0]?.id || "default-model";
            updateProvider(active, {
                name: draftName.trim() || "Custom OpenAI Proxy",
                apiKey: draftKey.trim() || localProviderKey(active),
                baseUrl: draftUrl.trim(),
                enabled: true,
                openAICompatible: { ...draftCompatible, headers },
            });
            updateChat({ provider: active, model });
            updateSettings({ setupComplete: true });
            setStatus({ kind: "ok", message: `Saved connection — ${model}.` });
        } catch (error) {
            setStatus({
                kind: "error",
                message: error instanceof Error ? error.message : "Invalid connection settings.",
            });
        }
    };

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

            {custom ? (
                <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">
                        Connection name
                    </label>
                    <Input
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        placeholder="LM Studio, Local vLLM, Company gateway"
                        className="h-9 rounded-xl text-xs"
                    />
                </div>
            ) : null}

            {!local || custom ? (
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
                        placeholder={custom ? "Optional API key for hosted endpoints" : `${PROVIDER_DEFAULTS[active].name} key`}
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

            {custom ? (
                <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/20 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <p className="text-[11px] font-medium">OpenAI-compatible API</p>
                            <p className="text-[10px] text-muted-foreground">Chat Completions is the safest default.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setAdvancedOpen((open) => !open)}
                            className="rounded-lg border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                            {advancedOpen ? "Hide advanced" : "Advanced"}
                        </button>
                    </div>
                    {advancedOpen ? (
                        <div className="flex flex-col gap-2 border-t border-border/60 pt-2">
                            <label className="text-[10px] text-muted-foreground">
                                API mode
                                <select
                                    value={draftCompatible.apiMode}
                                    onChange={(event) =>
                                        setDraftCompatible((current) => ({
                                            ...current,
                                            apiMode: event.target.value as "auto" | "chat" | "responses",
                                        }))
                                    }
                                    className="mt-1 h-8 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none"
                                >
                                    <option value="auto">Auto-detect (Chat default)</option>
                                    <option value="chat">Chat Completions</option>
                                    <option value="responses">Responses API</option>
                                </select>
                            </label>
                            <label className="text-[10px] text-muted-foreground">
                                Authentication method
                                <select
                                    value={draftCompatible.authMode ?? "bearer"}
                                    onChange={(event) =>
                                        setDraftCompatible((current) => ({
                                            ...current,
                                            authMode: event.target.value as NonNullable<typeof current.authMode>,
                                        }))
                                    }
                                    className="mt-1 h-8 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none"
                                >
                                    <option value="bearer">Bearer token</option>
                                    <option value="api-key-header">X-API-Key</option>
                                    <option value="custom-header">Custom header</option>
                                    <option value="none">No authentication</option>
                                </select>
                            </label>
                            {draftCompatible.authMode === "custom-header" ? (
                                <Input
                                    value={draftCompatible.authHeader ?? ""}
                                    onChange={(event) =>
                                        setDraftCompatible((current) => ({
                                            ...current,
                                            authHeader: event.target.value,
                                        }))
                                    }
                                    placeholder="Header name, e.g. X-API-Key"
                                    className="h-8 rounded-lg text-xs"
                                />
                            ) : null}
                            <label className="text-[10px] text-muted-foreground">
                                Custom headers JSON
                                <Input
                                    value={draftHeaders}
                                    onChange={(event) => setDraftHeaders(event.target.value)}
                                    placeholder='{"HTTP-Referer":"https://…","X-Title":"ai.diy"}'
                                    className="mt-1 h-8 rounded-lg font-mono text-[10px]"
                                />
                            </label>
                            <label className="text-[10px] text-muted-foreground">
                                Tool compatibility
                                <select
                                    value={draftCompatible.reasoningWithTools}
                                    onChange={(event) =>
                                        setDraftCompatible((current) => ({
                                            ...current,
                                            reasoningWithTools: event.target.value as "auto" | "none" | "allow",
                                        }))
                                    }
                                    className="mt-1 h-8 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none"
                                >
                                    <option value="auto">Auto-detect</option>
                                    <option value="none">Disable tools for reasoning models</option>
                                    <option value="allow">Force tools on</option>
                                </select>
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <label className="text-[10px] text-muted-foreground">
                                    Timeout (seconds)
                                    <Input
                                        type="number"
                                        min={5}
                                        max={300}
                                        value={Math.round((draftCompatible.timeoutMs ?? 60_000) / 1000)}
                                        onChange={(event) =>
                                            setDraftCompatible((current) => ({
                                                ...current,
                                                timeoutMs: Math.max(5, Number(event.target.value) || 60) * 1000,
                                            }))
                                        }
                                        className="mt-1 h-8 rounded-lg text-xs"
                                    />
                                </label>
                                <label className="text-[10px] text-muted-foreground">
                                    Maximum retries
                                    <Input
                                        type="number"
                                        min={0}
                                        max={5}
                                        value={draftCompatible.maxRetries ?? 2}
                                        onChange={(event) =>
                                            setDraftCompatible((current) => ({
                                                ...current,
                                                maxRetries: Math.min(5, Math.max(0, Number(event.target.value) || 0)),
                                            }))
                                        }
                                        className="mt-1 h-8 rounded-lg text-xs"
                                    />
                                </label>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <p className="text-[10px] text-muted-foreground">Capability overrides</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {([
                                        ["tools", "Tool calling"],
                                        ["vision", "Vision"],
                                        ["structuredOutput", "Structured output"],
                                        ["reasoning", "Reasoning controls"],
                                        ["embeddings", "Embeddings"],
                                        ["parallelTools", "Parallel tools"],
                                    ] as const).map(([key, label]) => {
                                        const value = draftCompatible.capabilityOverrides?.[key];
                                        return (
                                            <label key={key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                <span className="min-w-0 flex-1 truncate">{label}</span>
                                                <select
                                                    value={value === undefined ? "auto" : value ? "on" : "off"}
                                                    onChange={(event) =>
                                                        setDraftCompatible((current) => ({
                                                            ...current,
                                                            capabilityOverrides: {
                                                                ...current.capabilityOverrides,
                                                                [key]: event.target.value === "auto" ? undefined : event.target.value === "on",
                                                            },
                                                        }))
                                                    }
                                                    className="h-7 rounded-md border border-border bg-background px-1 text-[10px] outline-none"
                                                >
                                                    <option value="auto">Auto</option>
                                                    <option value="on">On</option>
                                                    <option value="off">Off</option>
                                                </select>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            ) : null}

            {custom ? (
                <div className="flex flex-col gap-2 rounded-xl border border-border/70 p-2.5">
                    <p className="text-[11px] font-medium">Default model</p>
                    {discoveredModels.length > 0 ? (
                        <select
                            value={manualModelId}
                            onChange={(event) => setManualModelId(event.target.value)}
                            className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none"
                        >
                            <option value="">Select a discovered model</option>
                            {discoveredModels.map((model) => (
                                <option key={model.id} value={model.id}>
                                    {model.name || model.id}
                                </option>
                            ))}
                        </select>
                    ) : null}
                    <Input
                        value={manualModelId}
                        onChange={(event) => setManualModelId(event.target.value)}
                        placeholder="Manual model ID if /models is unavailable"
                        className="h-8 rounded-lg font-mono text-xs"
                    />
                </div>
            ) : null}

            <div className={cn("grid gap-2", custom ? "grid-cols-2" : "grid-cols-1")}>
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
                        custom ? "Test connection" : "Test & save"
                    )}
                </Button>
                {custom ? (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={testing || !manualModelId.trim() && !discoveredModels.length}
                        onClick={saveCustomConnection}
                        className="h-9 rounded-xl"
                    >
                        Save connection
                    </Button>
                ) : null}
            </div>

            {custom && testResult ? (
                <div className="rounded-xl border border-success/25 bg-success/5 p-2.5 text-[10px] leading-relaxed text-muted-foreground">
                    <p className="font-medium text-success">Connection successful</p>
                    <p>{testResult.models.length} models found · {testResult.live ? "Live discovery" : "Fallback catalog"} · {testResult.latencyMs} ms</p>
                    <p className="truncate">Resolved endpoint: {testResult.resolvedBaseUrl || draftUrl || "default"}</p>
                    <p>Streaming and tool support are selected by compatibility settings; they are not independently probed yet.</p>
                </div>
            ) : null}

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
