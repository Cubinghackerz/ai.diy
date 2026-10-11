import { GithubLogo } from "@phosphor-icons/react";
import { GITHUB_URL } from "./constants";
import { usePrefersReducedMotion } from "./hooks";
import { LandingCta } from "./LandingCta";
import { ProductBezel } from "./ProductBezel";
import { cn } from "~/lib/utils";

export function Hero() {
    const reduced = usePrefersReducedMotion();
    // Each step fades in once; reduced motion renders everything immediately.
    const step = !reduced && "landing-hero-step opacity-0";

    return (
        <section
            aria-labelledby="hero-heading"
            data-anim-gate="hero"
            className="mx-auto max-w-6xl px-6 pb-24 pt-32 sm:pb-32 sm:pt-40"
        >
            <div className="mx-auto max-w-3xl text-center">
                <h1
                    id="hero-heading"
                    data-hero-step="1"
                    className={cn(
                        "text-balance text-[clamp(2.5rem,6.5vw,4.5rem)] font-semibold leading-[1.04] tracking-[-0.04em] text-white",
                        step,
                    )}
                >
                    Your AI workspace lives in your browser.
                </h1>
                <p
                    data-hero-step="2"
                    className={cn(
                        "mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-zinc-400",
                        step,
                    )}
                >
                    Bring your own key. Chats, files, and knowledge stay in your browser; the server
                    stores no provider keys.
                </p>
                <div
                    data-hero-step="3"
                    className={cn("mt-10 flex flex-wrap items-center justify-center gap-3", step)}
                >
                    <LandingCta to="/workspace">Open workspace</LandingCta>
                    <LandingCta
                        href={GITHUB_URL}
                        external
                        variant="ghost"
                        leadingIcon={<GithubLogo weight="regular" className="size-4" />}
                    >
                        View on GitHub
                    </LandingCta>
                </div>
            </div>

            <div
                id="demo"
                data-hero-step="4"
                className={cn("mt-16 min-w-0 scroll-mt-24 sm:mt-20", step)}
            >
                <ProductBezel />
            </div>
        </section>
    );
}
