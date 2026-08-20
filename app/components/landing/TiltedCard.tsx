import { useRef, type ReactNode } from "react";
import { cn } from "~/lib/utils";
import { useFinePointer, usePrefersReducedMotion } from "./hooks";
import { EASE_OUT } from "./motion";

export function TiltedCard({
    children,
    className,
    maxTilt = 4,
}: {
    children: ReactNode;
    className?: string;
    maxTilt?: number;
}) {
    const innerRef = useRef<HTMLDivElement>(null);
    const reduced = usePrefersReducedMotion();
    const fine = useFinePointer();
    const enabled = fine && !reduced;

    const reset = () => {
        const el = innerRef.current;
        if (!el) return;
        el.style.transition = `transform 400ms ${EASE_OUT}`;
        el.style.transform = "rotateX(0deg) rotateY(0deg)";
    };

    return (
        <div className={cn("[perspective:900px]", className)}>
            <div
                ref={innerRef}
                className="origin-center will-change-transform"
                style={{ transformStyle: "preserve-3d" }}
                onPointerMove={(e) => {
                    if (!enabled) return;
                    const el = innerRef.current;
                    if (!el) return;
                    const r = el.getBoundingClientRect();
                    const px = (e.clientX - r.left) / Math.max(r.width, 1);
                    const py = (e.clientY - r.top) / Math.max(r.height, 1);
                    const rx = (0.5 - py) * maxTilt * 2;
                    const ry = (px - 0.5) * maxTilt * 2;
                    el.style.transition = "none";
                    el.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
                }}
                onPointerLeave={reset}
            >
                {children}
            </div>
        </div>
    );
}
