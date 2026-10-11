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
                <p
                    data-hero-step="0"
                    className={cn(
                        "mb-5 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500",
                        step,
                    )}
                >
                    Free · open source · bring your own key
                </p>
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
                    <LandingCta to="/workspace">Start chatting</LandingCta>
                    <LandingCta
                        href={GITHUB_URL}
                        external
                        variant="ghost"
                        leadingIcon={<GithubLogo weight="regular" className="size-4" />}
                    >
                        View on GitHub
                    </LandingCta>
                </div>
                <p data-hero-step="3" className={cn("mt-5 text-sm text-zinc-500", step)}>
                    Sign in with ChatGPT or paste an API key. No account to create.
                </p>
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
