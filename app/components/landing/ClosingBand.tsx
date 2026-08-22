import { GITHUB_URL } from "./constants";
import { LandingCta } from "./LandingCta";
import { MaskedHeading } from "./MaskedHeading";

export function ClosingBand() {
    return (
        <section
            data-anim-gate="closing"
            className="relative border-t border-white/[0.08] px-5 py-32 sm:px-8 sm:py-44"
        >
            <div className="relative mx-auto max-w-3xl text-center">
                <MaskedHeading className="text-[clamp(2.4rem,5.5vw,4.25rem)] font-medium leading-[1.04] tracking-[-0.04em] text-white">
                    Your models. Your data. Your machine.
                </MaskedHeading>
                <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-zinc-400 sm:text-base">
                    Open the workspace, drop in a key, and start thinking. Or clone the repo and
                    self-host in one command.
                </p>
                <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                    <LandingCta to="/workspace">Open workspace</LandingCta>
                    <LandingCta href={GITHUB_URL} external variant="ghost">
                        View on GitHub
                    </LandingCta>
                </div>
                <p className="mt-14 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-[10px] tracking-[0.14em] text-zinc-600">
                    <span>20+ PROVIDERS</span>
                    <span aria-hidden className="size-px self-center bg-white/25" />
                    <span>NO PERSISTENT LLM KEYS</span>
                    <span aria-hidden className="size-px self-center bg-white/25" />
                    <span>INDEXEDDB PERSISTENCE</span>
                    <span aria-hidden className="size-px self-center bg-white/25" />
                    <span>MIT LICENSED</span>
                </p>
            </div>
        </section>
    );
}
