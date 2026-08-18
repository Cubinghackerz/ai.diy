import { Link } from "react-router";
import { ArrowSquareOut, XLogo } from "@phosphor-icons/react";
import { BrandMark } from "./BrandMark";
import { DOCS_URL, GITHUB_URL, TWITTER_URL } from "./constants";
import { SEO_GUIDES } from "~/lib/seo-pages";

const linkClass =
    "inline-flex min-h-10 items-center transition-colors duration-150 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40";

export function LandingFooter() {
    return (
        <footer className="border-t border-white/[0.08]">
            <div className="mx-auto flex max-w-6xl flex-col gap-10 px-5 py-16 sm:flex-row sm:justify-between sm:px-8">
                <div>
                    <BrandMark height={22} />
                    <p className="mt-3 flex items-center gap-2 font-mono text-[11px] text-zinc-400">
                        <span
                            className="size-1.5 rounded-full bg-[var(--landing-mint,#3DFFB0)]"
                            aria-hidden
                        />
                        All systems normal
                    </p>
                    <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-zinc-400">
                        Open tools for useful thinking. MIT licensed.
                    </p>
                </div>
                <div className="flex flex-wrap gap-x-14 gap-y-8 text-[13px]">
                    <div>
                        <p className="font-mono text-[10px] tracking-wide text-zinc-500">PRODUCT</p>
                        <ul className="mt-2 space-y-0.5 text-zinc-400">
                            <li>
                                <Link to="/workspace" reloadDocument className={linkClass}>
                                    Workspace
                                </Link>
                            </li>
                            <li>
                                <a href="#features" className={linkClass}>
                                    Ownership
                                </a>
                            </li>
                            <li>
                                <a href="#capabilities" className={linkClass}>
                                    Capabilities
                                </a>
                            </li>
                            <li>
                                <a href="#faq" className={linkClass}>
                                    FAQ
                                </a>
                            </li>
                            <li>
                                <a href="#deploy" className={linkClass}>
                                    Deploy
                                </a>
                            </li>
                        </ul>
                    </div>
                    <div>
                        <p className="font-mono text-[10px] tracking-wide text-zinc-500">RESOURCES</p>
                        <ul className="mt-2 space-y-0.5 text-zinc-400">
                            <li>
                                <a href={DOCS_URL} target="_blank" rel="noreferrer" className={linkClass}>
                                    Docs
                                </a>
                            </li>
                            <li>
                                <a
                                    href={GITHUB_URL}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`${linkClass} gap-1`}
                                >
                                    GitHub <ArrowSquareOut weight="light" className="size-3.5" />
                                </a>
                            </li>
                            <li>
                                <a
                                    href={`${GITHUB_URL}/blob/main/LICENSE`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={linkClass}
                                >
                                    MIT License
                                </a>
                            </li>
                            <li>
                                <a
                                    href={TWITTER_URL}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`${linkClass} gap-1.5`}
                                >
                                    <XLogo weight="light" className="size-3.5" />
                                    X / @HeckingHacker
                                </a>
                            </li>
                        </ul>
                    </div>
                    <div>
                        <p className="font-mono text-[10px] tracking-wide text-zinc-500">GUIDES</p>
                        <ul className="mt-2 space-y-0.5 text-zinc-400">
                            {SEO_GUIDES.map((guide) => (
                                <li key={guide.slug}>
                                    <Link to={guide.path} className={linkClass}>
                                        {guide.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <p className="font-mono text-[10px] tracking-wide text-zinc-500">LEGAL</p>
                        <ul className="mt-2 space-y-0.5 text-zinc-400">
                            <li>
                                <Link to="/privacy" className={linkClass}>
                                    Privacy
                                </Link>
                            </li>
                            <li>
                                <Link to="/terms" className={linkClass}>
                                    Terms
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
            <div className="border-t border-white/[0.08] px-5 py-4 sm:px-8">
                <p className="mx-auto max-w-6xl font-mono text-[11px] text-zinc-500">
                    © {new Date().getFullYear()} ai.diy
                </p>
            </div>
        </footer>
    );
}
