import { GITHUB_URL } from "./constants";
import { LandingCta } from "./LandingCta";

export function ClosingBand() {
    return (
        <section
            data-anim-gate="closing"
            className="relative border-t border-white/[0.08] px-5 py-24 sm:px-8 sm:py-32"
        >
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-[radial-gradient(ellipse_55%_70%_at_50%_100%,rgba(61,255,176,0.07),transparent_65%)]"
            />
            <div className="relative mx-auto max-w-3xl text-center">
                <h2 className="text-[clamp(2.4rem,5.5vw,4.25rem)] font-medium leading-[1.04] tracking-[-0.04em] text-white">
                    Your models. Your data. Your machine.
                </h2>
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
                    <span>17 PROVIDERS</span>
                    <span aria-hidden>·</span>
                    <span>ZERO SERVER LLM KEYS</span>
                    <span aria-hidden>·</span>
                    <span>INDEXEDDB PERSISTENCE</span>
                    <span aria-hidden>·</span>
                    <span>MIT LICENSED</span>
                </p>
            </div>
        </section>
    );
}
