import { cn } from "~/lib/utils";
import type { CSSProperties } from "react";

export function BorderBeam({
    active = true,
    className,
    duration = 7,
}: {
    active?: boolean;
    className?: string;
    duration?: number;
}) {
    if (!active) return null;
    return (
        <span
            aria-hidden
            className={cn(
                "aidiy-border-beam pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[inherit]",
                className,
            )}
            style={{ "--aidiy-beam-duration": `${duration}s` } as CSSProperties}
        />
    );
}
