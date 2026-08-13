import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
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
                "border border-white/[0.14] bg-white/[0.055] shadow-[0_28px_80px_-40px_rgba(0,0,0,0.85)]",
                outerRadius,
                padding,
                className,
            )}
        >
            <div
                className={cn(
                    "overflow-hidden border border-white/[0.1] bg-[#111114] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
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
    const [visible, setVisible] = useState(true);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el || reduced) {
            setVisible(true);
            return;
        }

        const reveal = () => setVisible(true);
        const rect = el.getBoundingClientRect();
        const alreadyInView = rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
        if (alreadyInView) {
            reveal();
            return;
        }

        setVisible(false);
        const io = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        reveal();
                        io.unobserve(el);
                    }
                }
            },
            { rootMargin: "80px 0px", threshold: 0.01 },
        );
        io.observe(el);
        const failsafe = window.setTimeout(reveal, 900);
        return () => {
            io.disconnect();
            window.clearTimeout(failsafe);
        };
    }, [reduced]);

    return (
        <div
            ref={ref}
            className={cn(
                "transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:translate-y-0 motion-reduce:opacity-100",
                visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
                className,
            )}
            style={delayMs && !reduced && !visible ? { transitionDelay: `${delayMs}ms` } : undefined}
        >
            {children}
        </div>
    );
}
