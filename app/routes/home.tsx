/**
 * Home Route — ai.diy chat shell
 * Sidebar hosts chats + settings (live BYOK key test). Composer supports files.
 */

import { useCallback, useEffect, useState } from "react";
import type { HeadersFunction, MetaFunction } from "react-router";
import { AssistantRuntimeProvider } from "~/components/assistant-ui/AssistantRuntimeProvider";
import { useChatGenerating } from "~/components/assistant-ui/ChatSessionContext";
import { ChatLifecycle } from "~/components/assistant-ui/ChatLifecycle";
import { ChatErrorBanner } from "~/components/assistant-ui/ChatThreadSync";
import { PreviewWorkspace } from "~/components/assistant-ui/PreviewWorkspace";
import { SubagentProvider } from "~/components/assistant-ui/subagents";
import { Thread } from "~/components/assistant-ui/Thread";
import { CanvasPanel } from "~/components/canvas/CanvasPanel";
import { ArtifactLauncher } from "~/components/canvas/ArtifactLauncher";
import { AppSidebar } from "~/components/sidebar/AppSidebar";
import { SetupGate, useNeedsSetup } from "~/components/setup/SetupGate";
import { CanvasProvider } from "~/lib/canvas";
import { haptic, hapticSelect } from "~/lib/haptics";
import { WORKSPACE_DOCUMENT_HEADERS } from "~/lib/http-headers";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { useThreads } from "~/lib/hooks/useThreads";
import { useProjects } from "~/lib/hooks/useProjects";
import { Sidebar as SidebarIcon } from "@phosphor-icons/react";
import { cn } from "~/lib/utils";

export const headers: HeadersFunction = () => WORKSPACE_DOCUMENT_HEADERS;

export const meta: MetaFunction = () => [
    { title: "Workspace - ai.diy" },
    {
        name: "description",
        content: "A local-first, bring-your-own-key AI workspace for useful thinking.",
    },
    { name: "robots", content: "noindex, nofollow" },
];

export default function Home() {
    return (
        <CanvasProvider>
            <HomeInner />
            <ArtifactLauncher />
        </CanvasProvider>
    );
}

function HomeInner() {
    const { loaded, settings, updateSettings } = useSettings();
    const {
        threads,
        activeThreadId,
        setActiveThreadId,
        createNewThread,
        deleteThread,
        updateThreadTitle,
        setThreadProject,
        refreshThreads,
    } = useThreads();
    const {
        projects,
        createProject,
        updateProject,
        deleteProject,
    } = useProjects();
    const needsSetup = useNeedsSetup();

    // All local UI state must stay above any early returns (Rules of Hooks).
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [sidebarPanel, setSidebarPanel] = useState<"chats" | "settings">(
        "chats",
    );
    const handleTitleChange = useCallback(
        (threadId: string, title: string) => {
            void updateThreadTitle(threadId, title);
        },
        [updateThreadTitle],
    );

    const handleNewChat = useCallback(
        (projectId: string | null = null) => {
            haptic();
            void createNewThread("New Chat", projectId);
            setSidebarPanel("chats");
            setMobileSidebarOpen(false);
        },
        [createNewThread],
    );

    const activeThread = threads.find((t) => t.id === activeThreadId);
    const activeProject = activeThread?.projectId
        ? projects.find((p) => p.id === activeThread.projectId)
        : undefined;

    if (!loaded) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-background text-muted-foreground">
                Loading…
            </div>
        );
    }

    if (needsSetup) {
        return <SetupGate />;
    }

    const sidebar = (
        <AppSidebar
            threads={threads}
            projects={projects}
            activeThreadId={activeThreadId}
            onSelectThread={(id) => {
                hapticSelect();
                setActiveThreadId(id);
                setMobileSidebarOpen(false);
            }}
            onNewChat={handleNewChat}
            onDeleteThread={(id) => {
                void deleteThread(id);
            }}
            onRenameThread={handleTitleChange}
            onMoveThread={(id, projectId) => {
                void setThreadProject(id, projectId);
            }}
            onCreateProject={(name, color, instructions) => {
                void createProject(name, color, instructions);
            }}
            onUpdateProject={(id, patch) => {
                void updateProject(id, patch);
            }}
            onDeleteProject={(id) => {
                void (async () => {
                    await deleteProject(id);
                    await refreshThreads();
                })();
            }}
            onImportComplete={() => {
                void refreshThreads();
            }}
            panel={sidebarPanel}
            onPanelChange={setSidebarPanel}
        />
    );

    const appShell = (
        <div className="flex h-full w-full overflow-hidden bg-background text-foreground">
                <WorkspaceHotkeys
                    onNewChat={handleNewChat}
                    onOpenSettings={() => {
                        setSidebarOpen(true);
                        setSidebarPanel("settings");
                        setMobileSidebarOpen(true);
                    }}
                />
                <aside
                    className={cn(
                        "hidden flex-col border-r border-border/80 bg-sidebar transition-[width] duration-200 md:flex",
                        sidebarOpen ? "w-72" : "w-0 overflow-hidden border-0",
                    )}
                >
                    {sidebarOpen ? sidebar : null}
                </aside>

                {mobileSidebarOpen ? (
                    <div className="fixed inset-0 z-50 flex md:hidden">
                        <button
                            type="button"
                            className="absolute inset-0 bg-black/60"
                            aria-label="Close sidebar"
                            onClick={() => setMobileSidebarOpen(false)}
                        />
                        <aside className="relative z-10 flex h-full w-72 flex-col border-r border-border bg-sidebar shadow-2xl">
                            {sidebar}
                        </aside>
                    </div>
                ) : null}

                <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
                    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border/70 px-3">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    haptic();
                                    if (window.innerWidth < 768) {
                                        setMobileSidebarOpen(true);
                                    } else {
                                        setSidebarOpen((v) => !v);
                                    }
                                }}
                                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground"
                                title="Toggle sidebar"
                            >
                                <SidebarIcon size={18} />
                            </button>
                            <span className="truncate text-sm font-semibold">
                                {settings.preview.enabled
                                    ? "Multi-model preview"
                                    : activeThread?.title || "New Chat"}
                            </span>
                        </div>
                        {settings.preview.enabled ? (
                            <button
                                type="button"
                                onClick={() => {
                                    hapticSelect();
                                    updateSettings({
                                        preview: {
                                            ...settings.preview,
                                            enabled: false,
                                        },
                                    });
                                }}
                                className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground"
                            >
                                Exit preview
                            </button>
                        ) : null}
                    </header>

                    <div className="relative flex min-h-0 flex-1">
                        <main className="relative min-w-0 flex-1 overflow-hidden">
                            {settings.preview.enabled ? (
                                <PreviewWorkspace />
                            ) : (
                                <>
                                    <ChatLifecycle
                                        threadId={activeThreadId}
                                        threadTitle={activeThread?.title}
                                        onTitleChange={handleTitleChange}
                                    />
                                    <div className="flex h-full min-h-0 flex-col">
                                        <ChatErrorBanner />
                                        <div className="min-h-0 flex-1">
                                            <Thread />
                                        </div>
                                    </div>
                                </>
                            )}
                        </main>

                        {/* The canvas is a workspace sibling, so opening an
                            artifact gives the chat the remaining width. */}
                        <CanvasPanel />
                    </div>
                </div>
        </div>
    );

    if (settings.preview.enabled) return appShell;

    return (
        <SubagentProvider threadId={activeThreadId}>
            <AssistantRuntimeProvider
                key={activeThreadId ?? "draft"}
                threadId={activeThreadId}
                projectInstructions={activeProject?.instructions}
            >
                {appShell}
            </AssistantRuntimeProvider>
        </SubagentProvider>
    );
}

function WorkspaceHotkeys({
    onNewChat,
    onOpenSettings,
}: {
    onNewChat: () => void;
    onOpenSettings: () => void;
}) {
    const generating = useChatGenerating();

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                if (generating) return;
                onNewChat();
            } else if ((e.metaKey || e.ctrlKey) && e.key === ",") {
                e.preventDefault();
                onOpenSettings();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [generating, onNewChat, onOpenSettings]);

    return null;
}
