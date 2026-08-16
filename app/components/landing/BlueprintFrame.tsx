import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

function Corner({ className }: { className?: string }) {
    return (
        <span
            aria-hidden
            className={cn(
                "pointer-events-none absolute size-3 border-white/35",
                className,
            )}
        />
    );
}

/** Engineering blueprint shell — hairline frame + corner crosshairs. */
export function BlueprintFrame({
    children,
    className,
    label,
    pad = true,
}: {
    children: ReactNode;
    className?: string;
    label?: string;
    pad?: boolean;
}) {
    return (
        <div
            className={cn(
                "relative border border-white/[0.14] bg-[#17171c]/[0.82]",
                "shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_24px_80px_-48px_rgba(0,0,0,0.9)]",
                className,
            )}
        >
            <Corner className="left-0 top-0 border-l border-t" />
            <Corner className="right-0 top-0 border-r border-t" />
            <Corner className="bottom-0 left-0 border-b border-l" />
            <Corner className="bottom-0 right-0 border-b border-r" />
            {label ? (
                <div className="absolute -top-2.5 left-4 z-[1] bg-[#111114] px-2 font-mono text-[10px] tracking-[0.14em] text-zinc-400">
                    {label}
                </div>
            ) : null}
            <div className={cn(pad && "p-4 sm:p-5")}>{children}</div>
        </div>
    );
}

export function StatusPill({
    children,
    tone = "neutral",
    pulse = false,
}: {
    children: ReactNode;
    tone?: "neutral" | "live" | "warn";
    pulse?: boolean;
}) {
    const live = tone === "live";
    const warn = tone === "warn";
    const dot = live
        ? "bg-[var(--landing-mint,#3DFFB0)]"
        : warn
          ? "bg-amber-400"
          : "bg-zinc-400";
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-wide",
                live
                    ? "border-[rgba(61,255,176,0.35)] bg-[rgba(61,255,176,0.1)] text-[#d8ffe9]"
                    : warn
                      ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
                      : "border-white/[0.2] bg-white/[0.08] text-zinc-100",
            )}
        >
            <span className="relative flex size-1.5">
                {pulse ? (
                    <span
                        className={cn(
                            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-40 motion-reduce:hidden",
                            dot,
                        )}
                    />
                ) : null}
                <span className={cn("relative inline-flex size-1.5 rounded-full", dot)} />
            </span>
            {children}
        </span>
    );
}
