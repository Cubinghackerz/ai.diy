"use client";

/**
 * Status-aware card for in-browser Linux VM command results.
 *
 * Parses the structured output of `formatCommandOutput` in ~/lib/cheerpx
 * (stdout / stderr / exitCode / pid / durationMs / timedOut) and renders a
 * colored status pill with split stdout/stderr sections. Falls back to the
 * raw text when the payload is not a process result (e.g. read_file artifacts,
 * linux_background_start messages).
 */

import { CheckIcon, ClockIcon, LoaderIcon, TriangleAlertIcon, XCircleIcon } from "lucide-react";
import { cn } from "~/lib/utils";

type ParsedProcessResult = {
    stdout: string;
    stderr: string;
    exitCode: number;
    pid?: number;
    durationMs?: number;
    timedOut: boolean;
};

function extractSection(text: string, name: string): string {
    const pattern = new RegExp(
        `\\n${name}:\\n((?:.|\\n)*?)(?=\\n\\b(?:stderr|exitCode|pid|durationMs|timedOut):|$)`,
    );
    const match = pattern.exec(`\n${text}`);
    return match?.[1]?.trim() ?? "";
}

export function parseProcessResult(text: string): ParsedProcessResult | null {
    const exit = /exitCode:\s*(-?\d+)/.exec(text);
    if (!exit) return null;
    const pidMatch = /pid:\s*(\d+)/.exec(text);
    const durationMatch = /durationMs:\s*(\d+)/.exec(text);
    const pid = pidMatch?.[1] ? Number.parseInt(pidMatch[1], 10) : undefined;
    const durationMs = durationMatch?.[1]
        ? Number.parseInt(durationMatch[1], 10)
        : undefined;
    return {
        stdout: extractSection(text, "stdout"),
        stderr: extractSection(text, "stderr"),
        exitCode: Number.parseInt(exit[1], 10),
        pid,
        durationMs,
        timedOut: /timedOut:\s*true/.test(text),
    };
}

function formatDuration(ms?: number): string | null {
    if (ms == null) return null;
    if (ms < 1000) return `${Math.max(1, Math.round(ms))}ms`;
    return `${(ms / 1000).toFixed(ms >= 10_000 ? 0 : 1)}s`;
}

export function LinuxProcessCard({ result }: { result: string }) {
    const parsed = parseProcessResult(result);
    if (!parsed) {
        return (
            <pre className="aui-tool-fallback-result-content bg-muted/50 text-foreground/90 mt-1 rounded-md p-2.5 text-xs whitespace-pre-wrap">
                {result}
            </pre>
        );
    }

    const { stdout, stderr, exitCode, pid, durationMs, timedOut } = parsed;
    const failed = !timedOut && exitCode !== 0;
    const duration = formatDuration(durationMs);
    const statusTone = timedOut
        ? "text-warning border-warning/30 bg-warning/10"
        : failed
          ? "text-destructive border-destructive/30 bg-destructive/10"
          : "text-success border-success/30 bg-success/10";

    return (
        <div
            data-slot="linux-process-card"
            className="aui-linux-process-card mt-1 overflow-hidden rounded-md border border-border bg-muted/30"
        >
            <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-2.5 py-1.5">
                <span
                    className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        statusTone,
                    )}
                >
                    {timedOut ? (
                        <TriangleAlertIcon className="size-3" />
                    ) : failed ? (
                        <XCircleIcon className="size-3" />
                    ) : exitCode === 0 ? (
                        <CheckIcon className="size-3" />
                    ) : (
                        <LoaderIcon className="size-3" />
                    )}
                    {timedOut
                        ? "Timed out"
                        : failed
                          ? `Failed (exit ${exitCode})`
                          : "Completed"}
                </span>
                <span className="flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
                    {duration != null ? (
                        <span className="inline-flex items-center gap-1">
                            <ClockIcon className="size-3" />
                            {duration}
                        </span>
                    ) : null}
                    {pid != null ? (
                        <span className="font-mono">pid {pid}</span>
                    ) : null}
                </span>
            </div>
            <div className="grid grid-cols-1 gap-1.5 p-2.5 sm:grid-cols-2">
                <section className="min-w-0">
                    <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                        stdout
                    </p>
                    <pre className="bg-muted/50 text-foreground/90 max-h-48 overflow-auto rounded-md p-2 text-xs whitespace-pre-wrap">
                        {stdout || "—"}
                    </pre>
                </section>
                <section className="min-w-0">
                    <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                        stderr
                    </p>
                    <pre
                        className={cn(
                            "max-h-48 overflow-auto rounded-md p-2 text-xs whitespace-pre-wrap",
                            stderr
                                ? "bg-destructive/5 text-destructive/90"
                                : "bg-muted/50 text-muted-foreground/60",
                        )}
                    >
                        {stderr || "—"}
                    </pre>
                </section>
            </div>
        </div>
    );
}
