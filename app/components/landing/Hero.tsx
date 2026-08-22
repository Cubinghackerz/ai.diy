import { GithubLogo } from "@phosphor-icons/react";
import { CipherHeadline } from "./CipherHeadline";
import { GITHUB_URL } from "./constants";
import { usePrefersReducedMotion } from "./hooks";
import { LandingCta } from "./LandingCta";
import { ProductBezel } from "./ProductBezel";
import { cn } from "~/lib/utils";

export function Hero() {
    const reduced = usePrefersReducedMotion();

    return (
        <section
            aria-labelledby="hero-heading"
            data-anim-gate="hero"
            className="relative mx-auto max-w-6xl px-5 pb-16 pt-20 sm:px-8 sm:pt-24 lg:pb-20"
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
