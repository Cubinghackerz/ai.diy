import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "~/lib/utils";
import { usePrefersReducedMotion } from "./hooks";
import { EASE_OUT } from "./motion";

/** Fades a block in once as it scrolls into view. Visible immediately with reduced motion. */
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
                "motion-reduce:translate-y-0 motion-reduce:opacity-100",
                visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
                className,
            )}
            style={{
                transitionProperty: "opacity, transform",
                transitionDuration: "400ms",
                transitionTimingFunction: EASE_OUT,
                transitionDelay: delayMs && !reduced && !visible ? `${delayMs}ms` : "0ms",
            }}
        >
            {children}
        </div>
    );
}
