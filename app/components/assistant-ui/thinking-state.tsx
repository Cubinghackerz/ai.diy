"use client";

/**
 * Live "thinking" affordances for assistant messages.
 *
 * - `extractThinkingHeadline` pulls the newest section title out of a
 *   streaming reasoning trace (`**Comparing options**`, `## Plan`) so the
 *   header can say what the model is doing instead of a generic label.
 * - `useElapsedSeconds` ticks once a second while a phase is active.
 * - `ThinkingIndicator` is the pre-first-token state: shown before any
 *   reasoning or tool part exists, so the wait never looks frozen.
 */

import { useEffect, useState, type FC } from "react";
import { LoaderIcon } from "lucide-react";
import { useAuiState } from "@assistant-ui/react";

const HEADING_PATTERNS = [
    /^(?:\*\*|__)\s*(.{3,80}?)\s*(?:\*\*|__)\s*[:.]?$/,
    /^#{1,4}\s+(.{3,80}?)\s*$/,
] as const;

/** Elapsed seconds only start showing once the wait is long enough to notice. */
export const ELAPSED_VISIBLE_AFTER_SECONDS = 3;

/**
 * Newest complete section title in a reasoning trace, or null.
 * The trailing line is skipped while it may still be mid-stream, so the
 * headline only changes when a title has fully arrived.
 */
export function extractThinkingHeadline(text: string): string | null {
    if (!text) return null;
    const lines = text.split("\n");
    const complete = text.endsWith("\n") ? lines : lines.slice(0, -1);
    for (let index = complete.length - 1; index >= 0; index--) {
        const line = complete[index]?.trim();
        if (!line) continue;
        for (const pattern of HEADING_PATTERNS) {
            const match = pattern.exec(line);
            if (match?.[1]) return match[1].replace(/[*_`]/g, "").trim();
        }
    }
    return null;
}

/** Whole seconds since `active` last became true; resets when it turns false. */
export function useElapsedSeconds(active: boolean): number {
    const [seconds, setSeconds] = useState(0);

    useEffect(() => {
        if (!active) {
            setSeconds(0);
            return;
        }
        const startedAt = Date.now();
        const timer = window.setInterval(() => {
            setSeconds(Math.floor((Date.now() - startedAt) / 1000));
        }, 1000);
        return () => window.clearInterval(timer);
    }, [active]);

    return seconds;
}

export const ElapsedBadge: FC<{ seconds: number }> = ({ seconds }) =>
    seconds >= ELAPSED_VISIBLE_AFTER_SECONDS ? (
        <span className="ms-1.5 font-mono text-[10px] tabular-nums text-muted-foreground/80">
            {seconds}s
        </span>
    ) : null;

/**
 * Rendered by the message's `indicator` slot while a reply is running and no
 * answer text exists yet. Before any reasoning/tool part it shows a labelled
 * "Thinking…" state; once those cards exist they own the live status, so this
 * falls back to a quiet pulse that covers the gaps between phases.
 */
export const ThinkingIndicator: FC = () => {
    const hasActivity = useAuiState((s) =>
        s.message.parts.some(
            (part) => part.type === "reasoning" || part.type === "tool-call",
        ),
    );
    const seconds = useElapsedSeconds(!hasActivity);

    if (hasActivity) {
        return (
            <span
                data-slot="aui_assistant-message-indicator"
                className="inline-block size-1.5 animate-pulse rounded-full bg-muted-foreground/70 motion-reduce:animate-none"
                aria-label="Assistant is working"
            />
        );
    }

    return (
        <div
            data-slot="aui_thinking-indicator"
            role="status"
            aria-live="polite"
            className="text-muted-foreground flex w-fit items-center gap-2 py-1.5 text-xs font-medium"
        >
            <LoaderIcon className="size-3.5 shrink-0 animate-spin [animation-duration:0.6s] motion-reduce:animate-none" />
            <span className="relative inline-block leading-none">
                <span>Thinking…</span>
                <span
                    aria-hidden
                    className="shimmer pointer-events-none absolute inset-0 motion-reduce:animate-none"
                >
                    Thinking…
                </span>
            </span>
            <ElapsedBadge seconds={seconds} />
        </div>
    );
};
