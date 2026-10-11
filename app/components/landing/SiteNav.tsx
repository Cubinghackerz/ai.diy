import { useEffect, useId, useState } from "react";
import { Link } from "react-router";
import { List, X } from "@phosphor-icons/react";
import { DOCS_URL, GITHUB_URL, LANDING_JUMPS } from "./constants";
import { BrandMark } from "./BrandMark";
import { formatStars, useGithubStars } from "./hooks";
import { JumpPalette } from "./JumpPalette";
import { LandingCta } from "./LandingCta";

const LINKS = LANDING_JUMPS.filter((link) => link.href !== "#demo");

const linkClass =
    "h-9 items-center rounded-[6px] px-3 text-[13px] text-zinc-400 transition-colors duration-150 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40";

/** A flat top bar: logo, a few links, GitHub, and the one primary action. */
export function SiteNav() {
    const [open, setOpen] = useState(false);
    const [palette, setPalette] = useState(false);
    const stars = useGithubStars();
    const menuId = useId();

    useEffect(() => {
        if (!open) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    return (
        <>
            <header className="fixed inset-x-0 top-0 z-40 border-b border-white/[0.08] bg-black/80 backdrop-blur-md">
                <nav
                    aria-label="Primary"
                    className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-6"
                >
                    <Link
                        to="/"
                        className="inline-flex h-9 shrink-0 items-center rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                    >
                        <BrandMark height={20} />
                    </Link>

                    <div className="ml-4 hidden items-center md:flex">
                        {LINKS.map((link) => (
                            <a
                                key={link.label}
                                href={link.href}
                                className={`inline-flex ${linkClass}`}
                            >
                                {link.label}
                            </a>
                        ))}
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                        <a
                            href={GITHUB_URL}
                            target="_blank"
                            rel="noreferrer"
                            className={`${linkClass} hidden sm:inline-flex`}
                        >
                            GitHub
                            {stars !== null ? (
                                <span className="ml-1.5 font-mono text-[11px] text-zinc-500">
                                    {formatStars(stars)}
                                </span>
                            ) : null}
                        </a>
                        <a
                            href={DOCS_URL}
                            target="_blank"
                            rel="noreferrer"
                            className={`${linkClass} hidden lg:inline-flex`}
                        >
                            Docs
                        </a>
                        <button
                            type="button"
                            onClick={() => setPalette(true)}
                            aria-label="Jump to a section"
                            aria-keyshortcuts="Meta+K Control+K"
                            className="hidden h-8 items-center rounded-[6px] border border-white/[0.1] px-2 font-mono text-[11px] text-zinc-400 transition-colors hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:inline-flex"
                        >
                            ⌘K
                        </button>
                        <LandingCta to="/workspace" size="compact">
                            Open workspace
                        </LandingCta>
                        <button
                            type="button"
                            className="inline-flex size-9 items-center justify-center rounded-[6px] text-zinc-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 md:hidden"
                            aria-label={open ? "Close menu" : "Open menu"}
                            aria-expanded={open}
                            aria-controls={menuId}
                            onClick={() => setOpen((value) => !value)}
                        >
                            {open ? (
                                <X weight="light" className="size-5" />
                            ) : (
                                <List weight="light" className="size-5" />
                            )}
                        </button>
                    </div>
                </nav>

                {open ? (
                    <div id={menuId} className="border-t border-white/[0.08] bg-black md:hidden">
                        <div className="mx-auto flex max-w-6xl flex-col px-6 py-3">
                            {[
                                ...LINKS,
                                { href: GITHUB_URL, label: "GitHub" },
                                { href: DOCS_URL, label: "Docs" },
                            ].map((link) => {
                                const external = /^https?:/.test(link.href);
                                return (
                                    <a
                                        key={link.label}
                                        href={link.href}
                                        target={external ? "_blank" : undefined}
                                        rel={external ? "noreferrer" : undefined}
                                        onClick={() => setOpen(false)}
                                        className="flex h-11 items-center text-[15px] text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                                    >
                                        {link.label}
                                    </a>
                                );
                            })}
                        </div>
                    </div>
                ) : null}
            </header>
            <JumpPalette open={palette} onOpenChange={setPalette} />
        </>
    );
}
