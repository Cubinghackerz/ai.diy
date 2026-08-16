import { GithubLogo } from "@phosphor-icons/react";
import { StatusPill } from "./BlueprintFrame";
import { GITHUB_URL } from "./constants";
import { formatStars, useGithubStars, usePrefersReducedMotion } from "./hooks";
import { LandingCta } from "./LandingCta";
import { ProductBezel } from "./ProductBezel";
import { LANDING } from "./tokens";
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
            className="relative px-4 pb-10 pt-24 sm:px-6 sm:pt-28 lg:px-8 lg:pb-16"
        >
            <div
                className={cn(
                    "landing-hero-panel relative mx-auto max-w-6xl overflow-hidden rounded-[1.75rem] border border-white/[0.18] shadow-[0_40px_120px_-48px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.12)] sm:rounded-[2rem]",
                    !reduced && "landing-hero-step opacity-0",
                )}
                data-hero-step="0"
                style={{ background: LANDING.panelGradient }}
            >
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(rgba(255,255,255,0.16)_0.6px,transparent_0.6px)] [background-size:14px_14px]"
                />
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-[radial-gradient(ellipse_80%_80%_at_50%_100%,rgba(255,255,255,0.28),transparent_62%)]"
                />

                <div className="relative flex min-h-[min(72dvh,36rem)] flex-col items-center justify-center px-6 py-16 text-center sm:px-12 sm:py-20 lg:min-h-[34rem]">
                    <div
                        className={cn(
                            "mb-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.1] px-3.5 py-1.5 font-mono text-[11px] text-zinc-200",
                            !reduced && "landing-hero-step opacity-0",
                        )}
                        data-hero-step="1"
                    >
                        <span className="size-1.5 rounded-full bg-[var(--landing-mint,#3DFFB0)]" />
                        Local-first · BYOK · MIT
                    </div>

                    <h1
                        id="hero-heading"
                        className={cn(
                            "max-w-[16ch] text-[clamp(2.25rem,6.5vw,4.75rem)] font-medium leading-[1.05] tracking-[-0.04em] text-white",
                            !reduced && "landing-hero-step opacity-0",
                        )}
                        data-hero-step="2"
                    >
                        ai.diy: the open-source AI workspace you own.
                    </h1>

                    <p
                        className={cn(
                            "mt-6 max-w-[34rem] text-[15px] leading-relaxed text-zinc-300 sm:text-base",
                            !reduced && "landing-hero-step opacity-0",
                        )}
                        data-hero-step="3"
                    >
                        ai.diy is a local-first, bring-your-own-key (BYOK) AI chat workspace. Keep
                        keys, chats, Canvas, memory, and knowledge in the browser. Self-host with
                        Node or Docker - no server-side LLM credentials.
                    </p>

                    <div
                        className={cn(
                            "mt-9 flex flex-wrap items-center justify-center gap-3",
                            !reduced && "landing-hero-step opacity-0",
                        )}
                        data-hero-step="4"
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
