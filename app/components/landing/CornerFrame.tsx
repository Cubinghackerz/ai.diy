import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

const CORNERS = [
    "left-0 top-0 -translate-x-1/2 -translate-y-1/2",
    "right-0 top-0 translate-x-1/2 -translate-y-1/2",
    "bottom-0 left-0 -translate-x-1/2 translate-y-1/2",
    "bottom-0 right-0 translate-x-1/2 translate-y-1/2",
] as const;

/** Selection-frame corner handles: the squarish signature used around hero evidence. */
export function CornerFrame({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={cn("relative", className)}>
            {children}
            {CORNERS.map((position) => (
                <span
                    key={position}
                    aria-hidden
                    className={cn(
                        "pointer-events-none absolute z-10 size-2 border border-white/40 bg-black",
                        position,
                    )}
                />
            ))}
        </div>
    );
}
