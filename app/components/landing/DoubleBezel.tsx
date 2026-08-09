import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "~/lib/utils";
import { usePrefersReducedMotion } from "./hooks";

/** Nested hardware bezel: outer shell + concentric inner core. */
export function DoubleBezel({
    children,
    className,
    innerClassName,
    padding = "p-1.5",
    outerRadius = "rounded-[1.75rem]",
    innerRadius = "rounded-[calc(1.75rem-0.375rem)]",
}: {
    children: ReactNode;
    className?: string;
    innerClassName?: string;
    padding?: string;
    outerRadius?: string;
    innerRadius?: string;
}) {
    return (
        <div
            className={cn(
                "border border-white/[0.08] bg-white/[0.03] shadow-[0_24px_80px_-48px_rgba(0,0,0,0.9)]",
                outerRadius,
                padding,
                className,
            )}
        >
            <div
                className={cn(
                    "overflow-hidden border border-white/[0.06] bg-[#0A0A0A] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
                    innerRadius,
                    innerClassName,
                )}
            >
                {children}
            </div>
        </div>
    );
}

export function Reveal({
    children,
    className,
    delayMs = 0,
}: {
    children: ReactNode;
    className?: string;
    delayMs?: number;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const reduced = usePrefersReducedMotion();

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (reduced) {
            el.dataset.in = "true";
            return;
        }
        const io = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        el.dataset.in = "true";
                        io.unobserve(el);
                    }
                }
            },
            { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
        );
        io.observe(el);
        return () => io.disconnect();
    }, [reduced]);

    return (
        <div
            ref={ref}
            className={cn(
                "translate-y-4 opacity-0 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:translate-y-0 motion-reduce:opacity-100 data-[in=true]:translate-y-0 data-[in=true]:opacity-100",
                className,
            )}
            style={delayMs && !reduced ? { transitionDelay: `${delayMs}ms` } : undefined}
        >
            {children}
        </div>
    );
}
