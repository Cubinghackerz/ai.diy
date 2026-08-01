/**
 * Home Route — ai.diy chat shell
 * Sidebar hosts chats + settings (live BYOK key test). Composer supports files.
 */

import { useCallback, useEffect, useState } from "react";
import { AssistantRuntimeProvider } from "~/components/assistant-ui/AssistantRuntimeProvider";
import { ChatLifecycle } from "~/components/assistant-ui/ChatLifecycle";
import { ChatErrorBanner } from "~/components/assistant-ui/ChatThreadSync";
import { Thread } from "~/components/assistant-ui/Thread";
import { CanvasPanel } from "~/components/canvas/CanvasPanel";
import { AppSidebar } from "~/components/sidebar/AppSidebar";
import { SetupGate, useNeedsSetup } from "~/components/setup/SetupGate";
import { CanvasProvider } from "~/lib/canvas";
import { haptic, hapticSelect } from "~/lib/haptics";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { useThreads } from "~/lib/hooks/useThreads";
import { GearSix, Sidebar as SidebarIcon } from "@phosphor-icons/react";
import { cn } from "~/lib/utils";

export default function Home() {
    return (
        <CanvasProvider>
            <HomeInner />
        </CanvasProvider>
    );
}

function HomeInner() {
    const { loaded } = useSettings();
    const {
        threads,
        activeThreadId,
        setActiveThreadId,
        createNewThread,
        deleteThread,
        updateThreadTitle,
    } = useThreads();
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

    const handleNewChat = useCallback(() => {
        haptic();
        void createNewThread();
        setSidebarPanel("chats");
        setMobileSidebarOpen(false);
    }, [createNewThread]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                handleNewChat();
            } else if ((e.metaKey || e.ctrlKey) && e.key === ",") {
                e.preventDefault();
                setSidebarOpen(true);
                setSidebarPanel("settings");
                setMobileSidebarOpen(true);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [handleNewChat]);

    const activeThread = threads.find((t) => t.id === activeThreadId);

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
            panel={sidebarPanel}
            onPanelChange={setSidebarPanel}
        />
    );

    return (
        <AssistantRuntimeProvider
            key={activeThreadId ?? "draft"}
            threadId={activeThreadId}
        >
            <div className="flex h-full w-full overflow-hidden bg-background text-foreground">
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
                    <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border/70 px-3">
                        <div className="flex min-w-0 items-center gap-2">
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
                                {activeThread?.title || "New Chat"}
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                haptic();
                                setSidebarOpen(true);
                                setSidebarPanel("settings");
                                if (window.innerWidth < 768) {
                                    setMobileSidebarOpen(true);
                                }
                            }}
                            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground"
                            title="Settings (⌘,)"
                        >
                            <GearSix size={18} />
                        </button>
                    </header>

                    <main className="relative min-h-0 flex-1 overflow-hidden">
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
                    </main>

                    {/* Canvas panel — rendered outside overflow-hidden main
                        container but inside the AssistantRuntimeProvider so
                        it has access to CanvasContext and isn't clipped. */}
                    <CanvasPanel />
                </div>
            </div>
        </AssistantRuntimeProvider>
    );
}
