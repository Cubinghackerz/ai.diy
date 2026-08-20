import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";
import { usePrefersReducedMotion } from "./hooks";
import { EASE_OUT } from "./motion";

export function MaskedHeading({
    as: Tag = "h2",
    children,
    className,
    id,
}: {
    as?: "h1" | "h2" | "h3";
    children: string;
    className?: string;
    id?: string;
}) {
    const ref = useRef<HTMLHeadingElement>(null);
    const reduced = usePrefersReducedMotion();
    const [visible, setVisible] = useState(true);
    const words = children.trim().split(/\s+/);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el || reduced) {
            setVisible(true);
            return;
        }

        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
            setVisible(true);
            return;
        }

        setVisible(false);
        const io = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setVisible(true);
                        io.unobserve(el);
                    }
                }
            },
            { rootMargin: "80px 0px", threshold: 0.01 },
        );
        io.observe(el);
        const failsafe = window.setTimeout(() => setVisible(true), 900);
        return () => {
            io.disconnect();
            window.clearTimeout(failsafe);
        };
    }, [reduced]);

    return (
        <Tag ref={ref} id={id} className={className}>
            {words.map((word, i) => (
                <span key={`${word}-${i}`}>
                    <span className="inline-block overflow-hidden align-bottom pb-[0.12em]">
                        <span
                            className={cn(
                                "inline-block",
                                visible ? "translate-y-0" : "translate-y-[110%]",
                            )}
                            style={{
                                transition: reduced ? "none" : `transform 500ms ${EASE_OUT}`,
                                transitionDelay:
                                    visible && !reduced ? `${Math.min(i * 40, 240)}ms` : "0ms",
                            }}
                        >
                            {word}
                        </span>
                    </span>
                    {i < words.length - 1 ? " " : null}
                </span>
            ))}
        </Tag>
    );
}
