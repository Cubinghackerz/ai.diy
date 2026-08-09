import { Link } from "react-router";
import { ArrowRight, ArrowUpRight, GithubLogo } from "@phosphor-icons/react";
import { GITHUB_URL } from "./constants";
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
            className="mx-auto flex min-h-[min(100dvh,54rem)] max-w-6xl flex-col items-center px-5 pb-16 pt-28 text-center sm:px-8 sm:pt-32 lg:pb-20"
        >
            <a
                href="#features"
                className={cn(
                    "mb-7 inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.03] px-3.5 py-1.5 font-mono text-[11px] text-zinc-400 transition-[border-color,color,transform] duration-200 hover:border-white/20 hover:text-zinc-200 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                    !reduced && "landing-hero-step opacity-0",
                )}
                style={{ transitionTimingFunction: EASE_OUT }}
                data-hero-step="0"
            >
                Free web search via Firecrawl &amp; Parallel
                <ArrowRight weight="bold" className="size-3 opacity-70" />
            </a>

            <h1
                className={cn(
                    "max-w-[14ch] text-[clamp(2.4rem,5.5vw,4rem)] font-medium leading-[1.05] tracking-[-0.04em] text-white",
                    !reduced && "landing-hero-step opacity-0",
                )}
                data-hero-step="1"
            >
                The open-source AI workspace you own.
            </h1>

            <p
                className={cn(
                    "mt-5 max-w-[38rem] text-[15px] leading-relaxed text-zinc-500 sm:text-base",
                    !reduced && "landing-hero-step opacity-0",
                )}
                data-hero-step="2"
            >
                Local-first, bring-your-own-key chat with streaming reasoning, multi-model
                switching, and Canvas artifacts. Zero server-side LLM credentials.
            </p>

            <div
                className={cn(
                    "mt-9 flex flex-wrap items-center justify-center gap-3",
                    !reduced && "landing-hero-step opacity-0",
                )}
                data-hero-step="3"
            >
                <Link
                    to="/workspace"
                    className="group inline-flex min-h-11 items-center gap-2 rounded-full bg-white py-2 pl-5 pr-2 text-[13px] font-medium text-black transition-[transform,background-color] duration-200 hover:bg-zinc-200 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                    style={{ transitionTimingFunction: EASE_OUT }}
                >
                    Open Workspace
                    <span className="inline-flex size-8 items-center justify-center rounded-full bg-black/10 transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-0.5 group-hover:scale-105">
                        <ArrowUpRight weight="bold" className="size-3.5" />
                    </span>
                </Link>
                <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.02] px-5 py-2 text-[13px] font-medium text-zinc-300 transition-[border-color,color,transform,background-color] duration-200 hover:border-white/25 hover:text-white active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                    style={{ transitionTimingFunction: EASE_OUT }}
                >
                    <GithubLogo weight="light" className="size-4" />
                    {starLabel}
                </a>
            </div>

            <div
                id="demo"
                className={cn(
                    "mt-14 w-full max-w-[52rem] scroll-mt-28 sm:mt-16",
                    !reduced && "landing-hero-step opacity-0",
                )}
                data-hero-step="4"
            >
                <ProductBezel />
            </div>
        </section>
    );
}
