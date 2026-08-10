import { Link } from "react-router";
import {
    ArrowUpRight,
    Code,
    HardDrives,
    Key,
    MagnifyingGlass,
    Stack,
} from "@phosphor-icons/react";
import { GITHUB_URL, VERCEL_DEPLOY_URL } from "./constants";
import { EASE_OUT } from "./motion";
import { cn } from "~/lib/utils";

const FLOATERS = [
    { Icon: Key, className: "left-[8%] top-[18%]" },
    { Icon: MagnifyingGlass, className: "left-[18%] bottom-[22%]" },
    { Icon: Code, className: "right-[20%] top-[20%]" },
    { Icon: Stack, className: "right-[10%] bottom-[24%]" },
    { Icon: HardDrives, className: "left-[46%] top-[12%]" },
] as const;

/** Cloudflare bottom CTA band — monochrome luminous version. */
export function ClosingBand() {
    return (
        <section
            className="relative px-4 pb-16 pt-6 sm:px-6 lg:px-8"
            data-anim-gate="closing"
        >
            <div
                className={cn(
                    "landing-closing-band relative mx-auto max-w-6xl overflow-hidden rounded-[1.75rem] border border-white/16 sm:rounded-[2rem]",
                )}
                style={{
                    background:
                        "radial-gradient(100% 80% at 50% 120%, rgba(255,255,255,0.34) 0%, transparent 45%), linear-gradient(180deg, #252529 0%, #111114 100%)",
                }}
            >
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 opacity-55 [background-image:radial-gradient(rgba(255,255,255,0.17)_0.6px,transparent_0.6px)] [background-size:14px_14px]"
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
                            "landing-floater absolute hidden size-12 items-center justify-center rounded-2xl border border-dashed border-white/30 bg-white/[0.08] text-zinc-300 sm:flex",
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
                        <Link
                            to="/workspace"
                            className="group inline-flex min-h-12 items-center gap-2 rounded-full bg-white py-2.5 pl-6 pr-2.5 text-[14px] font-medium text-black transition-[transform,background-color] duration-200 hover:bg-zinc-100 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                            style={{ transitionTimingFunction: EASE_OUT }}
                        >
                            Open workspace
                            <span className="inline-flex size-8 items-center justify-center rounded-full bg-black/10 transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-0.5">
                                <ArrowUpRight weight="bold" className="size-3.5" />
                            </span>
                        </Link>
                        <a
                            href={GITHUB_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-12 items-center rounded-full border border-white/30 bg-white/[0.09] px-5 py-2.5 text-[14px] font-medium text-zinc-100 transition-[border-color,background-color,transform] duration-200 hover:border-white/50 hover:bg-white/[0.14] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                            style={{ transitionTimingFunction: EASE_OUT }}
                        >
                            View on GitHub
                        </a>
                        <a
                            href={VERCEL_DEPLOY_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-12 items-center rounded-full border border-white/30 bg-white/[0.09] px-5 py-2.5 text-[14px] font-medium text-zinc-100 transition-[border-color,background-color,transform] duration-200 hover:border-white/50 hover:bg-white/[0.14] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                            style={{ transitionTimingFunction: EASE_OUT }}
                        >
                            Deploy to Vercel
                        </a>
                    </div>
                </div>

                <div className="relative border-t border-white/[0.08] px-4 py-3">
                    <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[10px] tracking-wide text-zinc-500 sm:justify-between">
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
