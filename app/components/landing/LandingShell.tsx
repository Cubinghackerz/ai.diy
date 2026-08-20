import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "~/lib/utils";
import { LANDING } from "./tokens";

export function LandingShell({ children }: { children: ReactNode }) {
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;
        let cleanup = () => {};
        const failsafe = window.setTimeout(() => {
            root.querySelectorAll<HTMLElement>(".landing-hero-step").forEach((el) => {
                el.style.opacity = "1";
                el.style.transform = "none";
                el.style.filter = "none";
            });
        }, 1200);
        void import("~/lib/landing-animations.client").then(({ initLandingAnimations }) => {
            void initLandingAnimations(root).then((dispose) => {
                window.clearTimeout(failsafe);
                cleanup = dispose;
            });
        });
        return () => {
            window.clearTimeout(failsafe);
            cleanup();
        };
    }, []);

    return (
        <div
            ref={rootRef}
            className={cn("landing-pinnacle relative min-h-[100dvh] w-full overflow-x-hidden text-zinc-50")}
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
