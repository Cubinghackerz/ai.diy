import { GITHUB_URL } from "./constants";
import { LandingCta } from "./LandingCta";

export function ClosingBand() {
    return (
        <section data-anim-gate="closing" className="px-6 py-28 sm:py-40">
            <div className="mx-auto max-w-3xl text-center">
                <h2 className="text-balance text-[clamp(2.25rem,5.5vw,3.75rem)] font-semibold leading-[1.06] tracking-[-0.04em] text-white">
                    Your models. Your data. Your machine.
                </h2>
                <p className="mx-auto mt-5 max-w-md text-pretty text-base leading-relaxed text-zinc-400">
                    Open the workspace, drop in a key, and start thinking. Or clone the repo and
                    self-host in one command.
                </p>
                <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                    <LandingCta to="/workspace">Start chatting</LandingCta>
                    <LandingCta href={GITHUB_URL} external variant="ghost">
                        View on GitHub
                    </LandingCta>
                </div>
            </div>
        </section>
    );
}
