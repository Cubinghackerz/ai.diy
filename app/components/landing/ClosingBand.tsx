import {
    Code,
    HardDrives,
    Key,
    MagnifyingGlass,
    Stack,
} from "@phosphor-icons/react";
import { GITHUB_URL } from "./constants";
import { LandingCta } from "./LandingCta";
import { LANDING } from "./tokens";
import { cn } from "~/lib/utils";

const FLOATERS = [
    { Icon: Key, className: "left-[8%] top-[18%]" },
    { Icon: MagnifyingGlass, className: "left-[18%] bottom-[22%]" },
    { Icon: Code, className: "right-[20%] top-[20%]" },
    { Icon: Stack, className: "right-[10%] bottom-[24%]" },
    { Icon: HardDrives, className: "left-[46%] top-[12%]" },
] as const;

export function ClosingBand() {
    return (
        <section
            className="relative px-4 pb-16 pt-6 sm:px-6 lg:px-8"
            data-anim-gate="closing"
        >
            <div
                className="landing-closing-band relative mx-auto max-w-6xl overflow-hidden rounded-[1.75rem] border border-white/[0.18] shadow-[0_40px_120px_-48px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.1)] sm:rounded-[2rem]"
                style={{ background: LANDING.closingGradient }}
            >
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 opacity-45 [background-image:radial-gradient(rgba(255,255,255,0.17)_0.6px,transparent_0.6px)] [background-size:14px_14px]"
                />
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(ellipse_70%_80%_at_50%_100%,rgba(255,255,255,0.26),transparent_60%)]"
                />

                {FLOATERS.map(({ Icon, className }) => (
                    <span
                        key={className}
                        aria-hidden
                        className={cn(
                            "landing-floater absolute hidden size-12 items-center justify-center rounded-xl border border-dashed border-white/30 bg-white/[0.08] text-zinc-300 sm:flex",
                            className,
                        )}
                    >
                        <Icon weight="light" className="size-5" />
                    </span>
                ))}

                <div className="relative mx-auto flex min-h-[22rem] max-w-2xl flex-col items-center justify-center px-6 py-16 text-center sm:py-20">
                    <h2 className="text-4xl font-medium tracking-[-0.04em] text-white sm:text-5xl">
                        Build without lock-in.
                    </h2>
                    <p className="mt-4 max-w-md text-[15px] leading-relaxed text-zinc-300">
                        Open the workspace, drop in a key, and keep every conversation on your
                        machine. Or clone the repo and self-host in one command.
                    </p>
                    <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                        <LandingCta to="/workspace">Open workspace</LandingCta>
                        <LandingCta href={GITHUB_URL} external variant="ghost">
                            View on GitHub
                        </LandingCta>
                    </div>
                </div>

                <div className="relative border-t border-white/[0.1] px-4 py-3">
                    <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[10px] tracking-wide text-zinc-400 sm:justify-between">
                        <span>17 providers</span>
                        <span>Zero server LLM keys</span>
                        <span>IndexedDB persistence</span>
                        <span>MIT licensed</span>
                    </div>
                </div>
            </div>
        </section>
    );
}
