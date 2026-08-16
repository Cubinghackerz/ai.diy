/**
 * EnvironmentPanel — slide-out Linux terminal (CheerpX / xterm.js)
 *
 * Structure and chrome match CanvasPanel. Boots the VM on open; filesystem
 * persists per conversation via IndexedDB overlay. xterm is imported only in
 * the browser so the SSR bundle does not load the CJS package.
 */

import { TerminalWindow, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import {
    bootCheerpX,
    cheerpxAvailable,
    ensureInteractiveShell,
    resizeCheerpXConsole,
    sendCheerpXKey,
    subscribeCheerpXOutput,
    subscribeLinuxRuntime,
    type LinuxRuntimePhase,
} from "~/lib/cheerpx";
import { useSettings } from "~/lib/providers/SettingsProvider";
import "@xterm/xterm/css/xterm.css";

const MIN_WIDTH = 320;
const MAX_WIDTH_RATIO = 0.5;

function cssVar(name: string, fallback: string): string {
    if (typeof window === "undefined") return fallback;
    const value = getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim();
    return value || fallback;
}

function terminalTheme() {
    return {
        background: cssVar("--color-background", "#0a0a0a"),
        foreground: cssVar("--color-foreground", "#f5f5f5"),
        cursor: cssVar("--color-foreground", "#f5f5f5"),
        cursorAccent: cssVar("--color-background", "#0a0a0a"),
        selectionBackground: cssVar("--color-accent", "#1a1a1a"),
        selectionForeground: cssVar("--color-accent-foreground", "#f5f5f5"),
        black: "#171717",
        red: cssVar("--color-destructive", "#ef4444"),
        green: cssVar("--color-success", "#22c55e"),
        yellow: cssVar("--color-warning", "#f59e0b"),
        blue: "#60a5fa",
        magenta: "#c084fc",
        cyan: "#22d3ee",
        white: "#e5e5e5",
        brightBlack: "#737373",
        brightRed: "#f87171",
        brightGreen: "#4ade80",
        brightYellow: "#fbbf24",
        brightBlue: "#93c5fd",
        brightMagenta: "#d8b4fe",
        brightCyan: "#67e8f9",
        brightWhite: "#fafafa",
    };
}

function clampWidth(width: number): number {
    const viewport = typeof window === "undefined" ? 1280 : window.innerWidth;
    const maxWidth = Math.round(viewport * MAX_WIDTH_RATIO);
    const minWidth = Math.min(MIN_WIDTH, maxWidth);
    return Math.max(minWidth, Math.min(maxWidth, Math.round(width)));
}

export function EnvironmentPanel({
    open,
    scopeId,
    onClose,
}: {
    open: boolean;
    scopeId: string;
    onClose: () => void;
}) {
    const { settings } = useSettings();
    const enabled = settings.linuxEnvironment !== false;
    const isolated = typeof window !== "undefined" && cheerpxAvailable();
    const [status, setStatus] = useState<"idle" | "booting" | "ready" | "error">(
        "idle",
    );
    const [phase, setPhase] = useState<LinuxRuntimePhase>("idle");
    const [error, setError] = useState<string | null>(null);
    const [width, setWidth] = useState(() =>
        typeof window === "undefined"
            ? 420
            : Math.round(window.innerWidth * 0.38),
    );
    const [isResizing, setIsResizing] = useState(false);
    const panelRef = useRef<HTMLElement>(null);
    const termHostRef = useRef<HTMLDivElement>(null);
    const startXRef = useRef(0);
    const startWidthRef = useRef(0);

    useEffect(() => {
        if (!open) return;
        const handleMouseMove = (event: MouseEvent) => {
            if (!isResizing) return;
            const delta = startXRef.current - event.clientX;
            setWidth(clampWidth(startWidthRef.current + delta));
        };
        const handleMouseUp = () => setIsResizing(false);
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isResizing, open]);

    useEffect(() => {
        const onResize = () => setWidth((current) => clampWidth(current));
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    useEffect(() => {
        if (!open || !enabled || !isolated || !termHostRef.current) return;
        const host = termHostRef.current;
        let cancelled = false;
        let term: import("@xterm/xterm").Terminal | null = null;
        let fit: import("@xterm/addon-fit").FitAddon | null = null;
        let unsubscribeOutput: (() => void) | undefined;
        let dataDisposable: { dispose: () => void } | undefined;
        let observer: ResizeObserver | undefined;
        let themeObserver: MutationObserver | undefined;

        void (async () => {
            const [{ Terminal }, { FitAddon }] = await Promise.all([
                import("@xterm/xterm"),
                import("@xterm/addon-fit"),
            ]);
            if (cancelled || !termHostRef.current) return;
            term = new Terminal({
                convertEol: true,
                cursorBlink: true,
                fontFamily: cssVar("--font-mono", "ui-monospace, SFMono-Regular, monospace"),
                fontSize: 13,
                theme: terminalTheme(),
            });
            fit = new FitAddon();
            term.loadAddon(fit);
            term.open(termHostRef.current);
            fit.fit();
            resizeCheerpXConsole(term.cols, term.rows);

            unsubscribeOutput = subscribeCheerpXOutput((data) => {
                term?.write(data);
            });
            dataDisposable = term.onData((text) => {
                for (let i = 0; i < text.length; i += 1) {
                    sendCheerpXKey(text.charCodeAt(i));
                }
            });
            observer = new ResizeObserver(() => {
                try {
                    fit?.fit();
                    if (term) resizeCheerpXConsole(term.cols, term.rows);
                } catch {
                    // Fit can throw if the element is mid-unmount.
                }
            });
            observer.observe(host);
            themeObserver = new MutationObserver(() => {
                if (term) term.options.theme = terminalTheme();
            });
            themeObserver.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ["class"],
            });
        })();

        return () => {
            cancelled = true;
            unsubscribeOutput?.();
            dataDisposable?.dispose();
            observer?.disconnect();
            themeObserver?.disconnect();
            term?.dispose();
        };
    }, [open, enabled, isolated, scopeId]);

    useEffect(() => subscribeLinuxRuntime(setPhase), []);

    useEffect(() => {
        if (!open || !enabled) {
            setStatus("idle");
            setError(null);
            return;
        }
        if (!cheerpxAvailable()) {
            setStatus("error");
            setError(
                "This tab is not cross-origin isolated. Open /workspace as a top-level window over HTTPS or localhost.",
            );
            return;
        }
        let cancelled = false;
        setStatus("booting");
        setError(null);
        void bootCheerpX(scopeId)
            .then(() => ensureInteractiveShell(scopeId))
            .then(() => {
                if (!cancelled) setStatus("ready");
            })
            .catch((reason) => {
                if (cancelled) return;
                setStatus("error");
                setError(
                    reason instanceof Error
                        ? reason.message
                        : "The Linux environment failed to start.",
                );
            });
        return () => {
            cancelled = true;
        };
    }, [open, enabled, scopeId]);

    useEffect(() => {
        if (!open || !enabled || phase !== "ready") return;
        void ensureInteractiveShell(scopeId).catch(() => undefined);
    }, [open, enabled, phase, scopeId]);

    if (!open) return null;

    const handleResizeStart = (event: React.MouseEvent) => {
        event.preventDefault();
        setIsResizing(true);
        startXRef.current = event.clientX;
        startWidthRef.current = width;
    };

    const handleResizeKeyDown = (event: React.KeyboardEvent) => {
        const step = event.shiftKey ? 64 : 16;
        const maxWidth =
            typeof window === "undefined"
                ? 640
                : Math.round(window.innerWidth * MAX_WIDTH_RATIO);
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            setWidth(clampWidth(width + step));
        } else if (event.key === "ArrowRight") {
            event.preventDefault();
            setWidth(clampWidth(width - step));
        } else if (event.key === "Home") {
            event.preventDefault();
            setWidth(MIN_WIDTH);
        } else if (event.key === "End") {
            event.preventDefault();
            setWidth(maxWidth);
        }
    };

    return (
        <aside
            ref={panelRef}
            className={`relative z-40 flex h-full shrink-0 flex-col border-l border-border bg-card shadow-2xl animate-slide-up ${isResizing ? "transition-none" : "transition-[width] duration-200"}`}
            style={{ width, maxWidth: "50vw" }}
            aria-label="Linux environment"
        >
            <div
                className="absolute top-0 left-0 h-full w-1.5 cursor-col-resize touch-none"
                onMouseDown={handleResizeStart}
                onKeyDown={handleResizeKeyDown}
                role="separator"
                aria-label="Resize environment panel"
                aria-orientation="vertical"
                aria-valuemin={320}
                aria-valuemax={Math.round(
                    typeof window === "undefined" ? 640 : window.innerWidth * 0.5,
                )}
                aria-valuenow={Math.round(width)}
                tabIndex={0}
                title="Drag or use arrow keys to resize"
                style={{ zIndex: 1 }}
            >
                <div
                    className={`h-full w-full rounded-r-sm transition-colors ${
                        isResizing ? "bg-accent" : "hover:bg-accent/50"
                    }`}
                />
            </div>

            <div className="flex h-13 items-center justify-between border-b border-border px-4 pl-[8px]">
                <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                    <TerminalWindow size={16} className="shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-semibold">Environment</span>
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                        Linux
                    </span>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Close environment"
                >
                    <X size={15} />
                </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col bg-background">
                {!enabled ? (
                    <div className="m-4 rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
                        Enable <span className="font-medium text-foreground">Linux environment</span> under Settings → Experimental to boot a Debian VM in this browser.
                    </div>
                ) : (
                    <>
                        {status === "error" ? (
                            <div className="m-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
                                {error}
                            </div>
                        ) : status !== "ready" || phase === "booting" ? (
                            <p className="border-b border-border px-4 py-2 text-[11px] text-muted-foreground">
                                Booting Debian in the browser… the first start streams the disk image.
                            </p>
                        ) : phase === "running" ? (
                            <p className="border-b border-border px-4 py-2 text-[11px] text-muted-foreground">
                                Waiting for a Linux command to finish…
                            </p>
                        ) : (
                            <p className="border-b border-border px-4 py-2 text-[11px] text-muted-foreground">
                                No outbound network by default. Files persist with this chat.
                            </p>
                        )}
                        <div
                            ref={termHostRef}
                            className={`aidiy-environment-term min-h-0 flex-1 px-2 py-2 ${
                                status === "error" ? "hidden" : ""
                            }`}
                        />
                    </>
                )}
            </div>
        </aside>
    );
}
