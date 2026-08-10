/**
 * Message usage metrics + hover token-mode selector.
 * Shows TTFT, TPS, and total tokens beside the assistant action bar.
 */

import { useMemo, useState, type FC } from "react";
import { useAuiState } from "@assistant-ui/react";
import { CheckCircle } from "@phosphor-icons/react";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { hapticSelect } from "~/lib/haptics";
import {
    TOKEN_MODE_DESCRIPTIONS,
    TOKEN_MODE_LABELS,
    type TokenMode,
} from "~/lib/token-mode";
import { formatTokens, normalizeUsage } from "~/lib/usage";
import { cn } from "~/lib/utils";

type TimingMeta = {
    ttftMs?: number;
    durationMs?: number;
};

function formatMs(ms: number | undefined): string {
    if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)}s`;
}

function formatTps(tps: number | undefined): string {
    if (tps == null || !Number.isFinite(tps) || tps <= 0) return "—";
    return tps >= 100 ? `${Math.round(tps)}` : tps.toFixed(1);
}

export const MessageUsageStats: FC = () => {
    const { settings, updateSettings } = useSettings();
    const [open, setOpen] = useState(false);
    const metadata = useAuiState((s) => {
        const msg = s.message as { metadata?: unknown };
        return msg.metadata;
    });
    const isRunning = useAuiState((s) => {
        const status = (s.message as { status?: { type?: string } }).status;
        return status?.type === "running";
    });

    const stats = useMemo(() => {
        if (!metadata || typeof metadata !== "object") return null;
        const record = metadata as {
            usage?: unknown;
            timing?: TimingMeta;
        };
        const usage = normalizeUsage(record.usage);
        const timing = record.timing ?? {};
        const ttftMs =
            typeof timing.ttftMs === "number" ? timing.ttftMs : undefined;
        const durationMs =
            typeof timing.durationMs === "number" ? timing.durationMs : undefined;
        const outputTokens = usage?.outputTokens ?? 0;
        const genMs =
            durationMs != null && ttftMs != null
                ? Math.max(durationMs - ttftMs, 1)
                : durationMs != null
                  ? Math.max(durationMs, 1)
                  : undefined;
        const tps =
            genMs != null && outputTokens > 0
                ? (outputTokens / genMs) * 1000
                : undefined;
        if (!usage && ttftMs == null && durationMs == null) return null;
        return {
            ttftMs,
            tps,
            totalTokens: usage?.totalTokens,
            inputTokens: usage?.inputTokens,
            outputTokens: usage?.outputTokens,
        };
    }, [metadata]);

    if (isRunning || !stats) return null;

    const current = (settings.tokenMode ?? "balanced") as TokenMode;
    const modes: TokenMode[] = ["efficient", "balanced", "caching", "full"];

    return (
        <div
            className="relative ms-1"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    setOpen(false);
                }
            }}
        >
            <button
                type="button"
                className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 font-mono text-[10px] tracking-wide text-muted-foreground outline-none transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Usage stats. Hover or focus to change token mode."
                aria-haspopup="dialog"
                aria-expanded={open}
            >
                <span>TTFT {formatMs(stats.ttftMs)}</span>
                <span className="text-border">·</span>
                <span>{formatTps(stats.tps)} t/s</span>
                <span className="text-border">·</span>
                <span>
                    {stats.totalTokens != null
                        ? `${formatTokens(stats.totalTokens)} tok`
                        : "— tok"}
                </span>
            </button>

            {open ? (
                <div
                    role="dialog"
                    aria-label="Token mode"
                    className="absolute bottom-full left-0 z-40 mb-2 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-border/80 bg-popover/95 p-2 shadow-xl backdrop-blur-md"
                >
                    <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Token mode
                    </p>
                    <div className="flex flex-col gap-1" role="radiogroup" aria-label="Token mode">
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
                                        "rounded-lg border px-2.5 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                                        selected
                                            ? "border-primary/40 bg-primary/10"
                                            : "border-transparent hover:bg-muted/50",
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] font-semibold text-foreground">
                                            {TOKEN_MODE_LABELS[mode]}
                                            {mode === "balanced" ? (
                                                <span className="ml-1 text-[9px] font-medium text-muted-foreground">
                                                    default
                                                </span>
                                            ) : null}
                                        </span>
                                        {selected ? (
                                            <CheckCircle
                                                size={12}
                                                weight="fill"
                                                className="shrink-0 text-primary"
                                            />
                                        ) : null}
                                    </div>
                                    <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                                        {TOKEN_MODE_DESCRIPTIONS[mode]}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                    {(stats.inputTokens != null || stats.outputTokens != null) && (
                        <p className="mt-1 border-t border-border/60 px-2 pt-1.5 font-mono text-[9px] text-muted-foreground">
                            {formatTokens(stats.inputTokens ?? 0)} in ·{" "}
                            {formatTokens(stats.outputTokens ?? 0)} out
                        </p>
                    )}
                </div>
            ) : null}
        </div>
    );
};
