/**
 * AppSidebar — chats list + inline settings (BYOK live key test, models, tools, theme).
 * Settings live in the sidebar (no modal) — TypingMind-style operate surface.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { ModelPicker } from "~/components/ui/ModelPicker";
import { ProviderPicker } from "~/components/ui/ProviderPicker";
import { ModelLogo } from "~/components/ui/ModelLogo";
import { ChatGPTLoginSettings } from "~/components/settings/ChatGPTLoginSettings";
import { haptic, hapticConfirm, hapticSelect } from "~/lib/haptics";
import {
    connectAuthorize,
    connectList,
    connectTest,
    type ConnectConnectorEntryLite,
} from "~/lib/connect-api";
import { testProviderKey } from "~/lib/key-test";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { isLocalProvider, isProviderReady } from "~/lib/setup";
import {
    DEFAULT_MODELS,
    DEFAULT_SETTINGS,
    FREE_SEARCH_MCP_PRESETS,
    PROJECT_COLORS,
    PROVIDER_DEFAULTS,
    type CustomSkill,
    type McpServerConfig,
    type ConnectorConfig,
    type ConnectorKind,
    type ModelInfo,
    type Project,
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
    getAllThreads,
    getMemoryEntries,
    getThreadMessages,
    saveMemoryEntries,
} from "~/lib/db";
import {
    aggregateUsage,
    formatCost,
    formatTokens,
    usageFromStoredMessage,
    type MessageUsageRecord,
    type UsageAggregate,
} from "~/lib/usage";
import {
    lookupInCatalog,
    useModelCatalog,
} from "~/lib/model-catalog-cache";
import { cn } from "~/lib/utils";
import { versionedAsset } from "~/lib/build";
import { localProviderKey } from "~/lib/provider-credentials";
import {
    CaretRight,
    ChatCircleDots,
    CheckCircle,
    Desktop,
    ChatText,
    Brain,
    Books,
    ChartBar,
    ArrowsClockwise,
    CloudArrowUp,
    DownloadSimple,
    Flask,
    Folder,
    FolderPlus,
    GearSix,
    Globe,
    HardDrives,
    Key,
    Lightning,
    Moon,
    Plus,
    Pencil,
    Plug,
    PlugsConnected,
    SpinnerGap,
    Sun,
    Trash,
    UploadSimple,
    MagnifyingGlass,
    Star,
    WarningCircle,
    XCircle,
} from "@phosphor-icons/react";
import {
    installBundledSkill,
    isSkillInstalled,
    searchBundledSkills,
    uninstallBundledSkill,
} from "~/lib/skills/catalog";
import type { PortableSkill } from "~/lib/skills/format";
import {
    TOKEN_MODE_DESCRIPTIONS,
    TOKEN_MODE_LABELS,
    type TokenMode,
} from "~/lib/token-mode";
import * as Switch from "@radix-ui/react-switch";
import {
    chatMarkdownFilename,
    chatToAiDiyJson,
    chatToMarkdown,
    downloadBlob,
    downloadTextFile,
    markdownBundleZip,
    safeFilename,
} from "~/lib/interop/exporters";
import { detectAndParseFile } from "~/lib/interop";
import { importChats } from "~/lib/interop/importer";
import type { ImportSummary } from "~/lib/interop/types";
import type {
    CloudBackupFile,
    CloudStorageConfig,
    GoogleDriveStorageConfig,
    S3StorageConfig,
    WebDAVStorageConfig,
} from "~/lib/cloud-storage/types";
import {
    backupKeyForNow,
    cloudConfigComplete,
} from "~/lib/cloud-storage/types";
import {
    cloudStorageError,
    downloadBackup,
    listCloudBackups,
    testCloudConnection,
    uploadBackup,
} from "~/lib/cloud-storage";

type SidebarPanel = "chats" | "settings";
type SettingsSection =
    | "keys"
    | "instructions"
    | "tokens"
    | "tools"
    | "mcp"
    | "connect"
    | "experimental"
    | "memory"
    | "knowledge"
    | "connectors"
    | "cloud"
    | "data"
    | "usage"
    | "appearance";

type ThreadItem = { id: string; title: string; projectId?: string | null };

export function AppSidebar({
    threads,
    projects,
    activeThreadId,
    onSelectThread,
    onNewChat,
    onDeleteThread,
    onRenameThread,
    onMoveThread,
    onCreateProject,
    onUpdateProject,
    onDeleteProject,
    panel,
    onPanelChange,
    onImportComplete,
}: {
    threads: ThreadItem[];
    projects: Project[];
    activeThreadId: string | null;
    onSelectThread: (id: string) => void;
    onNewChat: (projectId?: string | null) => void;
    onDeleteThread: (id: string) => void;
    onRenameThread: (id: string, title: string) => void;
    onMoveThread: (threadId: string, projectId: string | null) => void;
    onCreateProject: (name: string, color: string, instructions: string) => void;
    onUpdateProject: (id: string, patch: Partial<Project>) => void;
    onDeleteProject: (id: string) => void;
    panel: SidebarPanel;
    onPanelChange: (panel: SidebarPanel) => void;
    /** Called after an import writes new chats, so the list can refresh. */
    onImportComplete?: () => void;
}) {
    useCloudAutoBackup();

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
                <div className="flex items-center gap-2 min-w-0">
                    <img
                        src={versionedAsset("/ai-diy-mark.png")}
                        alt="ai.diy"
                        className="h-5 w-auto max-w-[7.5rem] object-contain object-left dark:hidden"
                    />
                    <img
                        src={versionedAsset("/ai-diy-mark-white.png")}
                        alt="ai.diy"
                        className="hidden h-5 w-auto max-w-[7.5rem] object-contain object-left dark:block"
                    />
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
                        projects={projects}
                        activeThreadId={activeThreadId}
                        onSelectThread={onSelectThread}
                        onNewChat={onNewChat}
                        onDeleteThread={onDeleteThread}
                        onRenameThread={onRenameThread}
                        onMoveThread={onMoveThread}
                        onCreateProject={onCreateProject}
                        onUpdateProject={onUpdateProject}
                        onDeleteProject={onDeleteProject}
                    />
                ) : (
                    <SettingsPanel onImportComplete={onImportComplete} />
                )}
            </div>
        </div>
    );
}

function ChatsPanel({
    threads,
    projects,
    activeThreadId,
    onSelectThread,
    onNewChat,
    onDeleteThread,
    onRenameThread,
    onMoveThread,
    onCreateProject,
    onUpdateProject,
    onDeleteProject,
}: {
    threads: ThreadItem[];
    projects: Project[];
    activeThreadId: string | null;
    onSelectThread: (id: string) => void;
    onNewChat: (projectId?: string | null) => void;
    onDeleteThread: (id: string) => void;
    onRenameThread: (id: string, title: string) => void;
    onMoveThread: (threadId: string, projectId: string | null) => void;
    onCreateProject: (name: string, color: string, instructions: string) => void;
    onUpdateProject: (id: string, patch: Partial<Project>) => void;
    onDeleteProject: (id: string) => void;
}) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draftTitle, setDraftTitle] = useState("");
    const cancelEditRef = useRef(false);
    const [creatingProject, setCreatingProject] = useState(false);
    const [newProjectName, setNewProjectName] = useState("");
    const [newProjectColor, setNewProjectColor] = useState<string>(PROJECT_COLORS[0]);
    const [newProjectInstructions, setNewProjectInstructions] = useState("");
    const [projectEditingId, setProjectEditingId] = useState<string | null>(null);
    const [projectDraftName, setProjectDraftName] = useState("");
    const [projectDraftColor, setProjectDraftColor] = useState<string>(PROJECT_COLORS[0]);
    const [projectDraftInstructions, setProjectDraftInstructions] = useState("");
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const [movingId, setMovingId] = useState<string | null>(null);
    const [exportMenu, setExportMenu] = useState<{
        id: string;
        x: number;
        y: number;
    } | null>(null);
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

    const beginProjectEdit = (project: Project) => {
        setProjectEditingId(project.id);
        setProjectDraftName(project.name);
        setProjectDraftColor(project.color);
        setProjectDraftInstructions(project.instructions ?? "");
    };

    const saveProjectEdit = (project: Project) => {
        const name = projectDraftName.trim();
        if (!name) return;
        onUpdateProject(project.id, {
            name,
            color: projectDraftColor,
            instructions: projectDraftInstructions.trim() || undefined,
        });
        setProjectEditingId(null);
    };

    const submitCreateProject = () => {
        const name = newProjectName.trim();
        if (!name) return;
        onCreateProject(name, newProjectColor, newProjectInstructions);
        setCreatingProject(false);
        setNewProjectName("");
        setNewProjectInstructions("");
    };

    const openExportMenu = (event: React.MouseEvent<HTMLButtonElement>, threadId: string) => {
        event.stopPropagation();
        hapticSelect();
        const rect = event.currentTarget.getBoundingClientRect();
        setExportMenu({ id: threadId, x: rect.right, y: rect.bottom + 4 });
    };

    const downloadThreadChat = async (threadId: string, format: "markdown" | "json") => {
        const list = await getAllThreads();
        const thread = list.find((t) => t.id === threadId);
        setExportMenu(null);
        if (!thread) return;
        const messages = await getThreadMessages(threadId);
        const chat = { thread, messages };
        if (format === "markdown") {
            downloadTextFile(chatMarkdownFilename(chat), chatToMarkdown(chat), "text/markdown");
        } else {
            downloadBlob(
                new Blob([chatToAiDiyJson(chat)], { type: "application/json" }),
                `${safeFilename(thread.title)}.json`,
            );
        }
        hapticConfirm();
    };

    const renderThreadRow = (thread: ThreadItem, isActive: boolean) => (
        <div
            key={thread.id}
            role="button"
            tabIndex={0}
            onClick={() => {
                if (movingId === thread.id) return;
                hapticSelect();
                onSelectThread(thread.id);
            }}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectThread(thread.id);
                }
            }}
            className={cn(
                "group flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium outline-none transition-colors",
                isActive
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
        >
            {editingId === thread.id ? (
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
                        finishEditing(thread);
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
                    aria-label={`Rename ${thread.title}`}
                />
            ) : movingId === thread.id ? (
                <select
                    autoFocus
                    value={thread.projectId ?? ""}
                    onChange={(e) => {
                        const value = e.target.value;
                        setMovingId(null);
                        hapticSelect();
                        onMoveThread(thread.id, value === "" ? null : value);
                    }}
                    onBlur={() => setMovingId(null)}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Escape") {
                            e.preventDefault();
                            setMovingId(null);
                        }
                    }}
                    className="min-w-0 flex-1 rounded border border-input bg-background px-1.5 py-0.5 text-xs text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    aria-label="Move chat to project"
                >
                    <option value="">No project</option>
                    {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                            {project.name}
                        </option>
                    ))}
                </select>
            ) : (
                <div className="flex min-w-0 items-center gap-2">
                    <ChatCircleDots size={14} className="shrink-0" />
                    <span className="truncate">{thread.title}</span>
                </div>
            )}
            {editingId !== thread.id && movingId !== thread.id ? (
                <>
                    <button
                        type="button"
                        onClick={(event) => openExportMenu(event, thread.id)}
                        className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity outline-none hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                        title="Export chat"
                        aria-label={`Export ${thread.title}`}
                    >
                        <DownloadSimple size={13} />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            hapticSelect();
                            setMovingId(thread.id);
                        }}
                        className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity outline-none hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                        title="Move to project"
                        aria-label={`Move ${thread.title} to a project`}
                    >
                        <FolderPlus size={13} />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            hapticSelect();
                            beginEditing(thread);
                        }}
                        className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity outline-none hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                        title="Rename chat"
                        aria-label={`Rename ${thread.title}`}
                    >
                        <Pencil size={13} />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            haptic();
                            onDeleteThread(thread.id);
                        }}
                        className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity outline-none hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                        title="Delete chat"
                        aria-label={`Delete ${thread.title}`}
                    >
                        <Trash size={13} />
                    </button>
                </>
            ) : null}
        </div>
    );

    const unassignedThreads = threads.filter((t) => !t.projectId);

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
                <div className="flex items-center justify-between px-1 pb-1">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Projects
                    </span>
                    <button
                        type="button"
                        onClick={() => {
                            hapticSelect();
                            setCreatingProject((v) => !v);
                        }}
                        className="rounded-md p-0.5 text-muted-foreground outline-none hover:text-foreground"
                        title="New project"
                        aria-label="New project"
                    >
                        <Plus size={14} />
                    </button>
                </div>

                {creatingProject ? (
                    <div className="flex flex-col gap-1.5 rounded-xl border border-primary/25 bg-primary/5 p-2">
                        <Input
                            autoFocus
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            placeholder="Project name"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    submitCreateProject();
                                } else if (e.key === "Escape") {
                                    e.preventDefault();
                                    setCreatingProject(false);
                                }
                            }}
                            className="h-8 rounded-lg text-xs"
                        />
                        <div className="flex flex-wrap items-center gap-1.5">
                            {PROJECT_COLORS.map((color) => (
                                <button
                                    type="button"
                                    key={color}
                                    onClick={() => setNewProjectColor(color)}
                                    className={cn(
                                        "size-4 rounded-full border-2 outline-none transition-transform",
                                        newProjectColor === color
                                            ? "scale-110 border-foreground"
                                            : "border-border/60 hover:scale-110",
                                    )}
                                    style={{ backgroundColor: color }}
                                    aria-label={`Project color ${color}`}
                                />
                            ))}
                        </div>
                        <textarea
                            value={newProjectInstructions}
                            onChange={(e) => setNewProjectInstructions(e.target.value)}
                            placeholder="Optional project instructions (applied to every chat in the project)"
                            rows={2}
                            className="w-full resize-y rounded-lg border border-border bg-background px-2 py-1.5 text-[10px] text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
                        />
                        <div className="flex gap-1.5">
                            <Button
                                type="button"
                                size="sm"
                                onClick={submitCreateProject}
                                className="h-7 rounded-lg text-[10px]"
                            >
                                Create
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setCreatingProject(false)}
                                className="h-7 rounded-lg text-[10px]"
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : null}

                {projects.length === 0 && !creatingProject ? (
                    <p className="px-1 py-1 text-[11px] text-muted-foreground/70">
                        Keep related chats together with projects.
                    </p>
                ) : null}

                {projects.map((project) => {
                    const isOpen = !collapsed[project.id];
                    const isActiveProject = projectEditingId === project.id;
                    const projectThreads = threads.filter(
                        (t) => t.projectId === project.id,
                    );
                    return (
                        <div key={project.id} className="flex flex-col gap-0.5">
                            <div className="group flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-xs font-semibold text-foreground hover:bg-accent/40">
                                <button
                                    type="button"
                                    onClick={() => {
                                        hapticSelect();
                                        setCollapsed((c) => ({
                                            ...c,
                                            [project.id]: !c[project.id],
                                        }));
                                    }}
                                    aria-label={isOpen ? "Collapse project" : "Expand project"}
                                    className="flex min-w-0 flex-1 items-center gap-1.5 outline-none"
                                >
                                    <CaretRight
                                        size={12}
                                        weight="bold"
                                        className={cn(
                                            "shrink-0 text-muted-foreground transition-transform",
                                            isOpen ? "rotate-90" : "",
                                        )}
                                    />
                                    <Folder
                                        size={15}
                                        weight="fill"
                                        className="shrink-0"
                                        color={project.color}
                                    />
                                    <span className="truncate">{project.name}</span>
                                    <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                                        {projectThreads.length}
                                    </span>
                                </button>
                                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 hover:opacity-100 group-hover:opacity-100">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            hapticSelect();
                                            onNewChat(project.id);
                                        }}
                                        className="rounded-md p-1 text-muted-foreground outline-none hover:text-foreground"
                                        title="New chat in this project"
                                        aria-label={`New chat in ${project.name}`}
                                    >
                                        <Plus size={12} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            hapticSelect();
                                            if (isActiveProject) {
                                                setProjectEditingId(null);
                                            } else {
                                                beginProjectEdit(project);
                                            }
                                        }}
                                        className="rounded-md p-1 text-muted-foreground outline-none hover:text-foreground"
                                        title="Edit project"
                                        aria-label={`Edit ${project.name}`}
                                    >
                                        <Pencil size={12} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            haptic();
                                            onDeleteProject(project.id);
                                        }}
                                        className="rounded-md p-1 text-muted-foreground outline-none hover:text-destructive"
                                        title="Delete project (chats become unassigned)"
                                        aria-label={`Delete ${project.name}`}
                                    >
                                        <Trash size={12} />
                                    </button>
                                </div>
                            </div>
                            {isActiveProject ? (
                                <div className="flex flex-col gap-1.5 rounded-lg border border-border/70 bg-muted/40 p-2">
                                    <Input
                                        autoFocus
                                        value={projectDraftName}
                                        onChange={(e) => setProjectDraftName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                saveProjectEdit(project);
                                            } else if (e.key === "Escape") {
                                                e.preventDefault();
                                                setProjectEditingId(null);
                                            }
                                        }}
                                        className="h-8 rounded-lg text-xs"
                                        aria-label="Project name"
                                    />
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {PROJECT_COLORS.map((color) => (
                                            <button
                                                type="button"
                                                key={color}
                                                onClick={() => setProjectDraftColor(color)}
                                                className={cn(
                                                    "size-4 rounded-full border-2 outline-none",
                                                    projectDraftColor === color
                                                        ? "border-foreground"
                                                        : "border-border/60",
                                                )}
                                                style={{ backgroundColor: color }}
                                                aria-label={`Project color ${color}`}
                                            />
                                        ))}
                                    </div>
                                    <textarea
                                        value={projectDraftInstructions}
                                        onChange={(e) =>
                                            setProjectDraftInstructions(e.target.value)
                                        }
                                        placeholder="Project instructions (applied to every chat in this project)"
                                        rows={2}
                                        className="w-full resize-y rounded-lg border border-border bg-background px-2 py-1.5 text-[10px] text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
                                    />
                                    <div className="flex gap-1.5">
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => saveProjectEdit(project)}
                                            className="h-7 rounded-lg text-[10px]"
                                        >
                                            Save
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setProjectEditingId(null)}
                                            className="h-7 rounded-lg text-[10px]"
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            ) : null}
                            {isOpen ? (
                                <div className="flex flex-col gap-0.5">
                                    {projectThreads.length === 0 ? (
                                        <p className="px-2 py-1.5 pl-7 text-[10px] text-muted-foreground/70">
                                            No chats in this project yet.
                                        </p>
                                    ) : (
                                        projectThreads.map((t) =>
                                            renderThreadRow(t, t.id === activeThreadId),
                                        )
                                    )}
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>

            <div className="flex flex-col gap-1">
                <div className="px-1 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Chats
                </div>
                {unassignedThreads.length === 0 ? (
                    projects.length > 0 ? (
                        <p className="px-1 py-2 text-[11px] text-muted-foreground/70">
                            All chats are in projects.
                        </p>
                    ) : (
                        <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                            No chats yet. Start a new thread.
                        </p>
                    )
                ) : (
                    unassignedThreads.map((t) =>
                        renderThreadRow(t, t.id === activeThreadId),
                    )
                )}
            </div>

            {exportMenu ? (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setExportMenu(null)}
                    />
                    <div
                        className="fixed z-50 flex min-w-44 flex-col gap-0.5 rounded-xl border border-border bg-popover p-1 shadow-lg"
                        style={{
                            left: Math.max(8, exportMenu.x - 184),
                            top: Math.min(
                                exportMenu.y,
                                window.innerHeight - 88,
                            ),
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => void downloadThreadChat(exportMenu.id, "markdown")}
                            className="rounded-lg px-2.5 py-1.5 text-left text-xs outline-none hover:bg-accent hover:text-foreground"
                        >
                            Export Markdown (.md)
                        </button>
                        <button
                            type="button"
                            onClick={() => void downloadThreadChat(exportMenu.id, "json")}
                            className="rounded-lg px-2.5 py-1.5 text-left text-xs outline-none hover:bg-accent hover:text-foreground"
                        >
                            Export ai.diy JSON
                        </button>
                    </div>
                </>
            ) : null}
        </div>
    );
}

function SettingsPanel({ onImportComplete }: { onImportComplete?: () => void }) {
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
    const [mcpConnectorId, setMcpConnectorId] = useState("");
    const [mcpError, setMcpError] = useState<string | null>(null);

    const sections: {
        id: SettingsSection;
        label: string;
        icon: typeof Key;
    }[] = [
        { id: "keys", label: "API Keys", icon: Key },
        { id: "instructions", label: "Instructions", icon: ChatText },
        { id: "tokens", label: "Tokens", icon: Lightning },
        { id: "tools", label: "Tools", icon: Globe },
        { id: "mcp", label: "MCP Beta", icon: Plug },
        { id: "connect", label: "Connect Beta", icon: PlugsConnected },
        { id: "experimental", label: "Experimental", icon: Flask },
        { id: "memory", label: "Memory Beta", icon: Brain },
        { id: "knowledge", label: "Knowledge Base", icon: Books },
        { id: "connectors", label: "Connectors Beta", icon: HardDrives },
        { id: "cloud", label: "Cloud Storage Beta", icon: CloudArrowUp },
        { id: "data", label: "Import & Export", icon: UploadSimple },
        { id: "usage", label: "Usage & cost", icon: ChartBar },
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
            vercelAuth: mcpConnectorId.trim()
                ? { connectorId: mcpConnectorId.trim() }
                : undefined,
            enabled: true,
        };
        addMcpServer(newServer);
        setMcpName("");
        setMcpUrl("");
        setMcpHeaders("");
        setMcpConnectorId("");
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

            {section === "instructions" && <CustomInstructionsSection />}

            {section === "tokens" && <TokenModeSettingsSection />}

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
                    <FreeSearchMcpSection />
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
                            value={mcpConnectorId}
                            onChange={(event) => setMcpConnectorId(event.target.value)}
                            placeholder="Vercel Connect connector (optional, e.g. scl_…)"
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
                                    {s.vercelAuth ? (
                                        <ConnectAuthControl
                                            connectorId={s.vercelAuth.connectorId}
                                        />
                                    ) : null}
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

            {section === "connect" && <ConnectedAppsSection />}

            {section === "experimental" && (
                <div className="flex flex-col gap-3">
                    <SubagentsSettingsSection />
                    <PreviewSettingsSection />
                </div>
            )}

            {section === "memory" && <MemorySettingsSection />}

            {section === "knowledge" && <KnowledgeSettingsSection />}

            {section === "connectors" && <ConnectorsSection />}

            {section === "cloud" && (
                <CloudStorageSection onImportComplete={onImportComplete} />
            )}

            {section === "data" && <DataInteropSection onImportComplete={onImportComplete} />}

            {section === "usage" && <UsageSection />}

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

function CustomInstructionsSection() {
    const { settings, updateChat } = useSettings();
    const value = settings.chat.systemPrompt ?? "";
    const maxChars = 4_000;

    return (
        <div className="flex flex-col gap-3">
            <div>
                <h3 className="text-xs font-semibold">Custom instructions</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    These supplement ai.diy&apos;s default system prompt. They do
                    not replace tool, safety, or active skill instructions.
                    Applied to every chat.
                </p>
            </div>
            <textarea
                value={value}
                onChange={(event) =>
                    updateChat({
                        systemPrompt: event.target.value.slice(0, maxChars),
                    })
                }
                placeholder="e.g. Prefer concise answers. Always cite retrieved URLs. Address me as Nirneet."
                rows={8}
                maxLength={maxChars}
                className="h-auto min-h-32 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-xs leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Custom system instructions"
            />
            <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] tabular-nums text-muted-foreground">
                    {value.length.toLocaleString()} / {maxChars.toLocaleString()}
                </p>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!value.trim()}
                    onClick={() => updateChat({ systemPrompt: "" })}
                    className="rounded-lg"
                >
                    Clear
                </Button>
            </div>
        </div>
    );
}

function TokenModeSettingsSection() {
    const { settings, updateSettings } = useSettings();
    const current = (settings.tokenMode ?? "balanced") as TokenMode;
    const modes: TokenMode[] = ["efficient", "balanced", "caching", "full"];

    return (
        <div className="flex flex-col gap-3">
            <div>
                <h3 className="text-xs font-semibold">Token mode</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Controls system-prompt size, tool suite, step budget, and
                    optional prompt caching. Default is Balanced. You can also
                    change this from the TTFT / t/s / tok chip on any assistant
                    message.
                </p>
            </div>
            <div
                className="flex flex-col gap-0.5 rounded-2xl border border-border/70 bg-muted/20 p-1.5"
                role="radiogroup"
                aria-label="Token mode"
            >
                {modes.map((mode) => {
                    const selected = current === mode;
                    return (
                        <button
                            key={mode}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => {
                                hapticSelect();
                                updateSettings({ tokenMode: mode });
                            }}
                            className={cn(
                                "flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                                selected
                                    ? "bg-foreground/[0.07]"
                                    : "hover:bg-muted/50",
                            )}
                        >
                            <span
                                className={cn(
                                    "mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full border",
                                    selected
                                        ? "border-foreground/80 bg-foreground text-background"
                                        : "border-border/80",
                                )}
                                aria-hidden
                            >
                                {selected ? (
                                    <CheckCircle size={10} weight="fill" />
                                ) : null}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1.5">
                                    <span className="text-xs font-semibold">
                                        {TOKEN_MODE_LABELS[mode]}
                                    </span>
                                    {mode === "balanced" ? (
                                        <span className="rounded-full bg-muted/80 px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wide text-muted-foreground">
                                            default
                                        </span>
                                    ) : null}
                                </span>
                                <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                                    {TOKEN_MODE_DESCRIPTIONS[mode]}
                                </p>
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function KnowledgeSettingsSection() {
    const { settings, updateSettings } = useSettings();
    const knowledgeEnabled = settings.knowledgeEnabled !== false;
    const [docs, setDocs] = useState<
        Array<{ id: string; name: string; chunkCount: number }>
    >([]);
    const [status, setStatus] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const refresh = useCallback(() => {
        void import("~/lib/knowledge/store.client").then(({ listKnowledgeDocuments }) =>
            listKnowledgeDocuments().then((list) =>
                setDocs(
                    list.map((d) => ({
                        id: d.id,
                        name: d.name,
                        chunkCount: d.chunkCount,
                    })),
                ),
            ),
        );
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const ingest = async (file: File) => {
        setBusy(true);
        setStatus("Indexing on-device (first run downloads the embedding model)…");
        try {
            const { ingestTextFile } = await import("~/lib/knowledge/store.client");
            const doc = await ingestTextFile(file);
            setStatus(`Indexed ${doc.name} (${doc.chunkCount} chunks). Embeddings stay in this browser.`);
            refresh();
        } catch (error) {
            setStatus(error instanceof Error ? error.message : "Ingest failed.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <ToolToggle
                title="Local knowledge base"
                description={
                    knowledgeEnabled
                        ? "Private WASM embeddings + HNSW search over uploaded notes. Nothing is sent to embedding APIs."
                        : "Knowledge tools and auto-retrieval are off."
                }
                checked={knowledgeEnabled}
                onChange={(value) => updateSettings({ knowledgeEnabled: value })}
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
                Upload text, Markdown, JSON, or CSV. PDFs work best when exported as text.
                Vectors are stored in IndexedDB; the MiniLM model caches in the browser.
            </p>
            <label className="inline-flex h-8 w-fit cursor-pointer items-center rounded-xl border border-border px-3 text-xs font-medium hover:bg-accent">
                {busy ? "Indexing…" : "Upload document"}
                <input
                    type="file"
                    accept=".txt,.md,.markdown,.json,.csv,.tsv,text/plain,text/markdown,application/json"
                    className="sr-only"
                    disabled={busy}
                    onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void ingest(file);
                        event.currentTarget.value = "";
                    }}
                />
            </label>
            {docs.length > 0 ? (
                <ul className="space-y-2 text-[11px]">
                    {docs.map((doc) => (
                        <li
                            key={doc.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-2"
                        >
                            <span className="truncate text-foreground">
                                {doc.name}{" "}
                                <span className="text-muted-foreground">
                                    ({doc.chunkCount})
                                </span>
                            </span>
                            <button
                                type="button"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                    void import("~/lib/knowledge/store.client").then(
                                        ({ removeKnowledgeDocument }) =>
                                            removeKnowledgeDocument(doc.id).then(refresh),
                                    );
                                }}
                            >
                                Remove
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-[11px] text-muted-foreground">No documents indexed yet.</p>
            )}
            {docs.length > 0 ? (
                <button
                    type="button"
                    className="text-left text-[11px] text-muted-foreground hover:text-destructive"
                    onClick={() => {
                        if (!window.confirm("Clear the entire local knowledge base?")) return;
                        void import("~/lib/knowledge/store.client").then(({ wipeKnowledgeBase }) =>
                            wipeKnowledgeBase().then(() => {
                                refresh();
                                setStatus("Knowledge base cleared.");
                            }),
                        );
                    }}
                >
                    Clear knowledge base
                </button>
            ) : null}
            {status ? (
                <p className="text-[11px] text-muted-foreground">{status}</p>
            ) : null}
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

const FREE_SEARCH_MCP_DETAILS: Record<
    string,
    { description: string; tools: string }
> = {
    mcp_parallel_search: {
        description: "Free web search and page fetch, no API key required. A saved Parallel connector key is attached automatically for higher rate limits.",
        tools: "web_search · web_fetch",
    },
    mcp_firecrawl_keyless: {
        description: "Free rate-limited web search, scrape, and parse. No API key required.",
        tools: "firecrawl_search · firecrawl_scrape · firecrawl_parse",
    },
};

function ConnectAuthControl({ connectorId }: { connectorId: string }) {
    const [state, setState] = useState<
        "idle" | "checking" | "ok" | "needs-auth" | "error"
    >("idle");
    const [detail, setDetail] = useState("");
    const [busy, setBusy] = useState(false);

    const check = async () => {
        setState("checking");
        setDetail("");
        try {
            const result = await connectTest(connectorId);
            if (result.ok) {
                setState("ok");
            } else if (result.kind === "authorization-required") {
                setState("needs-auth");
                setDetail("");
            } else {
                setState("error");
                setDetail(result.message || "Token minting failed.");
            }
        } catch (err) {
            setState("error");
            setDetail(err instanceof Error ? err.message : "Check failed.");
        }
    };

    const authorize = async () => {
        setBusy(true);
        try {
            const result = await connectAuthorize(connectorId);
            if (result.ok) {
                window.open(result.url, "_blank", "noopener,noreferrer,width=640,height=760");
                setState("needs-auth");
                setDetail("");
            } else {
                setState("error");
                setDetail(result.error);
            }
        } catch (err) {
            setState("error");
            setDetail(err instanceof Error ? err.message : "Authorization failed.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex flex-wrap items-center gap-1 pt-1">
            <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                <PlugsConnected size={10} />
                Connect · {connectorId}
            </span>
            {state === "ok" ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-500">
                    <CheckCircle size={10} />
                    Authorized
                </span>
            ) : null}
            {state === "needs-auth" ? (
                <button
                    type="button"
                    onClick={() => void authorize()}
                    disabled={busy}
                    className="rounded-md bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground outline-none disabled:opacity-50"
                >
                    {busy ? "Opening…" : "Authorize"}
                </button>
            ) : null}
            {state === "error" ? (
                <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[9px] font-medium text-destructive">
                    Error
                </span>
            ) : null}
            <button
                type="button"
                onClick={() => void check()}
                disabled={state === "checking"}
                className="rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
                {state === "checking" ? "Checking…" : "Test"}
            </button>
            {detail ? <span className="text-[9px] text-muted-foreground">{detail}</span> : null}
        </div>
    );
}

function ConnectedAppsSection() {
    const [available, setAvailable] = useState<boolean | null>(null);
    const [connectors, setConnectors] = useState<ConnectConnectorEntryLite[]>([]);
    const [busy, setBusy] = useState<string | null>(null);
    const [messages, setMessages] = useState<Record<string, string>>({});

    const load = useCallback(async () => {
        try {
            const result = await connectList();
            setAvailable(result.available);
            setConnectors(result.connectors);
        } catch (err) {
            setAvailable(false);
            setMessages({
                _global:
                    err instanceof Error ? err.message : "Could not load Vercel Connect status.",
            });
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const test = async (entry: ConnectConnectorEntryLite) => {
        setBusy(entry.key);
        try {
            const result = await connectTest(entry.connectorId, entry.scopes);
            setMessages({
                ...messages,
                [entry.key]: result.ok
                    ? `OK — token valid until ${new Date(result.expiresAt).toLocaleString()}.`
                    : `${result.message}${result.authorizeUrl ? " Authorization URL ready — click Authorize." : ""}`,
            });
        } catch (err) {
            setMessages({
                ...messages,
                [entry.key]: err instanceof Error ? err.message : "Test failed.",
            });
        } finally {
            setBusy(null);
        }
    };

    const authorize = async (entry: ConnectConnectorEntryLite) => {
        setBusy(entry.key);
        try {
            const result = await connectAuthorize(entry.connectorId, entry.scopes);
            if (result.ok) {
                window.open(result.url, "_blank", "noopener,noreferrer,width=640,height=760");
                setMessages({
                    ...messages,
                    [entry.key]: "Consent window opened — complete it, then run Test.",
                });
            } else {
                setMessages({ ...messages, [entry.key]: result.error });
            }
        } catch (err) {
            setMessages({
                ...messages,
                [entry.key]: err instanceof Error ? err.message : "Authorization failed.",
            });
        } finally {
            setBusy(null);
        }
    };

    if (available === null) {
        return (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <SpinnerGap size={12} className="animate-spin" />
                Checking Vercel Connect…
            </div>
        );
    }

    if (!available) {
        return (
            <div className="flex flex-col gap-1.5 rounded-xl border border-border/70 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">Vercel Connect is not configured here</span>
                Deployed on Vercel: tokens are injected automatically (OIDC). Self-hosted:
                set <code className="rounded bg-muted px-1 text-[10px]">VERCEL_TOKEN</code> and declare
                connectors via <code className="rounded bg-muted px-1 text-[10px]">CONNECT_CONNECTOR_&lt;KEY&gt;</code>.
                {messages._global ? <span className="text-destructive">{messages._global}</span> : null}
            </div>
        );
    }

    if (connectors.length === 0) {
        return (
            <div className="flex flex-col gap-1.5 rounded-xl border border-border/70 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">No connectors configured</span>
                Add <code className="rounded bg-muted px-1 text-[10px]">CONNECT_CONNECTOR_&lt;KEY&gt;=scl_…</code> to your
                environment (optionally <code className="rounded bg-muted px-1 text-[10px]">CONNECT_BASE_URL_&lt;KEY&gt;</code>{" "}
                and <code className="rounded bg-muted px-1 text-[10px]">CONNECT_SCOPES_&lt;KEY&gt;</code>), then restart.
                You can also use a connector directly on an MCP server (Settings → MCP Beta).
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
                App-scoped connectors declared in the environment. Authorize each
                connector once, then the model can act on the service and protected
                MCP servers can request tokens automatically.
            </p>
            {connectors.map((entry) => (
                <div
                    key={entry.key}
                    className="flex flex-col gap-1.5 rounded-xl border border-border/70 p-2.5"
                >
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <div className="truncate text-xs font-semibold">
                                {entry.key}
                            </div>
                            <div className="truncate text-[10px] text-muted-foreground">
                                {entry.connectorId}
                                {entry.baseUrl ? ` · ${entry.baseUrl}` : ""}
                                {entry.scopes?.length ? ` · scopes: ${entry.scopes.join(" ")}` : ""}
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                            <button
                                type="button"
                                onClick={() => void test(entry)}
                                disabled={busy === entry.key}
                                className="rounded-md bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground disabled:opacity-50"
                            >
                                {busy === entry.key ? "Testing…" : "Test"}
                            </button>
                            <button
                                type="button"
                                onClick={() => void authorize(entry)}
                                disabled={busy === entry.key}
                                className="rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground outline-none hover:opacity-90 disabled:opacity-50"
                            >
                                {busy === entry.key ? "Working…" : "Authorize"}
                            </button>
                        </div>
                    </div>
                    {messages[entry.key] ? (
                        <p className="text-[10px] leading-relaxed text-muted-foreground">
                            {messages[entry.key]}
                        </p>
                    ) : null}
                </div>
            ))}
        </div>
    );
}

function FreeSearchMcpSection() {
    const { settings, addMcpServer, removeMcpServer } = useSettings();

    const addPreset = (preset: (typeof FREE_SEARCH_MCP_PRESETS)[number]) => {
        const parallelKey = settings.connectors.find(
            (connector) =>
                connector.kind === "parallel" &&
                Boolean(connector.apiKey?.trim()),
        )?.apiKey;
        const headers =
            preset.id === "mcp_parallel_search" && parallelKey
                ? { Authorization: `Bearer ${parallelKey}` }
                : undefined;
        hapticConfirm();
        addMcpServer({ ...preset, id: `mcp_${Date.now()}`, headers });
    };

    return (
        <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 p-2.5">
            <span className="text-[11px] font-semibold">Free search MCPs</span>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
                Free hosted web search for the model, no API key. When enabled,
                these are preferred over the built-in DuckDuckGo search.
            </p>
            {FREE_SEARCH_MCP_PRESETS.map((preset) => {
                const added = settings.mcpServers.some(
                    (server) => server.url === preset.url,
                );
                const details = FREE_SEARCH_MCP_DETAILS[preset.id];
                return (
                    <div
                        key={preset.id}
                        className="flex flex-col gap-1 rounded-xl border border-border/70 bg-background p-2.5"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold">{preset.name}</span>
                            <button
                                type="button"
                                onClick={() => {
                                    hapticSelect();
                                    if (added) {
                                        const existing = settings.mcpServers.find(
                                            (server) => server.url === preset.url,
                                        );
                                        if (existing) removeMcpServer(existing.id);
                                    } else {
                                        addPreset(preset);
                                    }
                                }}
                                className={cn(
                                    "rounded-md px-2 py-1 text-[10px] font-medium outline-none",
                                    added
                                        ? "bg-primary/15 text-primary"
                                        : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
                                )}
                            >
                                {added ? "Added" : "Add"}
                            </button>
                        </div>
                        <p className="text-[10px] leading-relaxed text-muted-foreground">
                            {details.description}
                        </p>
                        <p className="text-[10px] text-muted-foreground/80">
                            Tools: {details.tools}
                        </p>
                        <p className="truncate text-[9px] text-muted-foreground/60">
                            {preset.url}
                        </p>
                    </div>
                );
            })}
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

function DataInteropSection({ onImportComplete }: { onImportComplete?: () => void }) {
    const [preview, setPreview] = useState<ImportSummary | null>(null);
    const [fileName, setFileName] = useState("");
    const [status, setStatus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const handleFile = async (file: File) => {
        setError(null);
        setStatus(null);
        setPreview(null);
        setFileName("");
        setBusy(true);
        try {
            const result = await detectAndParseFile(file);
            if (result.chats.length === 0) {
                setError("No importable chats found in this file.");
                return;
            }
            setPreview(result);
            setFileName(file.name);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Import failed.");
        } finally {
            setBusy(false);
        }
    };

    const runImport = async () => {
        if (!preview || preview.chats.length === 0) return;
        setBusy(true);
        setError(null);
        try {
            const result = await importChats(preview);
            setStatus(
                `Imported ${result.chats} chat${result.chats === 1 ? "" : "s"} with ${result.messages} messages.`,
            );
            setPreview(null);
            setFileName("");
            onImportComplete?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Import failed.");
        } finally {
            setBusy(false);
        }
    };

    const exportMarkdownBundle = async () => {
        setError(null);
        setStatus(null);
        try {
            const threads = await getAllThreads();
            const chats = [];
            for (const thread of threads) {
                const messages = await getThreadMessages(thread.id);
                chats.push({ thread, messages });
            }
            if (chats.length === 0) {
                setStatus("No chats to export yet.");
                return;
            }
            downloadBlob(
                new Blob([markdownBundleZip(chats)], { type: "application/zip" }),
                `ai-diy-chats-${new Date().toISOString().slice(0, 10)}.zip`,
            );
            setStatus(`Exported ${chats.length} chat${chats.length === 1 ? "" : "s"} as Markdown.`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Export failed.");
        }
    };

    const messageCount = preview
        ? preview.chats.reduce((total, chat) => total + chat.messages.length, 0)
        : 0;

    return (
        <div className="flex flex-col gap-3">
            <div>
                <h3 className="text-xs font-semibold">Import &amp; export</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Bring chats in from ChatGPT, Claude, ShareGPT, or Markdown, and
                    export your chats as Markdown or ai.diy JSON. Everything runs
                    locally in this browser; nothing is uploaded.
                </p>
            </div>

            <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        fileInputRef.current?.click();
                    }
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) void handleFile(file);
                }}
                className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-3 py-5 text-center text-[11px] outline-none transition-colors",
                    dragActive
                        ? "border-primary/60 bg-primary/5 text-foreground"
                        : "border-border/80 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
            >
                <UploadSimple size={18} />
                <span>
                    {busy ? "Analyzing file…" : "Drop a file here or click to choose"}
                </span>
                <span className="text-[10px] text-muted-foreground/80">
                    ChatGPT/Claude ZIP, ai.diy JSON, ShareGPT JSONL, or Markdown
                </span>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip,.json,.jsonl,.md,application/json,text/markdown"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleFile(file);
                        e.target.value = "";
                    }}
                />
            </div>

            {preview ? (
                <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <p className="truncate text-[11px] font-semibold text-foreground">
                                {fileName}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                                {preview.formatLabel} — {preview.chats.length} chat
                                {preview.chats.length === 1 ? "" : "s"}, {messageCount} message
                                {messageCount === 1 ? "" : "s"}
                            </p>
                        </div>
                        <CheckCircle size={16} className="shrink-0 text-primary" />
                    </div>
                    {preview.notes.length > 0 ? (
                        <ul className="list-inside list-disc text-[10px] text-muted-foreground">
                            {preview.notes.slice(0, 4).map((note, index) => (
                                <li key={index}>{note}</li>
                            ))}
                        </ul>
                    ) : null}
                    <p className="text-[10px] leading-relaxed text-muted-foreground">
                        Imports create new chats; existing chats are never modified.
                    </p>
                    <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => void runImport()}
                        className="self-start rounded-xl"
                    >
                        Import {preview.chats.length} chat{preview.chats.length === 1 ? "" : "s"}
                    </Button>
                </div>
            ) : null}

            {status ? (
                <p className="text-[11px] text-primary">{status}</p>
            ) : null}
            {error ? (
                <p className="flex items-start gap-1 text-[11px] leading-relaxed text-destructive">
                    <WarningCircle size={13} className="mt-0.5 shrink-0" />
                    {error}
                </p>
            ) : null}

            <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-[10px] leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Exporting:</strong> hover a chat
                in the list and use the download icon to export it as Markdown or
                ai.diy JSON. The ai.diy JSON backup from Cloud Storage can also be
                imported here to restore chats on another device or browser.
            </div>
            <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void exportMarkdownBundle()}
                className="self-start rounded-xl"
            >
                Export all chats as Markdown (ZIP)
            </Button>
        </div>
    );
}

function useCloudAutoBackup() {
    const { settings, updateSettings } = useSettings();
    const busyRef = useRef(false);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        const runBackup = async () => {
            const cfg = settings.cloudStorage;
            if (
                !cfg.autoBackup ||
                !cloudConfigComplete(cfg) ||
                busyRef.current
            ) {
                return;
            }
            busyRef.current = true;
            try {
                const backup = await exportLocalBackup();
                const key = backupKeyForNow(cfg);
                await uploadBackup(cfg, key, JSON.stringify(backup));
                updateSettings({
                    cloudStorage: {
                        ...cfg,
                        lastBackupAt: new Date().toISOString(),
                    },
                });
            } catch (err) {
                console.error("[cloud:auto-backup]", err);
            } finally {
                busyRef.current = false;
            }
        };
        const onChange = () => {
            if (timerRef.current != null) window.clearTimeout(timerRef.current);
            timerRef.current = window.setTimeout(() => void runBackup(), 30_000);
        };
        window.addEventListener("ai-diy:chats-changed", onChange);
        return () => {
            window.removeEventListener("ai-diy:chats-changed", onChange);
            if (timerRef.current != null) window.clearTimeout(timerRef.current);
        };
    }, [settings.cloudStorage, updateSettings]);
}

function CloudStorageSection({
    onImportComplete,
}: {
    onImportComplete?: () => void;
}) {
    const { settings, updateSettings } = useSettings();
    const cfg = settings.cloudStorage;
    const [status, setStatus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [backups, setBackups] = useState<CloudBackupFile[] | null>(null);

    const patch = (patch: Partial<CloudStorageConfig>) =>
        updateSettings({ cloudStorage: { ...cfg, ...patch } });
    const patchS3 = (patch: Partial<S3StorageConfig>) =>
        updateSettings({
            cloudStorage: {
                ...cfg,
                s3: { ...cfg.s3, ...patch } as S3StorageConfig,
            },
        });
    const patchWebDAV = (patch: Partial<WebDAVStorageConfig>) =>
        updateSettings({
            cloudStorage: {
                ...cfg,
                webdav: { ...cfg.webdav, ...patch } as WebDAVStorageConfig,
            },
        });
    const patchGDrive = (patch: Partial<GoogleDriveStorageConfig>) =>
        updateSettings({
            cloudStorage: {
                ...cfg,
                gdrive: { ...cfg.gdrive, ...patch } as GoogleDriveStorageConfig,
            },
        });

    const run = async (fn: () => Promise<void>) => {
        setBusy(true);
        setError(null);
        setStatus(null);
        try {
            await fn();
        } catch (err) {
            setError(cloudStorageError(err));
        } finally {
            setBusy(false);
        }
    };

    const testConnection = () =>
        run(async () => {
            await testCloudConnection(cfg);
            setStatus("Connected to storage.");
        });

    const backupNow = () =>
        run(async () => {
            const backup = await exportLocalBackup();
            const key = backupKeyForNow(cfg);
            await uploadBackup(cfg, key, JSON.stringify(backup));
            setStatus(`Backed up ${backup.threads.length} chats to ${key}.`);
            patch({ lastBackupAt: new Date().toISOString() });
        });

    const restoreBackup = (item: CloudBackupFile) =>
        run(async () => {
            const text = await downloadBackup(cfg, item);
            const summary = await detectAndParseFile(
                new File([text], item.key.split("/").pop() ?? "backup.json"),
            );
            if (summary.chats.length === 0) {
                throw new Error("No importable chats found in this backup.");
            }
            const result = await importChats(summary);
            setStatus(
                `Restored ${result.chats} chat${
                    result.chats === 1 ? "" : "s"
                } with ${result.messages} messages.`,
            );
            onImportComplete?.();
        });

    const listBackups = () =>
        run(async () => {
            const items = await listCloudBackups(cfg);
            setBackups(items);
            setStatus(
                items.length === 0
                    ? "No backups found yet."
                    : `${items.length} backup${items.length === 1 ? "" : "s"} found.`,
            );
        });

    return (
        <div className="flex flex-col gap-3">
            <div>
                <h3 className="text-xs font-semibold">
                    Cloud storage{" "}
                    <span className="text-[9px] uppercase tracking-wider text-primary">
                        Beta
                    </span>
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Back up and restore all chats from the storage provider of
                    your choice. Credentials are stored only in this browser,
                    never on a server — requests go directly from your device
                    to your storage endpoint.
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
                {(["none", "s3", "webdav", "gdrive"] as const).map((kind) => (
                    <button
                        key={kind}
                        type="button"
                        onClick={() => {
                            hapticSelect();
                            patch({ kind });
                            setStatus(null);
                            setError(null);
                        }}
                        className={cn(
                            "rounded-lg border px-2.5 py-1 text-[11px] font-medium outline-none transition-colors",
                            cfg.kind === kind
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border/70 text-muted-foreground hover:bg-muted/40",
                        )}
                    >
                        {kind === "none"
                            ? "Off"
                            : kind === "s3"
                              ? "S3-compatible"
                              : kind === "webdav"
                                ? "WebDAV"
                                : "Google Drive"}
                    </button>
                ))}
            </div>

            {cfg.kind === "s3" ? (
                <div className="flex flex-col gap-2">
                    <label className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground">
                            Endpoint
                        </span>
                        <Input
                            value={cfg.s3?.endpoint ?? ""}
                            onChange={(e) => patchS3({ endpoint: e.target.value })}
                            placeholder="https://s3.us-east-1.amazonaws.com"
                            className="h-8 text-xs"
                        />
                    </label>
                    <div className="flex gap-2">
                        <label className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="text-[10px] text-muted-foreground">
                                Region
                            </span>
                            <Input
                                value={cfg.s3?.region ?? ""}
                                onChange={(e) => patchS3({ region: e.target.value })}
                                placeholder="us-east-1"
                                className="h-8 text-xs"
                            />
                        </label>
                        <label className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="text-[10px] text-muted-foreground">
                                Bucket
                            </span>
                            <Input
                                value={cfg.s3?.bucket ?? ""}
                                onChange={(e) => patchS3({ bucket: e.target.value })}
                                placeholder="my-backups"
                                className="h-8 text-xs"
                            />
                        </label>
                    </div>
                    <div className="flex gap-2">
                        <label className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="text-[10px] text-muted-foreground">
                                Access key ID
                            </span>
                            <Input
                                value={cfg.s3?.accessKeyId ?? ""}
                                onChange={(e) => patchS3({ accessKeyId: e.target.value })}
                                placeholder="AKIA…"
                                autoComplete="off"
                                className="h-8 text-xs"
                            />
                        </label>
                        <label className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="text-[10px] text-muted-foreground">
                                Secret key
                            </span>
                            <Input
                                type="password"
                                value={cfg.s3?.secretAccessKey ?? ""}
                                onChange={(e) => patchS3({ secretAccessKey: e.target.value })}
                                placeholder="••••••••"
                                autoComplete="new-password"
                                className="h-8 text-xs"
                            />
                        </label>
                    </div>
                    <label className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground">
                            Folder prefix (optional)
                        </span>
                        <Input
                            value={cfg.s3?.prefix ?? ""}
                            onChange={(e) => patchS3({ prefix: e.target.value })}
                            placeholder="ai-diy"
                            className="h-8 text-xs"
                        />
                    </label>
                    <p className="text-[10px] leading-relaxed text-muted-foreground">
                        Works with AWS S3, Cloudflare R2, MinIO, Backblaze B2,
                        and Wasabi. R2 example:{" "}
                        <code className="text-[9px]">
                          https://&lt;accountid&gt;.r2.cloudflarestorage.com
                        </code>
                    </p>
                </div>
            ) : null}

            {cfg.kind === "webdav" ? (
                <div className="flex flex-col gap-2">
                    <label className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground">
                            Server URL
                        </span>
                        <Input
                            value={cfg.webdav?.url ?? ""}
                            onChange={(e) => patchWebDAV({ url: e.target.value })}
                            placeholder="https://cloud.example.com/remote.php/dav/files/me"
                            className="h-8 text-xs"
                        />
                    </label>
                    <div className="flex gap-2">
                        <label className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="text-[10px] text-muted-foreground">
                                Username
                            </span>
                            <Input
                                value={cfg.webdav?.username ?? ""}
                                onChange={(e) => patchWebDAV({ username: e.target.value })}
                                autoComplete="off"
                                className="h-8 text-xs"
                            />
                        </label>
                        <label className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="text-[10px] text-muted-foreground">
                                Password
                            </span>
                            <Input
                                type="password"
                                value={cfg.webdav?.password ?? ""}
                                onChange={(e) => patchWebDAV({ password: e.target.value })}
                                autoComplete="new-password"
                                className="h-8 text-xs"
                            />
                        </label>
                    </div>
                    <label className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground">
                            Folder prefix (optional)
                        </span>
                        <Input
                            value={cfg.webdav?.prefix ?? ""}
                            onChange={(e) => patchWebDAV({ prefix: e.target.value })}
                            placeholder="ai-diy"
                            className="h-8 text-xs"
                        />
                    </label>
                    <p className="text-[10px] leading-relaxed text-muted-foreground">
                        Works with Nextcloud, ownCloud, Box, and any WebDAV
                        server. Use an app password where available.
                    </p>
                </div>
            ) : null}

            {cfg.kind === "gdrive" ? (
                <div className="flex flex-col gap-2">
                    <label className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground">
                            Google Cloud service-account key (JSON)
                        </span>
                        <textarea
                            value={cfg.gdrive?.keyJson ?? ""}
                            onChange={(e) =>
                                patchGDrive({ keyJson: e.target.value })
                            }
                            placeholder='{"type":"service_account","client_email":"…","private_key":"-----BEGIN PRIVATE KEY-----…"}'
                            spellCheck={false}
                            autoComplete="off"
                            rows={5}
                            style={{ resize: "vertical" }}
                            className="w-full rounded-xl border border-input bg-background px-2.5 py-2 font-mono text-[10px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-ring"
                        />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground">
                            Backup folder name (optional)
                        </span>
                        <Input
                            value={cfg.gdrive?.prefix ?? ""}
                            onChange={(e) =>
                                patchGDrive({ prefix: e.target.value })
                            }
                            placeholder="ai-diy-backups"
                            className="h-8 text-xs"
                        />
                    </label>
                    <p className="text-[10px] leading-relaxed text-muted-foreground">
                        Get a key in the Google Cloud console: IAM &amp; Admin →{" "}
                        Service accounts → Keys → Add key (JSON). Enable the
                        Google Drive API for the project. To sync with a
                        personal account, create the folder there and share it
                        with the service account&apos;s email. The key signs a
                        short-lived token in your browser and is never sent to
                        any server but Google&apos;s token endpoint.
                    </p>
                </div>
            ) : null}

            {cfg.kind !== "none" ? (
                <>
                    <div className="flex flex-wrap gap-1.5">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy || !cloudConfigComplete(cfg)}
                            onClick={() => void testConnection()}
                            className="rounded-xl"
                        >
                            {busy ? (
                                <SpinnerGap size={12} className="animate-spin" />
                            ) : null}
                            Test connection
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            disabled={busy || !cloudConfigComplete(cfg)}
                            onClick={() => void backupNow()}
                            className="rounded-xl"
                        >
                            Back up now
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy || !cloudConfigComplete(cfg)}
                            onClick={() => void listBackups()}
                            className="rounded-xl"
                        >
                            List backups
                        </Button>
                    </div>

                    <div className="flex items-center justify-between gap-2 rounded-xl border border-border/70 p-2.5">
                        <div>
                            <div className="text-[11px] font-medium">
                                Auto-backup
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                                Upload 30s after chat changes
                            </div>
                        </div>
                        <Switch.Root
                            checked={cfg.autoBackup}
                            onCheckedChange={(v) => {
                                hapticSelect();
                                patch({ autoBackup: v });
                            }}
                            className="relative h-5 w-9 shrink-0 rounded-full bg-muted transition-colors outline-none data-[state=checked]:bg-primary"
                        >
                            <Switch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white transition-transform data-[state=checked]:translate-x-4" />
                        </Switch.Root>
                    </div>
                </>
            ) : null}

            {backups && backups.length > 0 ? (
                <div className="flex flex-col gap-1">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Backups on storage
                    </h4>
                    {backups.slice(0, 5).map((backup) => (
                        <div
                            key={backup.key}
                            className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-1.5 text-[11px]"
                        >
                            <div className="min-w-0">
                                <div className="truncate font-medium">
                                    {backup.key.split("/").pop()}
                                </div>
                                <div className="truncate text-[10px] text-muted-foreground">
                                    {(backup.size / 1024).toFixed(1)} KiB
                                    {backup.modifiedAt
                                        ? ` · ${new Date(backup.modifiedAt).toLocaleString()}`
                                        : ""}
                                </div>
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => void restoreBackup(backup)}
                                className="shrink-0 rounded-lg px-2 py-1 text-[10px]"
                            >
                                Restore
                            </Button>
                        </div>
                    ))}
                </div>
            ) : null}

            {status ? (
                <p className="text-[11px] text-primary">{status}</p>
            ) : null}
            {error ? (
                <p className="flex items-start gap-1 text-[11px] leading-relaxed text-destructive">
                    <WarningCircle size={13} className="mt-0.5 shrink-0" />
                    {error}
                </p>
            ) : null}

            <div className="rounded-xl border border-dashed border-border/70 p-3 text-[10px] leading-relaxed text-muted-foreground">
                A backup contains all chats, messages, artifacts, memories, and
                projects. It is uploaded as plain JSON — store it securely and
                only use services you trust. Restores always import as new
                chats.
            </div>
            <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void downloadLocalBackup()}
                className="self-start rounded-xl"
            >
                Download local backup
            </Button>
        </div>
    );
}

function downloadLocalBackup() {
    void (async () => {
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
    })();
}

function CustomSkillsSection() {
    const { settings, updateSettings } = useSettings();
    const [name, setName] = useState("");
    const [content, setContent] = useState("");
    const [query, setQuery] = useState("");
    const catalog = searchBundledSkills(query);
    const popular = catalog.filter((skill) => skill.popular);

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

    const toggleInstall = (skill: PortableSkill) => {
        const installed = isSkillInstalled(skill.name, settings.customSkills);
        updateSettings({
            customSkills: installed
                ? uninstallBundledSkill(skill.name, settings.customSkills)
                : installBundledSkill(skill.name, settings.customSkills),
        });
        hapticConfirm();
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 rounded-xl border border-border/70 p-2.5">
                <div className="flex items-center justify-between gap-2">
                    <label className="text-[11px] font-medium text-muted-foreground">
                        Skill catalog
                    </label>
                    <span className="text-[10px] text-muted-foreground">
                        Install → available via /
                    </span>
                </div>
                <div className="relative">
                    <MagnifyingGlass
                        size={13}
                        className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search skills…"
                        className="h-8 rounded-lg pl-7 text-xs"
                    />
                </div>
                {!query.trim() && popular.length > 0 ? (
                    <div className="flex flex-col gap-1">
                        <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            <Star size={11} weight="fill" className="text-amber-500" />
                            Popular
                        </p>
                        {popular.map((skill) => (
                            <SkillCatalogRow
                                key={skill.name}
                                skill={skill}
                                installed={isSkillInstalled(
                                    skill.name,
                                    settings.customSkills,
                                )}
                                onToggle={() => toggleInstall(skill)}
                            />
                        ))}
                    </div>
                ) : null}
                <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                    {(query.trim() ? catalog : catalog.filter((sk) => !sk.popular)).map(
                        (skill) => (
                            <SkillCatalogRow
                                key={skill.name}
                                skill={skill}
                                installed={isSkillInstalled(
                                    skill.name,
                                    settings.customSkills,
                                )}
                                onToggle={() => toggleInstall(skill)}
                            />
                        ),
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-border/70 p-2.5">
                <div className="flex items-center justify-between gap-2">
                    <label className="text-[11px] font-medium text-muted-foreground">
                        Installed & custom skills
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
                                <div className="min-w-0">
                                    <span className="block truncate text-xs font-medium">
                                        {skill.name}
                                    </span>
                                    {skill.description ? (
                                        <span className="block truncate text-[10px] text-muted-foreground">
                                            {skill.description}
                                        </span>
                                    ) : null}
                                </div>
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
                    <p className="text-[11px] text-muted-foreground">
                        No skills installed yet. Install from the catalog above.
                    </p>
                )}
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Custom skill name"
                    className="h-8 rounded-lg text-xs"
                />
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Instructions the model must follow…"
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
        </div>
    );
}

function SkillCatalogRow({
    skill,
    installed,
    onToggle,
}: {
    skill: PortableSkill;
    installed: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-border/60 bg-background px-2 py-1.5">
            <div className="min-w-0">
                <p className="truncate text-xs font-medium">{skill.title}</p>
                <p className="line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                    {skill.description}
                </p>
            </div>
            <Button
                type="button"
                size="sm"
                variant={installed ? "secondary" : "outline"}
                className="h-7 shrink-0 rounded-md px-2 text-[10px]"
                onClick={onToggle}
            >
                {installed ? "Installed" : "Install"}
            </Button>
        </div>
    );
}

function SubagentsSettingsSection() {
    const { settings, updateSettings } = useSettings();
    return (
        <div className="flex flex-col gap-3">
            <ChatGPTLoginSettings />
            <ToolToggle
                title="Agent Mode"
                description="Plan with skills and tools, then verify before the final answer. Uses General Task Solver routing when installed."
                checked={settings.agentModeEnabled}
                onChange={(enabled) => updateSettings({ agentModeEnabled: enabled })}
            />
            {settings.agentModeEnabled ? (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                    The model will plan, select installed skills, execute tools,
                    verify results, and synthesize. Install{" "}
                    <span className="font-medium">General Task Solver</span> from
                    Skills for best multi-domain routing. Subagents remain optional
                    below for nested approved runs.
                </p>
            ) : null}
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
                        Preview runs are isolated from regular chat history.
                        Edit models in the preview columns, or here. Each
                        column keeps its own tool calls, reasoning, images, and
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
                {(Object.keys(PROVIDER_DEFAULTS) as ProviderId[])
                    .filter((id) => id !== "chatgpt")
                    .map((id) => {
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

function UsageSection() {
    const { settings, updateSettings } = useSettings();
    const limits = settings.usageLimits ?? DEFAULT_SETTINGS.usageLimits;
    const catalog = useModelCatalog();
    const [aggregate, setAggregate] = useState<UsageAggregate | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadGen, setLoadGen] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        void (async () => {
            const threads = await getAllThreads();
            const threadMeta = new Map(
                threads.map((thread) => [thread.id, { title: thread.title }]),
            );
            const records: MessageUsageRecord[] = [];
            let assistantMessages = 0;
            for (const thread of threads) {
                const messages = await getThreadMessages(thread.id);
                for (const message of messages) {
                    if (message.role === "assistant") assistantMessages++;
                    const record = usageFromStoredMessage(message);
                    if (record) records.push(record);
                }
            }
            const next = aggregateUsage(
                records,
                (model, provider) =>
                    lookupInCatalog(
                        catalog,
                        (provider ?? "custom") as import("~/lib/types").ProviderId,
                        model,
                    ),
                {
                    threadMeta,
                    assistantMessages,
                    chatThreads: threads.length,
                },
            );
            if (!cancelled) {
                setAggregate(next);
                setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [catalog, loadGen]);

    const coverage =
        aggregate && aggregate.assistantMessages > 0
            ? Math.round(
                  (aggregate.messagesWithUsage / aggregate.assistantMessages) * 100,
              )
            : 0;

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold">Usage & cost</h3>
                <button
                    type="button"
                    onClick={() => {
                        hapticSelect();
                        setLoadGen((g) => g + 1);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-border/70 px-2 py-1 text-[10px] font-medium text-muted-foreground outline-none hover:bg-accent"
                >
                    <ArrowsClockwise size={11} />
                    Refresh
                </button>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
                Real token usage reported by each provider is captured on every
                assistant message and stored locally. Cost is estimated from
                models.dev pricing — exact billing depends on your provider.
            </p>

            <div className="rounded-xl border border-border/70 bg-muted/10 p-3">
                <h4 className="text-[11px] font-semibold">Usage limits</h4>
                <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                    Local guardrails per API key fingerprint. Server rate limits
                    apply separately via RATE_LIMIT_RPM.
                </p>
                <div className="mt-2 flex flex-col gap-2">
                    <ToolToggle
                        title="Enable limits"
                        description="Block or warn before sending when caps are reached"
                        checked={limits.enabled}
                        onChange={(enabled) =>
                            updateSettings({
                                usageLimits: { ...limits, enabled },
                            })
                        }
                    />
                    {limits.enabled ? (
                        <>
                            <label className="flex flex-col gap-1 text-[10px]">
                                <span className="font-medium text-muted-foreground">
                                    Daily token cap
                                </span>
                                <Input
                                    type="number"
                                    min={0}
                                    placeholder="No limit"
                                    value={limits.dailyTokenCap ?? ""}
                                    onChange={(e) => {
                                        const raw = e.target.value.trim();
                                        updateSettings({
                                            usageLimits: {
                                                ...limits,
                                                dailyTokenCap: raw
                                                    ? Number(raw)
                                                    : null,
                                            },
                                        });
                                    }}
                                    className="h-8 text-xs"
                                />
                            </label>
                            <label className="flex flex-col gap-1 text-[10px]">
                                <span className="font-medium text-muted-foreground">
                                    Daily spend cap (USD)
                                </span>
                                <Input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    placeholder="No limit"
                                    value={limits.dailySpendCapUsd ?? ""}
                                    onChange={(e) => {
                                        const raw = e.target.value.trim();
                                        updateSettings({
                                            usageLimits: {
                                                ...limits,
                                                dailySpendCapUsd: raw
                                                    ? Number(raw)
                                                    : null,
                                            },
                                        });
                                    }}
                                    className="h-8 text-xs"
                                />
                            </label>
                            <label className="flex flex-col gap-1 text-[10px]">
                                <span className="font-medium text-muted-foreground">
                                    Client requests / minute
                                </span>
                                <Input
                                    type="number"
                                    min={1}
                                    value={limits.requestsPerMinute ?? 30}
                                    onChange={(e) => {
                                        const value = Number(e.target.value);
                                        updateSettings({
                                            usageLimits: {
                                                ...limits,
                                                requestsPerMinute:
                                                    Number.isFinite(value) &&
                                                    value > 0
                                                        ? value
                                                        : 30,
                                            },
                                        });
                                    }}
                                    className="h-8 text-xs"
                                />
                            </label>
                            <label className="flex flex-col gap-1 text-[10px]">
                                <span className="font-medium text-muted-foreground">
                                    Warn at (% of cap)
                                </span>
                                <Input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={limits.warnAtPercent ?? 80}
                                    onChange={(e) => {
                                        const value = Number(e.target.value);
                                        updateSettings({
                                            usageLimits: {
                                                ...limits,
                                                warnAtPercent:
                                                    Number.isFinite(value) &&
                                                    value > 0
                                                        ? Math.min(value, 100)
                                                        : 80,
                                            },
                                        });
                                    }}
                                    className="h-8 text-xs"
                                />
                            </label>
                            <ToolToggle
                                title="Block when exceeded"
                                description="Prevent sends after caps are hit (otherwise warn only)"
                                checked={limits.blockWhenExceeded !== false}
                                onChange={(blockWhenExceeded) =>
                                    updateSettings({
                                        usageLimits: {
                                            ...limits,
                                            blockWhenExceeded,
                                        },
                                    })
                                }
                            />
                        </>
                    ) : null}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
                    <SpinnerGap size={14} className="animate-spin" />
                    Reading local messages…
                </div>
            ) : !aggregate || aggregate.messagesWithUsage === 0 ? (
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-center text-[11px] text-muted-foreground">
                    No usage data yet. Send a message and it will appear here —
                    usage is recorded from now on; older chats have no usage
                    data.
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-border/70 p-2.5">
                            <div className="text-[10px] text-muted-foreground">
                                Total tokens
                            </div>
                            <div className="mt-0.5 text-sm font-semibold">
                                {formatTokens(aggregate.totals.totalTokens)}
                            </div>
                        </div>
                        <div className="rounded-xl border border-border/70 p-2.5">
                            <div className="text-[10px] text-muted-foreground">
                                Estimated cost
                            </div>
                            <div className="mt-0.5 text-sm font-semibold">
                                {formatCost(aggregate.totalCost)}
                            </div>
                        </div>
                        <div className="rounded-xl border border-border/70 p-2.5">
                            <div className="text-[10px] text-muted-foreground">
                                Input tokens
                            </div>
                            <div className="mt-0.5 text-sm font-semibold">
                                {formatTokens(aggregate.totals.inputTokens)}
                            </div>
                        </div>
                        <div className="rounded-xl border border-border/70 p-2.5">
                            <div className="text-[10px] text-muted-foreground">
                                Output tokens
                            </div>
                            <div className="mt-0.5 text-sm font-semibold">
                                {formatTokens(aggregate.totals.outputTokens)}
                            </div>
                        </div>
                    </div>

                    {aggregate.totals.reasoningTokens > 0 ? (
                        <div className="text-[10px] text-muted-foreground">
                            Including{" "}
                            {formatTokens(aggregate.totals.reasoningTokens)} reasoning
                            tokens · {coverage}% of assistant messages have usage data
                        </div>
                    ) : (
                        <div className="text-[10px] text-muted-foreground">
                            {coverage}% of assistant messages have usage data
                        </div>
                    )}

                    <div>
                        <h4 className="text-[11px] font-semibold text-muted-foreground">
                            By model
                        </h4>
                        <div className="mt-1 flex flex-col gap-1">
                            {aggregate.byModel.map((row) => (
                                <div
                                    key={`${row.provider}/${row.model}`}
                                    className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-1.5 text-[11px]"
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 truncate font-medium">
                                            <ModelLogo
                                                provider={row.provider}
                                                modelId={row.model}
                                                size={12}
                                            />
                                            <span className="truncate">
                                                {row.model}
                                            </span>
                                        </div>
                                        <div className="truncate text-[10px] text-muted-foreground">
                                            {row.provider} ·{" "}
                                            {formatTokens(row.usage.inputTokens)} in /{" "}
                                            {formatTokens(row.usage.outputTokens)} out
                                        </div>
                                    </div>
                                    <span className="shrink-0 text-[11px] font-medium">
                                        {formatCost(row.cost)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-[11px] font-semibold text-muted-foreground">
                            Top chats
                        </h4>
                        <div className="mt-1 flex flex-col gap-1">
                            {aggregate.threads.slice(0, 8).map((row) => (
                                <div
                                    key={row.threadId}
                                    className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-1.5 text-[11px]"
                                >
                                    <div className="min-w-0">
                                        <div className="truncate font-medium">
                                            {row.title}
                                        </div>
                                        <div className="truncate text-[10px] text-muted-foreground">
                                            {row.model ?? "—"} ·{" "}
                                            {formatTokens(row.usage.totalTokens)} tokens
                                        </div>
                                    </div>
                                    <span className="shrink-0 text-[11px] font-medium">
                                        {formatCost(row.cost)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
