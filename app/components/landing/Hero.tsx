import { GithubLogo } from "@phosphor-icons/react";
import { CipherHeadline } from "./CipherHeadline";
import { GITHUB_URL } from "./constants";
import { usePrefersReducedMotion } from "./hooks";
import { LandingCta } from "./LandingCta";
import { ProductBezel } from "./ProductBezel";
import { cn } from "~/lib/utils";

const FACTS = ["LOCAL-FIRST", "20+ PROVIDERS", "MIT LICENSED", "NO PERSISTENT LLM KEYS"] as const;

export function Hero() {
    const reduced = usePrefersReducedMotion();

    return (
        <section
            aria-labelledby="hero-heading"
            data-anim-gate="hero"
            className="relative mx-auto max-w-6xl px-5 pb-16 pt-28 sm:px-8 sm:pt-32 lg:pb-20 lg:pt-36"
        >
            <div className="mx-auto max-w-3xl text-center">
                <CipherHeadline id="hero-heading">
                    Your AI workspace lives in your browser.
                </CipherHeadline>

                <p
                    className={cn(
                        "mx-auto mt-6 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg",
                        !reduced && "landing-hero-step opacity-0",
                    )}
                    data-hero-step="2"
                >
                    Use AI, npm packages, Canvas, Python, and browser tools to create presentations,
                    documents, code, and useful files. Your chats, files, knowledge, and settings
                    stay in your browser, with no persistent provider keys required on the server.
                </p>

                <div
                    className={cn(
                        "mt-10 flex flex-wrap items-center justify-center gap-3",
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
                            View on GitHub
                    </LandingCta>
                </div>

                <ul
                    className={cn(
                        "mt-12 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 font-mono text-[10px] tracking-[0.16em] text-zinc-500 sm:text-[11px]",
                        !reduced && "landing-hero-step opacity-0",
                    )}
                    data-hero-step="4"
                    aria-label="Key facts"
                >
                    {FACTS.map((fact) => (
                        <li key={fact} className="flex items-center gap-2">
                            <span
                                aria-hidden
                                className="size-1 rounded-full bg-[var(--landing-mint,#3DFFB0)]"
                            />
                            {fact}
                        </li>
                    ))}
                </ul>
            </div>

            <div
                id="demo"
                className={cn(
                    "relative mt-12 min-w-0 scroll-mt-28 lg:mt-14",
                    !reduced && "landing-hero-step opacity-0",
                )}
                data-hero-step="5"
            >
                <ProductBezel />
            </div>
        </section>
    );
}
