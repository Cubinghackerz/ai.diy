import { type ReactNode, useEffect, useRef } from "react";
import { revealHeroSteps } from "~/lib/landing-reveal";
import { cn } from "~/lib/utils";
import { LANDING } from "./tokens";

export function LandingShell({ children }: { children: ReactNode }) {
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;
        let cleanup = () => {};
        let revealed = false;
        const markRevealed = () => {
            if (revealed) return;
            revealed = true;
            window.clearTimeout(failsafe);
            revealHeroSteps(root);
        };
        // Stays armed until the tween's onComplete (or this timeout). Do not
        // clear it when the animation module resolves — GSAP applies opacity 0
        // only after that, and a stalled ticker would leave the hero invisible.
        const failsafe = window.setTimeout(markRevealed, 1200);
        void import("~/lib/landing-animations.client")
            .then(({ initLandingAnimations }) =>
                initLandingAnimations(root, { onRevealed: markRevealed }),
            )
            .then((dispose) => {
                cleanup = dispose;
            })
            .catch(markRevealed);
        return () => {
            window.clearTimeout(failsafe);
            cleanup();
        };
    }, []);

    return (
        <div
            ref={rootRef}
            className={cn(
                "landing-pinnacle relative min-h-[100dvh] w-full overflow-x-clip text-zinc-50",
            )}
            style={{
                backgroundColor: LANDING.canvas,
                fontFamily: '"Geist Sans", "Geist", ui-sans-serif, system-ui, sans-serif',
                ["--landing-canvas" as string]: LANDING.canvas,
                ["--landing-mint" as string]: LANDING.mint,
            }}
        >
            <div className="relative z-[2]">{children}</div>
        </div>
    );
}
