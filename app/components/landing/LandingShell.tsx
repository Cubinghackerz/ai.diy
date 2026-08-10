import { type ReactNode, useEffect, useRef } from "react";
import { Link } from "react-router";
import { ArrowUpRight } from "@phosphor-icons/react";
import { cn } from "~/lib/utils";
import { EASE_OUT } from "./motion";

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
        }, 2200);
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
                "landing-pinnacle relative min-h-[100dvh] w-full overflow-x-hidden bg-[#111114] text-zinc-50",
            )}
            style={{
                fontFamily: '"Geist Sans", "Geist", ui-sans-serif, system-ui, sans-serif',
            }}
        >
            {/* Soft top atmosphere */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_50%_at_50%_-10%,rgba(255,255,255,0.28),transparent_58%)]"
            />
            {/* Cloudflare-style dotted field */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.7] [background-image:radial-gradient(rgba(255,255,255,0.14)_0.7px,transparent_0.7px)] [background-size:18px_18px] [mask-image:radial-gradient(ellipse_90%_70%_at_50%_20%,#000_20%,transparent_75%)]"
            />
            {/* Vertical stage rails */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-[max(0.75rem,calc(50%-40rem))] hidden w-px bg-gradient-to-b from-transparent via-white/[0.18] to-transparent lg:block"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-[max(0.75rem,calc(50%-40rem))] hidden w-px bg-gradient-to-b from-transparent via-white/[0.18] to-transparent lg:block"
            />
            {/* Fixed grain */}
            <div
                aria-hidden
                className="pointer-events-none fixed inset-0 z-[1] opacity-[0.03] mix-blend-overlay"
                style={{
                    backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
                }}
            />

            {/* Floating sticky CTA — Cloudflare pattern, white brand CTA */}
            <Link
                to="/workspace"
                className="group fixed right-4 top-5 z-50 hidden min-h-10 items-center gap-2 rounded-full bg-white py-1.5 pl-4 pr-1.5 text-[12px] font-medium text-black shadow-[0_10px_40px_-12px_rgba(255,255,255,0.35)] transition-[transform,background-color] duration-200 hover:bg-zinc-200 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 sm:right-6 sm:top-6 md:inline-flex"
                style={{ transitionTimingFunction: EASE_OUT }}
            >
                Open workspace
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-black/10 transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-0.5">
                    <ArrowUpRight weight="bold" className="size-3.5" />
                </span>
            </Link>

            <div className="relative z-[2]">{children}</div>
        </div>
    );
}
