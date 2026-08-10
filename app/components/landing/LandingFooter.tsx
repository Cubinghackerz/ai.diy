import { Link } from "react-router";
import { ArrowSquareOut, XLogo } from "@phosphor-icons/react";
import { DOCS_URL, GITHUB_URL, TWITTER_URL } from "./constants";

export function LandingFooter() {
    return (
        <footer className="border-t border-white/[0.06]">
            <div className="mx-auto flex max-w-6xl flex-col gap-10 px-5 py-16 sm:flex-row sm:justify-between sm:px-8">
                <div>
                    <p className="font-mono text-[13px] text-white">ai.diy</p>
                    <p className="mt-3 flex items-center gap-2 font-mono text-[11px] text-zinc-500">
                        <span className="size-1.5 rounded-full bg-emerald-500/90" aria-hidden />
                        All systems normal
                    </p>
                    <p className="mt-4 max-w-xs text-[12px] leading-relaxed text-zinc-600">
                        Open tools for useful thinking. MIT licensed.
                    </p>
                </div>
                <div className="flex flex-wrap gap-x-14 gap-y-8 text-[13px]">
                    <div>
                        <p className="font-mono text-[10px] tracking-wide text-zinc-600">PRODUCT</p>
                        <ul className="mt-3 space-y-2.5 text-zinc-500">
                            <li>
                                <Link
                                    to="/workspace"
                                    className="transition-colors duration-150 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                                >
                                    Workspace
                                </Link>
                            </li>
                            <li>
                                <a
                                    href="#features"
                                    className="transition-colors duration-150 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                                >
                                    Ownership
                                </a>
                            </li>
                            <li>
                                <a
                                    href="#capabilities"
                                    className="transition-colors duration-150 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                                >
                                    Capabilities
                                </a>
                            </li>
                            <li>
                                <a
                                    href="#deploy"
                                    className="transition-colors duration-150 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                                >
                                    Deploy
                                </a>
                            </li>
                        </ul>
                    </div>
                    <div>
                        <p className="font-mono text-[10px] tracking-wide text-zinc-600">RESOURCES</p>
                        <ul className="mt-3 space-y-2.5 text-zinc-500">
                            <li>
                                <a
                                    href={DOCS_URL}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="transition-colors duration-150 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                                >
                                    Docs
                                </a>
                            </li>
                            <li>
                                <a
                                    href={GITHUB_URL}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 transition-colors duration-150 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                                >
                                    GitHub <ArrowSquareOut weight="light" className="size-3.5" />
                                </a>
                            </li>
                            <li>
                                <a
                                    href={`${GITHUB_URL}/blob/main/LICENSE`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="transition-colors duration-150 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                                >
                                    MIT License
                                </a>
                            </li>
                            <li>
                                <a
                                    href={TWITTER_URL}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 transition-colors duration-150 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                                >
                                    <XLogo weight="light" className="size-3.5" />
                                    X / @HeckingHacker
                                </a>
                            </li>
                        </ul>
                    </div>
                    <div>
                        <p className="font-mono text-[10px] tracking-wide text-zinc-600">LEGAL</p>
                        <ul className="mt-3 space-y-2.5 text-zinc-500">
                            <li>
                                <Link
                                    to="/privacy"
                                    className="transition-colors duration-150 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                                >
                                    Privacy
                                </Link>
                            </li>
                            <li>
                                <Link
                                    to="/terms"
                                    className="transition-colors duration-150 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                                >
                                    Terms
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
            <div className="border-t border-white/[0.04] px-5 py-4 sm:px-8">
                <p className="mx-auto max-w-6xl font-mono text-[11px] text-zinc-700">
                    © {new Date().getFullYear()} ai.diy
                </p>
            </div>
        </footer>
    );
}
