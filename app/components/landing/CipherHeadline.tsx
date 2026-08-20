import { useSyncExternalStore } from "react";
import { DecryptReveal, supportsHtmlInCanvas } from "~/components/canvasui/DecryptReveal";
import { cn } from "~/lib/utils";
import { useFinePointer, usePrefersReducedMotion } from "./hooks";
import { LANDING } from "./tokens";

const emptySubscribe = () => () => {};

const CIPHER = {
    radius: 400,
    softness: 0.5,
    cell: 10,
    aspect: 0.75,
    colored: 1,
    brightness: 1,
    legibility: 1,
    contrast: 1,
    exposure: 1,
    scramble: 0.1,
    scrambleSpeed: 6,
    edgeWidth: 0.2,
    edgeFlicker: 1,
    edgeGlow: 2,
    edgeTint: 0.75,
    aberration: 10,
    passthrough: 0.15,
    threshold: 0.025,
    smoothing: 0.2,
    color: LANDING.mint,
    background: LANDING.canvas,
} as const;

const HEADING =
    "mx-auto max-w-[20rem] text-center text-[clamp(1.85rem,4.2vw,3.15rem)] font-medium leading-[1.12] tracking-[-0.035em] text-white sm:max-w-[28rem]";

export function CipherHeadline({
    id,
    children,
}: {
    id: string;
    children: string;
}) {
    const reduced = usePrefersReducedMotion();
    const fine = useFinePointer();
    const native = useSyncExternalStore(emptySubscribe, supportsHtmlInCanvas, () => false);
    const active = native && fine && !reduced;

    return (
        <div className="relative mx-auto w-full max-w-[28rem]">
            <h1 id={id} className={cn(HEADING, active && "invisible")}>
                {children}
            </h1>
            {active ? (
                <DecryptReveal className="absolute inset-0" {...CIPHER}>
                    <h1 aria-hidden className={HEADING}>
                        {children}
                    </h1>
                </DecryptReveal>
            ) : null}
        </div>
    );
}
