import { useEffect, useRef, useState } from "react";
import { Copy, Play, Stop, WifiHigh, WifiSlash } from "@phosphor-icons/react";
import {
    abortLinuxExecution,
    bootCheerpX,
    cheerpxAvailable,
    connectLinuxNetwork,
    ensureInteractiveShell,
    executeLinuxClientTool,
    resizeCheerpXConsole,
    sendCheerpXKey,
    sendCheerpXText,
    subscribeCheerpXOutput,
    subscribeLinuxNetwork,
    subscribeLinuxRuntime,
    type LinuxRuntimePhase,
} from "~/lib/cheerpx";
import { appendHistory, loadHistory, type ComputerHistoryEntry } from "~/lib/computer/history";
import { Button } from "~/components/ui/button";
import "@xterm/xterm/css/xterm.css";

function cssVar(name: string, fallback: string): string {
    if (typeof window === "undefined") return fallback;
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function TerminalTab({ scopeId }: { scopeId: string }) {
    const hostRef = useRef<HTMLDivElement>(null);
    const [phase, setPhase] = useState<LinuxRuntimePhase>("idle");
    const [networkOn, setNetworkOn] = useState(false);
    const [history, setHistory] = useState<ComputerHistoryEntry[]>(() => loadHistory(scopeId));
    const [command, setCommand] = useState("");
    const [processes, setProcesses] = useState("");
    const isolated = typeof window !== "undefined" && cheerpxAvailable();

    useEffect(() => subscribeLinuxRuntime(setPhase), []);
    useEffect(() => subscribeLinuxNetwork((snap) => setNetworkOn(snap.status === "connected")), []);

    useEffect(() => {
        if (!isolated || !hostRef.current) return;
        const host = hostRef.current;
        let cancelled = false;
        let term: import("@xterm/xterm").Terminal | null = null;
        let fit: import("@xterm/addon-fit").FitAddon | null = null;
        let unsubscribe: (() => void) | undefined;
        let dataDisposable: { dispose: () => void } | undefined;
        let observer: ResizeObserver | undefined;

        void (async () => {
            const [{ Terminal }, { FitAddon }] = await Promise.all([
                import("@xterm/xterm"),
                import("@xterm/addon-fit"),
            ]);
            if (cancelled || !hostRef.current) return;
            term = new Terminal({
                convertEol: true,
                cursorBlink: true,
                fontFamily: cssVar("--font-mono", "ui-monospace, SFMono-Regular, monospace"),
                fontSize: 13,
                theme: {
                    background: cssVar("--color-background", "#0a0a0a"),
                    foreground: cssVar("--color-foreground", "#f5f5f5"),
                    cursor: cssVar("--color-foreground", "#f5f5f5"),
                },
            });
            fit = new FitAddon();
            term.loadAddon(fit);
            term.open(host);
            fit.fit();
            resizeCheerpXConsole(term.cols, term.rows);
            unsubscribe = subscribeCheerpXOutput((data) => term?.write(data));
            dataDisposable = term.onData((text) => {
                for (let i = 0; i < text.length; i += 1) sendCheerpXKey(text.charCodeAt(i));
            });
            observer = new ResizeObserver(() => {
                try {
                    fit?.fit();
                    if (term) resizeCheerpXConsole(term.cols, term.rows);
                } catch {
                    // ignore mid-unmount
                }
            });
            observer.observe(host);
            await bootCheerpX(scopeId);
            await ensureInteractiveShell(scopeId);
        })();

        return () => {
            cancelled = true;
            unsubscribe?.();
            dataDisposable?.dispose();
            observer?.disconnect();
            term?.dispose();
        };
    }, [isolated, scopeId]);

    const runOnce = async () => {
        const next = command.trim();
        if (!next) return;
        if (/rm\s+-rf\s+[\/~]|mkfs|:\(\)\s*\{/.test(next) && !window.confirm(`Run destructive command?\n${next}`)) {
            return;
        }
        const result = await executeLinuxClientTool("linux_run_command", { command: next }, scopeId);
        appendHistory(scopeId, {
            command: next,
            output: result.output.slice(0, 4000),
            exitCode: /error|timed out/i.test(result.output) ? 1 : 0,
        });
        setHistory(loadHistory(scopeId));
        setCommand("");
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-2">
                <span className="font-mono text-[10px] text-muted-foreground">{phase}</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => abortLinuxExecution()}>
                    <Stop size={12} /> Stop
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                        if (networkOn) return;
                        void connectLinuxNetwork(scopeId);
                    }}
                >
                    {networkOn ? <WifiHigh size={12} /> : <WifiSlash size={12} />}
                    {networkOn ? "Network on" : "Enable network"}
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                        const result = await executeLinuxClientTool("linux_list_processes", {}, scopeId);
                        setProcesses(result.output);
                    }}
                >
                    Processes
                </Button>
            </div>
            {!isolated ? (
                <p className="px-3 py-3 text-[11px] text-destructive">
                    Cross-origin isolation is required for the Linux VM.
                </p>
            ) : (
                <div ref={hostRef} className="aidiy-environment-term min-h-0 flex-1 px-2 py-2" />
            )}
            <form
                className="flex items-center gap-1 border-t border-border px-2 py-1.5"
                onSubmit={(event) => {
                    event.preventDefault();
                    void runOnce();
                }}
            >
                <input
                    value={command}
                    onChange={(event) => setCommand(event.target.value)}
                    placeholder="Run one command…"
                    className="min-w-0 flex-1 bg-transparent px-2 py-1 font-mono text-[11px] outline-none"
                />
                <Button type="submit" size="sm" variant="ghost">
                    <Play size={12} />
                </Button>
            </form>
            {processes ? (
                <pre className="max-h-24 overflow-auto border-t border-border px-3 py-2 font-mono text-[10px]">
                    {processes}
                </pre>
            ) : null}
            {history.length ? (
                <ul className="max-h-28 overflow-auto border-t border-border">
                    {history.slice(0, 8).map((entry) => (
                        <li
                            key={`${entry.at}-${entry.command}`}
                            className="flex items-center gap-2 px-3 py-1.5 text-[11px]"
                        >
                            <span className="min-w-0 flex-1 truncate font-mono">{entry.command}</span>
                            <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                    sendCheerpXText(`${entry.command}\n`);
                                }}
                            >
                                <Play size={11} />
                            </button>
                            <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() => void navigator.clipboard.writeText(entry.command)}
                            >
                                <Copy size={11} />
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}