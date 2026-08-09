import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "~/lib/utils";

export function LandingShell({ children }: { children: ReactNode }) {
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;
        let cleanup = () => {};
        // Safety: never leave hero steps invisible if motion init fails
        const failsafe = window.setTimeout(() => {
            root.querySelectorAll<HTMLElement>(".landing-hero-step").forEach((el) => {
                el.style.opacity = "1";
                el.style.transform = "none";
            });
        }, 1800);
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
            className={cn(
                "landing-pinnacle relative min-h-[100dvh] w-full overflow-x-hidden bg-[#050505] text-zinc-100",
            )}
            style={{
                fontFamily: '"Geist Sans", "Geist", ui-sans-serif, system-ui, sans-serif',
            }}
        >
            {/* Atmosphere — zinc/white mesh only, no purple */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_-8%,rgba(161,161,170,0.18),transparent_55%)]"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_80%_20%,rgba(255,255,255,0.04),transparent_50%)]"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:4.5rem_4.5rem] [mask-image:radial-gradient(ellipse_55%_45%_at_50%_0%,#000_40%,transparent_100%)]"
            />
            {/* Fixed grain — never on scrolling content */}
            <div
                aria-hidden
                className="pointer-events-none fixed inset-0 z-[1] opacity-[0.035] mix-blend-overlay"
                style={{
                    backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
                }}
            />
            <div className="relative z-[2]">{children}</div>
        </div>
    );
}
