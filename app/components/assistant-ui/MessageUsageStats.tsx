/**
 * Message usage metrics + token-mode selector.
 * TOK prefers provider-reported usage (input+output). The mode menu portals
 * above the message so content-visibility / overflow cannot clip it.
 */

import {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type FC,
} from "react";
import { createPortal } from "react-dom";
import { useAuiState, useMessageTiming } from "@assistant-ui/react";
import { getThreadMessageTokenUsage } from "@assistant-ui/react-ai-sdk";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { hapticSelect } from "~/lib/haptics";
import {
    TOKEN_MODE_BLURBS,
    TOKEN_MODE_LABELS,
    type TokenMode,
} from "~/lib/token-mode";
import {
    estimateCost,
    formatCost,
    formatTokens,
    normalizeUsage,
    type UsageTokens,
} from "~/lib/usage";
import { lookupInCatalog, useModelCatalog } from "~/lib/model-catalog-cache";
import type { ProviderId } from "~/lib/types";
import { cn } from "~/lib/utils";

type ServerTiming = {
    ttftMs?: number;
    durationMs?: number;
};

function estimateTokensFromChars(charCount: number): number {
    if (charCount <= 0) return 0;
    return Math.ceil(charCount / 4);
}

function extractAssistantTextLength(message: unknown): number {
    if (!message || typeof message !== "object") return 0;
    const parts = (message as { parts?: unknown }).parts;
    if (!Array.isArray(parts)) {
        const content = (message as { content?: unknown }).content;
        if (typeof content === "string") return content.length;
        return 0;
    }
    let len = 0;
    for (const part of parts) {
        if (!part || typeof part !== "object") continue;
        const type = (part as { type?: unknown }).type;
        const text = (part as { text?: unknown }).text;
        if (
            (type === "text" || type === "reasoning") &&
            typeof text === "string"
        ) {
            len += text.length;
        }
    }
    return len;
}

/** Tool input is model response activity even before visible text arrives. */
function hasToolResponseActivity(message: unknown): boolean {
    if (!message || typeof message !== "object") return false;
    const parts = (message as { parts?: unknown }).parts;
    if (!Array.isArray(parts)) return false;
    return parts.some((part) => {
        if (!part || typeof part !== "object") return false;
        const type = (part as { type?: unknown }).type;
        return (
            type === "tool-call" ||
            type === "dynamic-tool" ||
            (typeof type === "string" && type.startsWith("tool-"))
        );
    });
}

/** Live estimate of tool-call tokens (model-written args + tool results). */
function estimateToolCallTokens(message: unknown): number {
    if (!message || typeof message !== "object") return 0;
    const parts = (message as { parts?: unknown }).parts;
    if (!Array.isArray(parts)) return 0;
    let chars = 0;
    for (const part of parts) {
        if (!part || typeof part !== "object") continue;
        const p = part as { type?: unknown; argsText?: unknown; result?: unknown };
        if (p.type !== "tool-call") continue;
        if (typeof p.argsText === "string") chars += p.argsText.length;
        const result = p.result;
        if (typeof result === "string") {
            chars += result.length;
        } else if (result != null) {
            try {
                chars += JSON.stringify(result)?.length ?? 0;
            } catch {
                // Unserializable result — skip.
            }
        }
    }
    return estimateTokensFromChars(chars);
}

function formatTps(tps: number | undefined): string {
    if (tps == null || !Number.isFinite(tps) || tps <= 0) return "—";
    return tps >= 100 ? `${Math.round(tps)}` : tps.toFixed(1);
}

function resolveTtftMs(
    streamStart: number | undefined,
    firstToken: number | undefined,
): number | undefined {
    if (streamStart == null || firstToken == null) return undefined;
    if (!Number.isFinite(streamStart) || !Number.isFinite(firstToken)) {
        return undefined;
    }
    if (firstToken >= 0 && firstToken < streamStart) {
        return Math.max(0, firstToken);
    }
    return Math.max(0, firstToken - streamStart);
}

function StatCell({
    label,
    value,
    live,
}: {
    label: string;
    value: string;
    live?: boolean;
}) {
    return (
        <span className="inline-flex shrink-0 items-baseline gap-1">
            <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">
                {label}
            </span>
            <span
                className={cn(
                    "min-w-[2.5ch] tabular-nums text-[10px] text-foreground/90",
                    live && "animate-pulse",
                )}
            >
                {value}
            </span>
        </span>
    );
}

export const MessageUsageStats: FC = () => {
    const { settings, updateSettings } = useSettings();
    const catalog = useModelCatalog();
    const [open, setOpen] = useState(false);
    const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const messageTiming = useMessageTiming();
    const message = useAuiState((s) => s.message);
    const messageId = useAuiState((s) => s.message.id);
    const isRunning = useAuiState((s) => {
        const status = (s.message as { status?: { type?: string } }).status;
        return status?.type === "running";
    });

    const streamStartRef = useRef<number | null>(null);
    const firstResponseAtRef = useRef<number | null>(null);
    const trackedIdRef = useRef<string | null>(null);
    const [nowMs, setNowMs] = useState(() => Date.now());

    const textLen = extractAssistantTextLength(message);

    if (trackedIdRef.current !== messageId) {
        trackedIdRef.current = messageId;
        streamStartRef.current = isRunning ? Date.now() : null;
        firstResponseAtRef.current = null;
    }

    const hasToolActivity = hasToolResponseActivity(message);
    const responseActivity = textLen > 0 || hasToolActivity;
    if (
        isRunning &&
        responseActivity &&
        firstResponseAtRef.current == null
    ) {
        firstResponseAtRef.current = Date.now();
    }

    useEffect(() => {
        if (!isRunning) return;
        if (streamStartRef.current == null) streamStartRef.current = Date.now();
        if (responseActivity && firstResponseAtRef.current == null) {
            firstResponseAtRef.current = Date.now();
        }
    }, [isRunning, messageId, responseActivity]);

    useEffect(() => {
        if (!isRunning) return;
        setNowMs(Date.now());
        const id = window.setInterval(() => setNowMs(Date.now()), 250);
        return () => window.clearInterval(id);
    }, [isRunning, messageId]);

    const stats = useMemo(() => {
        const metadata =
            message && typeof message === "object"
                ? (message as { metadata?: unknown }).metadata
                : undefined;
        const record =
            metadata && typeof metadata === "object"
                ? (metadata as {
                      usage?: unknown;
                      timing?: ServerTiming;
                      serverTiming?: ServerTiming;
                      model?: unknown;
                      provider?: unknown;
                      custom?: {
                          usage?: unknown;
                          timing?: ServerTiming;
                          serverTiming?: ServerTiming;
                      };
                  })
                : undefined;

        const fromNormalize =
            normalizeUsage(record?.usage) ??
            normalizeUsage(record?.custom?.usage);
        const fromSdk = getThreadMessageTokenUsage(
            message as { role?: string; metadata?: unknown },
        );
        const usage: UsageTokens | undefined = fromNormalize
            ? {
                  inputTokens: fromNormalize.inputTokens,
                  outputTokens: fromNormalize.outputTokens,
                  reasoningTokens: fromNormalize.reasoningTokens,
                  cachedInputTokens: fromNormalize.cachedInputTokens,
                  totalTokens: fromNormalize.totalTokens,
              }
            : fromSdk
              ? {
                    inputTokens: fromSdk.inputTokens ?? 0,
                    outputTokens: fromSdk.outputTokens ?? 0,
                    reasoningTokens: fromSdk.reasoningTokens ?? 0,
                    cachedInputTokens: fromSdk.cachedInputTokens ?? 0,
                    totalTokens: fromSdk.totalTokens ?? 0,
                }
              : undefined;

        const providerTotal =
            usage?.totalTokens != null && usage.totalTokens > 0
                ? usage.totalTokens
                : usage?.inputTokens != null || usage?.outputTokens != null
                  ? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)
                  : undefined;

        const model =
            typeof record?.model === "string" && record.model
                ? record.model
                : undefined;
        const provider = typeof record?.provider === "string"
            ? (record.provider as ProviderId)
            : undefined;
        const entry =
            model && providerTotal && providerTotal > 0
                ? lookupInCatalog(catalog, provider ?? ("custom" as ProviderId), model)
                : undefined;
        const costUsd =
            usage &&
            providerTotal &&
            providerTotal > 0
                ? estimateCost(usage, entry)
                : null;

        const serverTiming =
            record?.serverTiming ??
            record?.custom?.serverTiming ??
            (record?.timing && typeof record.timing.ttftMs === "number"
                ? record.timing
                : undefined) ??
            record?.custom?.timing;

        const streamStart = messageTiming?.streamStartTime;
        const firstToken = messageTiming?.firstTokenTime;
        const totalStream = messageTiming?.totalStreamTime;
        const liveStart = streamStartRef.current;
        const liveFirst = firstResponseAtRef.current;
        const estimatedOut = estimateTokensFromChars(textLen);
        const estimatedToolTokens = estimateToolCallTokens(message);
        const estimatedTotal = estimatedOut + estimatedToolTokens;

        const liveTtft =
            liveStart != null
                ? liveFirst != null
                    ? Math.max(0, liveFirst - liveStart)
                    : isRunning
                      ? Math.max(0, nowMs - liveStart)
                      : undefined
                : undefined;
        const reportedTtft =
            typeof serverTiming?.ttftMs === "number"
                ? serverTiming.ttftMs
                : resolveTtftMs(streamStart, firstToken);
        let ttftMs = liveTtft ?? reportedTtft;
        if ((ttftMs == null || ttftMs < 20) && liveTtft != null && liveTtft >= 20) {
            ttftMs = liveTtft;
        }
        if (ttftMs != null && ttftMs < 20 && isRunning && liveFirst == null) {
            ttftMs = liveTtft;
        }

        const durationMs =
            typeof serverTiming?.durationMs === "number"
                ? serverTiming.durationMs
                : totalStream != null
                  ? totalStream
                  : isRunning && liveStart != null
                    ? Math.max(0, nowMs - liveStart)
                    : undefined;

        const outputTokens =
            usage?.outputTokens != null && usage.outputTokens > 0
                ? usage.outputTokens
                : isRunning && estimatedOut > 0
                  ? estimatedOut
                  : undefined;

        const totalTokens =
            providerTotal && providerTotal > 0
                ? providerTotal
                : estimatedTotal > 0
                  ? estimatedTotal
                  : undefined;

        const genMs =
            liveFirst != null
                ? Math.max(nowMs - liveFirst, 0)
                : durationMs != null && ttftMs != null
                  ? Math.max(durationMs - ttftMs, 0)
                  : durationMs != null
                    ? Math.max(durationMs, 0)
                    : undefined;

        const tpsWindowMs = genMs != null && genMs >= 300 ? genMs : undefined;
        const tpsFromUsage =
            tpsWindowMs != null && outputTokens != null && outputTokens > 0
                ? (outputTokens / tpsWindowMs) * 1000
                : undefined;
        const tps =
            tpsFromUsage ??
            (!isRunning &&
            typeof messageTiming?.tokensPerSecond === "number" &&
            messageTiming.tokensPerSecond > 0 &&
            !providerTotal
                ? messageTiming.tokensPerSecond
                : undefined);

        return {
            ttftMs,
            tps,
            totalTokens,
            inputTokens: usage?.inputTokens,
            outputTokens: usage?.outputTokens,
            reasoningTokens: usage?.reasoningTokens,
            providerReported: Boolean(providerTotal && providerTotal > 0),
            costUsd,
            model,
            provider,
        };
    }, [message, messageTiming, isRunning, textLen, nowMs, catalog, responseActivity]);

    const current = (settings.tokenMode ?? "balanced") as TokenMode;
    const modes: TokenMode[] = ["efficient", "balanced", "caching", "full"];

    const tpsLabel = formatTps(stats.tps);
    const tokLabel =
        stats.totalTokens != null && stats.totalTokens > 0
            ? `${stats.providerReported ? "" : "~"}${formatTokens(stats.totalTokens)}`
            : isRunning
              ? "0"
              : "—";
    const costLabel = formatCost(stats.costUsd);

    const closeMenu = () => setOpen(false);
    const toggleMenu = () => setOpen((prev) => !prev);

    const placeMenu = () => {
        const el = buttonRef.current;
        if (!el) return;
        const anchor = el.getBoundingClientRect();
        const width = 288;
        const gap = 8;
        const spaceAbove = Math.max(0, anchor.top - gap - 8);
        const spaceBelow = Math.max(0, window.innerHeight - anchor.bottom - gap - 8);
        const openAbove = spaceAbove >= 220 || spaceAbove >= spaceBelow;
        const maxHeight = Math.max(160, openAbove ? spaceAbove : spaceBelow);
        let left = anchor.left;
        if (left + width > window.innerWidth - 8) {
            left = Math.max(8, window.innerWidth - width - 8);
        }
        if (left < 8) left = 8;
        setMenuStyle(
            openAbove
                ? {
                      position: "fixed",
                      left,
                      bottom: window.innerHeight - anchor.top + gap,
                      width,
                      maxHeight,
                      overflowY: "auto",
                      zIndex: 80,
                  }
                : {
                      position: "fixed",
                      left,
                      top: anchor.bottom + gap,
                      width,
                      maxHeight,
                      overflowY: "auto",
                      zIndex: 80,
                  },
        );
    };

    useLayoutEffect(() => {
        if (!open) {
            setMenuStyle(null);
            return;
        }
        placeMenu();
        const onReposition = () => placeMenu();
        window.addEventListener("resize", onReposition);
        window.addEventListener("scroll", onReposition, true);
        return () => {
            window.removeEventListener("resize", onReposition);
            window.removeEventListener("scroll", onReposition, true);
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (rootRef.current?.contains(target)) return;
            if (menuRef.current?.contains(target)) return;
            closeMenu();
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") closeMenu();
        };
        document.addEventListener("pointerdown", onPointerDown, true);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown, true);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const menu =
        open && menuStyle && typeof document !== "undefined"
            ? createPortal(
                  <div
                      ref={menuRef}
                      role="dialog"
                      aria-label="Token mode"
                      style={menuStyle}
                      className={cn(
                          "origin-bottom-left animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-1 duration-150",
                          "rounded-2xl border border-border/70 bg-popover p-1.5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.55)]",
                      )}
                  >
                      <div className="flex items-baseline justify-between gap-2 px-2.5 pb-1.5 pt-2">
                          <p className="text-[11px] font-semibold tracking-tight text-foreground">
                              Token mode
                          </p>
                          <p className="font-mono text-[9px] tabular-nums text-muted-foreground">
                              {stats.providerReported
                                  ? `${formatTokens(stats.inputTokens ?? 0)} in · ${formatTokens(stats.outputTokens ?? 0)} out${stats.reasoningTokens ? ` · ${formatTokens(stats.reasoningTokens)} think` : ""}`
                                  : isRunning
                                    ? "streaming…"
                                    : "provider usage only (est. tokens)"}
                          </p>
                          {stats.costUsd != null ? (
                              <p className="mt-1 flex items-baseline justify-between gap-2 px-2.5 pb-1.5">
                                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
                                      Est. cost{stats.model ? ` · ${stats.model}` : ""}
                                  </span>
                                  <span className="font-mono text-[10px] tabular-nums text-foreground/90">
                                      {costLabel}
                                  </span>
                              </p>
                          ) : null}
                      </div>
                      <div
                          className="flex flex-col gap-0.5"
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
                                          "group/item flex items-start gap-2.5 rounded-xl px-2.5 py-2 text-left outline-none",
                                          "transition-colors duration-150 ease-[cubic-bezier(0.32,0.72,0,1)]",
                                          "focus-visible:ring-2 focus-visible:ring-ring",
                                          selected
                                              ? "bg-foreground/[0.07]"
                                              : "hover:bg-muted/50",
                                      )}
                                  >
                                      <span
                                          className={cn(
                                              "mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full border",
                                              selected
                                                  ? "border-foreground bg-foreground"
                                                  : "border-border/80 bg-transparent",
                                          )}
                                          aria-hidden
                                      >
                                          {selected ? (
                                              <span className="size-1.5 rounded-full bg-background" />
                                          ) : null}
                                      </span>
                                      <span className="min-w-0 flex-1">
                                          <span className="flex items-center gap-1.5">
                                              <span className="text-[12px] font-medium leading-none text-foreground">
                                                  {TOKEN_MODE_LABELS[mode]}
                                              </span>
                                              {mode === "balanced" ? (
                                                  <span className="rounded-full bg-muted/80 px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wide text-muted-foreground">
                                                      default
                                                  </span>
                                              ) : null}
                                          </span>
                                          <span className="mt-1 block text-[10px] leading-snug text-muted-foreground">
                                              {TOKEN_MODE_BLURBS[mode]}
                                          </span>
                                      </span>
                                  </button>
                              );
                          })}
                      </div>
                  </div>,
                  document.body,
              )
            : null;

    return (
        <div ref={rootRef} className="relative ms-1 shrink-0">
            <button
                ref={buttonRef}
                type="button"
                className={cn(
                    "group inline-flex items-center gap-2.5 whitespace-nowrap rounded-full border border-border/50 bg-background/60 px-2.5 py-1 font-mono outline-none backdrop-blur-sm",
                    "transition-[border-color,background-color,box-shadow,color] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
                    "hover:border-border hover:bg-muted/40 hover:shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]",
                    "focus-visible:ring-2 focus-visible:ring-ring",
                    open && "border-border bg-muted/40",
                )}
                aria-label={`Usage: ${tpsLabel} tokens per second, ${tokLabel} tokens${stats.costUsd != null ? `, estimated cost ${costLabel}` : ""}. Click to change token mode. Current mode ${TOKEN_MODE_LABELS[current]}.`}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={toggleMenu}
            >
                <StatCell
                    label="t/s"
                    value={tpsLabel}
                    live={isRunning && stats.tps != null}
                />
                <span className="h-2.5 w-px shrink-0 bg-border/70" aria-hidden />
                <StatCell
                    label="tok"
                    value={tokLabel}
                    live={isRunning && !stats.providerReported}
                />
                {stats.costUsd != null ? (
                    <>
                        <span className="h-2.5 w-px shrink-0 bg-border/70" aria-hidden />
                        <StatCell
                            label="cost"
                            value={costLabel}
                            live={isRunning && stats.providerReported}
                        />
                    </>
                ) : null}
            </button>
            {menu}
        </div>
    );
};
