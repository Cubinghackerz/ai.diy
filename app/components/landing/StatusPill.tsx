import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

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
                      : "border-white/[0.14] bg-white/[0.05] text-zinc-300",
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
