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
            className={cn(
                "landing-pinnacle relative min-h-[100dvh] w-full overflow-x-hidden text-zinc-50",
            )}
            style={{
                backgroundColor: LANDING.canvas,
                fontFamily: '"Geist Sans", "Geist", ui-sans-serif, system-ui, sans-serif',
            }}
        >
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_46%_at_50%_-12%,rgba(255,255,255,0.2),transparent_58%)]"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.42] [background-image:radial-gradient(rgba(255,255,255,0.14)_0.7px,transparent_0.7px)] [background-size:18px_18px] [mask-image:radial-gradient(ellipse_88%_64%_at_50%_18%,#000_18%,transparent_72%)]"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-[max(0.75rem,calc(50%-40rem))] hidden w-px bg-gradient-to-b from-transparent via-white/[0.16] to-transparent lg:block"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-[max(0.75rem,calc(50%-40rem))] hidden w-px bg-gradient-to-b from-transparent via-white/[0.16] to-transparent lg:block"
            />
            <div
                aria-hidden
                className="pointer-events-none fixed inset-0 z-[1] opacity-[0.025] mix-blend-overlay"
                style={{
                    backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
                }}
            />

            <div className="relative z-[2]">{children}</div>
        </div>
    );
}
