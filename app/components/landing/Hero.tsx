import { Check, CopySimple, GithubLogo } from "@phosphor-icons/react";
import { CipherHeadline } from "./CipherHeadline";
import { CornerFrame } from "./CornerFrame";
import { GITHUB_REPO, GITHUB_URL, PROVIDER_INTEGRATION_COUNT } from "./constants";
import { useCopy, usePrefersReducedMotion } from "./hooks";
import { LandingCta } from "./LandingCta";
import { ProductBezel } from "./ProductBezel";
import { StatusPill } from "./StatusPill";
import { cn } from "~/lib/utils";

const CLONE_COMMAND = `git clone ${GITHUB_URL}`;

export function Hero() {
    const reduced = usePrefersReducedMotion();
    const { copied, copy } = useCopy(CLONE_COMMAND);

    return (
        <section
            aria-labelledby="hero-heading"
            data-anim-gate="hero"
            className="relative mx-auto max-w-6xl px-5 pb-16 pt-24 sm:px-8 sm:pb-24 sm:pt-24"
        >
            <div className="mx-auto max-w-3xl text-center">
                <div
                    className={cn(
                        "mb-6 flex flex-wrap items-center justify-center gap-2",
                        !reduced && "landing-hero-step opacity-0",
                    )}
                    data-hero-step="1"
                >
                    <StatusPill tone="live" pulse>
                        Open source
                    </StatusPill>
                    <StatusPill>Bring your own key</StatusPill>
                    <StatusPill>Local-first</StatusPill>
                    <StatusPill>{PROVIDER_INTEGRATION_COUNT} providers</StatusPill>
                </div>
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
                    Bring your own key. Chats, files, and knowledge stay in your browser; the server
                    stores no provider keys.
                </p>

                <div
                    className={cn(
                        "mt-8 flex flex-wrap items-center justify-center gap-3",
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
                <div
                    className={cn(
                        "mt-5 flex min-w-0 justify-center",
                        !reduced && "landing-hero-step opacity-0",
                    )}
                    data-hero-step="4"
                >
                    <button
                        type="button"
                        onClick={copy}
                        aria-label={
                            copied
                                ? `Copied git clone github.com/${GITHUB_REPO}`
                                : `Copy git clone github.com/${GITHUB_REPO}`
                        }
                        className="group inline-flex min-h-10 min-w-0 max-w-full items-center gap-3 rounded-[2px] border border-white/[0.1] bg-[#0a0a0a] px-3.5 font-mono text-[12px] text-zinc-400 transition-[border-color,color] duration-150 hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                    >
                        <span className="text-zinc-500" aria-hidden>
                            $
                        </span>
                        <span className="truncate">git clone github.com/{GITHUB_REPO}</span>
                        {copied ? (
                            <Check
                                weight="light"
                                className="size-3.5 text-[var(--landing-mint,#3DFFB0)]"
                            />
                        ) : (
                            <CopySimple weight="light" className="size-3.5" />
                        )}
                    </button>
                </div>
            </div>

            <div
                id="demo"
                className={cn(
                    "relative mt-10 min-w-0 scroll-mt-28",
                    !reduced && "landing-hero-step opacity-0",
                )}
                data-hero-step="5"
            >
                <CornerFrame>
                    <ProductBezel />
                </CornerFrame>
            </div>
        </section>
    );
}
