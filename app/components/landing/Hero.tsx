import { GithubLogo } from "@phosphor-icons/react";
import { GITHUB_URL } from "./constants";
import { formatStars, useGithubStars, usePrefersReducedMotion } from "./hooks";
import { LandingCta } from "./LandingCta";
import { ProductBezel } from "./ProductBezel";
import { cn } from "~/lib/utils";

export function Hero() {
    const stars = useGithubStars();
    const reduced = usePrefersReducedMotion();
    const starLabel =
        stars != null ? `Star on GitHub (${formatStars(stars)})` : "Star on GitHub";

    return (
        <section
            aria-labelledby="hero-heading"
            data-anim-gate="hero"
            className="relative mx-auto max-w-6xl px-5 pb-16 pt-32 sm:px-8 sm:pt-36 lg:pb-24 lg:pt-44"
        >
            <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
                <div>
                    <p
                        aria-hidden
                        className={cn(
                            "mb-6 font-mono text-[11px] tracking-[0.18em] text-zinc-600",
                            !reduced && "landing-hero-step opacity-0",
                        )}
                        data-hero-step="0"
                    >
                        01 / OWNERSHIP
                    </p>
                    <h1
                        id="hero-heading"
                        className={cn(
                            "max-w-[12ch] text-[clamp(2.6rem,5.4vw,4.6rem)] font-medium leading-[1.02] tracking-[-0.04em] text-white",
                            !reduced && "landing-hero-step opacity-0",
                        )}
                        data-hero-step="1"
                    >
                        Your AI workspace lives in your browser.
                    </h1>

                    <p
                        className={cn(
                            "mt-6 max-w-[30rem] text-base leading-relaxed text-zinc-400 sm:text-lg",
                            !reduced && "landing-hero-step opacity-0",
                        )}
                        data-hero-step="2"
                    >
                        ai.diy is a local-first, bring-your-own-key chat workspace. Chats, Canvas,
                        knowledge, and settings stay in your browser by default while you choose
                        from 20+ cloud and local provider integrations. Add web search, MCP tools,
                        Python, and approved agents without giving up the workspace. No persistent
                        provider keys are required on the server.
                    </p>

                    <div
                        className={cn(
                            "mt-9 flex flex-wrap items-center gap-3",
                            !reduced && "landing-hero-step opacity-0",
                        )}
                        data-hero-step="3"
                    >
                        <LandingCta to="/workspace">Open workspace</LandingCta>
                        <LandingCta
                            href={GITHUB_URL}
                            external
                            variant="ghost"
                            leadingIcon={<GithubLogo weight="light" className="size-4" />}
                        >
                            {starLabel}
                        </LandingCta>
                    </div>

                    <ul
                        className={cn(
                            "mt-12 flex flex-wrap gap-x-8 gap-y-3 font-mono text-[10px] tracking-[0.14em] text-zinc-500 sm:text-[11px]",
                            !reduced && "landing-hero-step opacity-0",
                        )}
                        data-hero-step="4"
                        aria-label="Key facts"
                    >
                        {["LOCAL-FIRST", "20+ PROVIDERS", "MIT LICENSED", "NO PERSISTENT LLM KEYS"].map(
                            (fact) => (
                                <li key={fact} className="flex items-center gap-2">
                                    <span
                                        aria-hidden
                                        className="size-1 rounded-full bg-[var(--landing-mint,#3DFFB0)]"
                                    />
                                    {fact}
                                </li>
                            ),
                        )}
                    </ul>
                </div>

                <div
                    id="demo"
                    className={cn(
                        "relative min-w-0 scroll-mt-28 lg:-mr-16",
                        !reduced && "landing-hero-step opacity-0",
                    )}
                    data-hero-step="5"
                >
                    <div
                        aria-hidden
                        className="pointer-events-none absolute -inset-x-6 -bottom-8 h-36 bg-[radial-gradient(50%_100%_at_50%_100%,rgba(61,255,176,0.14),transparent_70%)] blur-2xl"
                    />
                    <div className="relative">
                        <ProductBezel />
                    </div>
                </div>
            </div>
        </section>
    );
}
