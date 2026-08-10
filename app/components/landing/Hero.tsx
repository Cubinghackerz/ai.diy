import { Link } from "react-router";
import { ArrowUpRight, GithubLogo } from "@phosphor-icons/react";
import { StatusPill } from "./BlueprintFrame";
import { GITHUB_URL, VERCEL_DEPLOY_URL } from "./constants";
import { formatStars, useGithubStars, usePrefersReducedMotion } from "./hooks";
import { EASE_OUT } from "./motion";
import { ProductBezel } from "./ProductBezel";
import { cn } from "~/lib/utils";

export function Hero() {
    const stars = useGithubStars();
    const reduced = usePrefersReducedMotion();
    const starLabel =
        stars != null ? `Star on GitHub (${formatStars(stars)})` : "Star on GitHub";

    return (
        <section
            data-anim-gate="hero"
            className="relative px-4 pb-10 pt-24 sm:px-6 sm:pt-28 lg:px-8 lg:pb-16"
        >
            {/* Full-bleed luminous panel — CF orange panel, monochrome */}
            <div
                className={cn(
                        "landing-hero-panel relative mx-auto max-w-6xl overflow-hidden rounded-[1.75rem] border border-white/[0.16] sm:rounded-[2rem]",
                    !reduced && "landing-hero-step opacity-0",
                )}
                data-hero-step="0"
                style={{
                    background:
                        "radial-gradient(120% 90% at 50% 110%, rgba(255,255,255,0.38) 0%, transparent 44%), linear-gradient(180deg, #323238 0%, #1c1c22 48%, #121216 100%)",
                }}
            >
                {/* Dot texture inside panel */}
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(rgba(255,255,255,0.16)_0.6px,transparent_0.6px)] [background-size:14px_14px]"
                />
                {/* Bottom bloom */}
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-[radial-gradient(ellipse_80%_80%_at_50%_100%,rgba(255,255,255,0.25),transparent_60%)]"
                />

                <div className="relative flex min-h-[min(72dvh,36rem)] flex-col items-center justify-center px-6 py-16 text-center sm:px-12 sm:py-20 lg:min-h-[34rem]">
                    <div
                        className={cn(
                            "mb-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.1] px-3.5 py-1.5 font-mono text-[11px] text-zinc-200 backdrop-blur-sm",
                            !reduced && "landing-hero-step opacity-0",
                        )}
                        data-hero-step="1"
                    >
                        <span className="size-1.5 rounded-full bg-emerald-400" />
                        Local-first · BYOK · MIT
                    </div>

                    <h1
                        className={cn(
                            "max-w-[16ch] text-[clamp(2.25rem,6.5vw,4.75rem)] font-medium leading-[1.05] tracking-[-0.04em] text-white",
                            !reduced && "landing-hero-step opacity-0",
                        )}
                        data-hero-step="2"
                    >
                        The open-source AI workspace you own.
                    </h1>

                    <p
                        className={cn(
                            "mt-6 max-w-[34rem] text-[15px] leading-relaxed text-zinc-300 sm:text-base",
                            !reduced && "landing-hero-step opacity-0",
                        )}
                        data-hero-step="3"
                    >
                        Bring your own keys. Keep chats, Canvas, memory, and knowledge in the
                        browser. Run Node or Docker — zero server-side LLM credentials.
                    </p>

                    <div
                        className={cn(
                            "mt-9 flex flex-wrap items-center justify-center gap-3",
                            !reduced && "landing-hero-step opacity-0",
                        )}
                        data-hero-step="4"
                    >
                        <Link
                            to="/workspace"
                            className="group inline-flex min-h-12 items-center gap-2 rounded-full bg-white py-2.5 pl-6 pr-2.5 text-[14px] font-medium text-black transition-[transform,background-color] duration-200 hover:bg-zinc-100 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                            style={{ transitionTimingFunction: EASE_OUT }}
                        >
                            Open workspace
                            <span className="inline-flex size-8 items-center justify-center rounded-full bg-black/10 transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-0.5 group-hover:scale-105">
                                <ArrowUpRight weight="bold" className="size-3.5" />
                            </span>
                        </Link>
                        <a
                            href={GITHUB_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/25 bg-white/[0.08] px-5 py-2.5 text-[14px] font-medium text-zinc-100 transition-[border-color,background-color,transform] duration-200 hover:border-white/45 hover:bg-white/[0.14] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                            style={{ transitionTimingFunction: EASE_OUT }}
                        >
                            <GithubLogo weight="light" className="size-4" />
                            {starLabel}
                        </a>
                        <a
                            href={VERCEL_DEPLOY_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/25 bg-white/[0.08] px-5 py-2.5 text-[14px] font-medium text-zinc-100 transition-[border-color,background-color,transform] duration-200 hover:border-white/45 hover:bg-white/[0.14] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                            style={{ transitionTimingFunction: EASE_OUT }}
                        >
                            Deploy to Vercel
                        </a>
                    </div>

                    <div
                        className={cn(
                            "mt-8 flex flex-wrap items-center justify-center gap-2",
                            !reduced && "landing-hero-step opacity-0",
                        )}
                        data-hero-step="5"
                        aria-label="System facts"
                    >
                        <StatusPill tone="live" pulse>
                            Systems normal
                        </StatusPill>
                        <StatusPill>17 providers</StatusPill>
                        <StatusPill>Browser storage</StatusPill>
                        <StatusPill>Keyless search</StatusPill>
                    </div>
                </div>
            </div>

            {/* Product proof under the panel */}
            <div
                id="demo"
                className={cn(
                    "mx-auto mt-10 w-full max-w-5xl scroll-mt-28 px-1 sm:mt-14",
                    !reduced && "landing-hero-step opacity-0",
                )}
                data-hero-step="6"
            >
                <ProductBezel />
            </div>
        </section>
    );
}
