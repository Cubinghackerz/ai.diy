import { ArrowLeft, ArrowUpRight, WarningCircle } from "@phosphor-icons/react";
import { Link } from "react-router";

export function LaunchFallback({
    eyebrow,
    title,
    description,
}: {
    eyebrow: string;
    title: string;
    description: string;
}) {
    return (
        <main className="flex min-h-dvh w-full items-center justify-center overflow-hidden bg-[#050505] px-5 text-zinc-100 sm:px-8">
            <div className="relative w-full max-w-xl py-20">
                <div
                    aria-hidden
                    className="pointer-events-none absolute -inset-24 bg-[radial-gradient(ellipse_at_top,rgba(161,161,170,0.16),transparent_58%)]"
                />
                <div className="relative">
                    <Link
                        to="/"
                        className="font-mono text-[13px] font-medium tracking-tight text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                    >
                        ai.diy
                    </Link>
                    <div className="mt-16 flex items-start gap-4">
                        <WarningCircle
                            weight="light"
                            className="mt-1 size-6 shrink-0 text-zinc-500"
                            aria-hidden
                        />
                        <div>
                            <h1 className="max-w-lg text-3xl font-medium tracking-[-0.03em] text-white sm:text-5xl">
                                {title}
                            </h1>
                            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-zinc-500 sm:text-base">
                                {description}
                            </p>
                            <p className="mt-6 font-mono text-[11px] tracking-wide text-zinc-600">
                                {eyebrow}
                            </p>
                            <div className="mt-9 flex flex-wrap items-center gap-3">
                                <Link
                                    to="/workspace"
                                    reloadDocument
                                    className="group inline-flex min-h-11 items-center gap-2 rounded-full bg-white py-2 pl-5 pr-2 text-[13px] font-medium text-black transition-[transform,background-color] duration-200 hover:bg-zinc-200 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                                >
                                    Open Workspace
                                    <span className="inline-flex size-8 items-center justify-center rounded-full bg-black/10 transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-0.5">
                                        <ArrowUpRight weight="bold" className="size-3.5" />
                                    </span>
                                </Link>
                                <Link
                                    to="/"
                                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/[0.12] px-5 py-2 text-[13px] font-medium text-zinc-300 transition-[border-color,color,transform] duration-200 hover:border-white/25 hover:text-white active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                                >
                                    <ArrowLeft weight="light" className="size-4" />
                                    Back home
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
