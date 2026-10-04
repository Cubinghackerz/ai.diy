import { useEffect, useId, useState } from "react";
import { Link } from "react-router";
import { List, X } from "@phosphor-icons/react";
import { cn } from "~/lib/utils";
import { DOCS_URL, GITHUB_URL } from "./constants";
import { BrandMark } from "./BrandMark";
import { formatStars, useGithubStars } from "./hooks";
import { JumpPalette } from "./JumpPalette";
import { LandingCta } from "./LandingCta";
import { EASE_IN, EASE_OUT } from "./motion";

const LINKS = [
    { href: "#demo", label: "Demo" },
    { href: "#features", label: "Ownership" },
    { href: "#apps", label: "Apps" },
    { href: "#capabilities", label: "Capabilities" },
    { href: "#faq", label: "FAQ" },
    { href: "#deploy", label: "Deploy" },
] as const;

const EXTERNAL = [
    { href: DOCS_URL, label: "Docs" },
    { href: GITHUB_URL, label: "GitHub" },
] as const;

export function IslandNav() {
    const [open, setOpen] = useState(false);
    const [palette, setPalette] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const stars = useGithubStars();
    const menuId = useId();

    useEffect(() => {
        const scroller =
            document.querySelector<HTMLElement>(".overflow-y-auto") ?? document.scrollingElement;
        const onScroll = () =>
            setScrolled(
                (scroller instanceof HTMLElement ? scroller.scrollTop : window.scrollY) > 12,
            );
        onScroll();
        scroller?.addEventListener("scroll", onScroll, { passive: true });
        return () => scroller?.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = prev;
            window.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <>
            <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-4 sm:px-6 sm:pt-5">
                <nav
                    className={cn(
                        "pointer-events-auto flex w-full max-w-5xl items-center gap-3 rounded-[2px] border px-2 py-1.5 pl-4 shadow-[0_12px_48px_-24px_rgba(0,0,0,0.9)] backdrop-blur-2xl transition-[border-color,background-color,box-shadow] duration-200",
                        scrolled
                            ? "border-white/[0.1] bg-black/80"
                            : "border-white/[0.08] bg-black/55",
                    )}
                    style={{ transitionTimingFunction: EASE_OUT }}
                    aria-label="Primary"
                >
                    <Link
                        to="/"
                        className="inline-flex min-h-10 shrink-0 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                    >
                        <BrandMark height={20} />
                    </Link>

                    <div className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 lg:flex">
                        {LINKS.map((link) => (
                            <a
                                key={link.label}
                                href={link.href}
                                className="inline-flex min-h-9 items-center rounded-[2px] px-3 text-[13px] text-zinc-400 transition-[color,background-color] duration-200 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                                style={{ transitionTimingFunction: EASE_OUT }}
                            >
                                {link.label}
                            </a>
                        ))}
                    </div>

                    <div className="ml-auto flex items-center gap-1.5">
                        {EXTERNAL.map((link) => (
                            <a
                                key={link.label}
                                href={link.href}
                                target="_blank"
                                rel="noreferrer"
                                className="hidden min-h-10 items-center gap-1.5 rounded-[2px] px-3 text-[13px] text-zinc-400 transition-[color,background-color] duration-200 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 md:inline-flex"
                                style={{ transitionTimingFunction: EASE_OUT }}
                            >
                                {link.label}
                                {link.label === "GitHub" && stars !== null ? (
                                    <span className="font-mono text-[11px] text-zinc-500">
                                        {formatStars(stars)}
                                    </span>
                                ) : null}
                            </a>
                        ))}
                        <button
                            type="button"
                            onClick={() => setPalette(true)}
                            aria-label="Jump to a section"
                            aria-keyshortcuts="Meta+K Control+K"
                            className="hidden min-h-10 items-center rounded-[2px] px-2.5 font-mono text-[11px] text-zinc-400 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:inline-flex"
                        >
                            ⌘K
                        </button>
                        <LandingCta to="/workspace" size="compact">
                            Open workspace
                        </LandingCta>
                        <button
                            type="button"
                            className="inline-flex size-10 items-center justify-center rounded-[2px] text-zinc-300 transition-[color,background-color,transform] duration-200 hover:bg-white/[0.08] hover:text-white active:scale-[0.96] lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                            aria-label={open ? "Close menu" : "Open menu"}
                            aria-expanded={open}
                            aria-controls={menuId}
                            onClick={() => setOpen((v) => !v)}
                        >
                            <span className="relative size-4">
                                <List
                                    weight="light"
                                    className={cn(
                                        "absolute inset-0 size-4 transition-[opacity,transform] duration-200",
                                        open ? "scale-75 opacity-0" : "opacity-100",
                                    )}
                                    style={{ transitionTimingFunction: EASE_OUT }}
                                />
                                <X
                                    weight="light"
                                    className={cn(
                                        "absolute inset-0 size-4 transition-[opacity,transform] duration-200",
                                        open ? "opacity-100" : "scale-75 opacity-0",
                                    )}
                                    style={{ transitionTimingFunction: EASE_IN }}
                                />
                            </span>
                        </button>
                    </div>
                </nav>
            </div>

            <div
                id={menuId}
                inert={!open}
                className={cn(
                    "fixed inset-0 z-30 overflow-x-clip bg-black/82 backdrop-blur-3xl transition-[opacity,visibility] lg:hidden",
                    open ? "visible opacity-100 duration-200" : "hidden",
                )}
                style={{ transitionTimingFunction: open ? EASE_OUT : EASE_IN }}
                aria-hidden={!open}
            >
                <div className="flex h-full max-w-full flex-col justify-center gap-1 overflow-x-clip px-6 pt-16">
                    <button
                        type="button"
                        onClick={() => {
                            setOpen(false);
                            setPalette(true);
                        }}
                        className="block min-h-11 rounded-[2px] px-3 py-3 text-left text-2xl font-medium text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                    >
                        Jump
                    </button>
                    {[...LINKS, ...EXTERNAL].map((link, i) => {
                        const className = cn(
                            "block min-h-11 rounded-[2px] px-3 py-3 text-2xl font-medium text-zinc-100",
                            open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
                        );
                        const style = {
                            transitionProperty: "opacity, transform",
                            transitionDuration: "200ms",
                            transitionTimingFunction: EASE_OUT,
                            transitionDelay: open ? `${80 + i * 40}ms` : "0ms",
                        };
                        const external = "href" in link && /^https?:/.test(link.href);
                        return (
                            <a
                                key={link.label}
                                href={link.href}
                                target={external ? "_blank" : undefined}
                                rel={external ? "noreferrer" : undefined}
                                className={className}
                                style={style}
                                onClick={() => setOpen(false)}
                            >
                                {link.label}
                                {link.label === "GitHub" && stars !== null
                                    ? ` ${formatStars(stars)}`
                                    : null}
                            </a>
                        );
                    })}
                </div>
            </div>
            <JumpPalette open={palette} onOpenChange={setPalette} />
        </>
    );
}
