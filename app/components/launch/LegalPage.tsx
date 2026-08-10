import { ArrowLeft, ArrowUpRight, XLogo } from "@phosphor-icons/react";
import { Link } from "react-router";
import type { ReactNode } from "react";
import { GITHUB_URL, TWITTER_URL } from "~/components/landing/constants";

export function LegalPage({
    title,
    intro,
    updated,
    children,
}: {
    title: string;
    intro: string;
    updated: string;
    children: ReactNode;
}) {
    return (
        <div className="min-h-dvh w-full overflow-x-hidden bg-[#050505] text-zinc-100">
            <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
                <Link
                    to="/"
                    className="font-mono text-[13px] font-medium tracking-tight text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                    ai.diy
                </Link>
                <Link
                    to="/workspace"
                    className="group inline-flex min-h-10 items-center gap-2 rounded-full bg-white py-1.5 pl-4 pr-1.5 text-[12px] font-medium text-black transition-[transform,background-color] duration-200 hover:bg-zinc-200 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                >
                    Enter Workspace
                    <span className="inline-flex size-7 items-center justify-center rounded-full bg-black/10 transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-0.5">
                        <ArrowUpRight weight="bold" className="size-3.5" />
                    </span>
                </Link>
            </header>

            <main className="mx-auto max-w-3xl px-5 pb-24 pt-16 sm:px-8 sm:pt-24">
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 font-mono text-[11px] text-zinc-500 transition-colors hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                    <ArrowLeft weight="light" className="size-3.5" />
                    Back to ai.diy
                </Link>
                <h1 className="mt-8 text-4xl font-medium tracking-[-0.035em] text-white sm:text-6xl">
                    {title}
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
                    {intro}
                </p>
                <p className="mt-5 font-mono text-[11px] tracking-wide text-zinc-600">
                    {updated}
                </p>

                <article className="mt-16 space-y-12 text-[15px] leading-7 text-zinc-400 sm:text-base">
                    {children}
                </article>
            </main>

            <footer className="border-t border-white/[0.06]">
                <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-[12px] text-zinc-600 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                    <p>Open tools for useful thinking. MIT licensed.</p>
                    <div className="flex items-center gap-5">
                        <Link
                            to="/privacy"
                            className="transition-colors hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                        >
                            Privacy
                        </Link>
                        <Link
                            to="/terms"
                            className="transition-colors hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                        >
                            Terms
                        </Link>
                        <a
                            href={TWITTER_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 transition-colors hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                        >
                            <XLogo weight="light" className="size-3.5" />
                            X
                        </a>
                        <a
                            href={GITHUB_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="transition-colors hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                        >
                            GitHub
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section>
            <h2 className="text-xl font-medium tracking-[-0.02em] text-white sm:text-2xl">
                {title}
            </h2>
            <div className="mt-4 space-y-4">{children}</div>
        </section>
    );
}

export function LegalList({ children }: { children: ReactNode }) {
    return <ul className="list-disc space-y-2 pl-5 marker:text-zinc-600">{children}</ul>;
}
