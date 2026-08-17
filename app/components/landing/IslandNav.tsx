import { useEffect, useId, useState } from "react";
import { Link } from "react-router";
import { List, X } from "@phosphor-icons/react";
import { cn } from "~/lib/utils";
import { DOCS_URL, GITHUB_URL } from "./constants";
import { BrandMark } from "./BrandMark";
import { LandingCta } from "./LandingCta";
import { EASE_IN, EASE_OUT } from "./motion";

const LINKS = [
    { href: "#demo", label: "Demo" },
    { href: "#features", label: "Ownership" },
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
    const [scrolled, setScrolled] = useState(false);
    const menuId = useId();

    useEffect(() => {
        const scroller =
            document.querySelector<HTMLElement>(".overflow-y-auto") ??
            document.scrollingElement;
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
                        "pointer-events-auto flex w-full max-w-5xl items-center gap-3 rounded-full border px-2 py-1.5 pl-4 shadow-[0_12px_48px_-24px_rgba(0,0,0,0.9)] backdrop-blur-2xl transition-[border-color,background-color,box-shadow] duration-200",
                        scrolled
                            ? "border-white/[0.1] bg-[#050505]/80"
                            : "border-white/[0.08] bg-[#050505]/50",
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
                                className="inline-flex min-h-9 items-center rounded-full px-3 text-[13px] text-zinc-400 transition-[color,background-color] duration-200 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
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
                                className="hidden min-h-9 items-center rounded-full px-3 text-[13px] text-zinc-400 transition-[color,background-color] duration-200 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 md:inline-flex"
                                style={{ transitionTimingFunction: EASE_OUT }}
                            >
                                {link.label}
                            </a>
                        ))}
                        <LandingCta to="/workspace" size="compact">
                            Open workspace
                        </LandingCta>
                        <button
                            type="button"
                            className="inline-flex size-10 items-center justify-center rounded-full text-zinc-300 transition-[color,background-color,transform] duration-200 hover:bg-white/[0.08] hover:text-white active:scale-[0.96] lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
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
                className={cn(
                    "fixed inset-0 z-30 bg-black/82 backdrop-blur-3xl transition-[opacity,visibility] duration-200 lg:hidden",
                    open ? "visible opacity-100" : "invisible opacity-0",
                )}
                style={{ transitionTimingFunction: open ? EASE_OUT : EASE_IN }}
                aria-hidden={!open}
            >
                <div className="flex h-full flex-col justify-center gap-1 px-8 pt-16">
                    {[...LINKS, ...EXTERNAL].map((link, i) => {
                        const className = cn(
                            "block rounded-xl px-3 py-3 text-2xl font-medium text-zinc-100 transition-[opacity,transform] duration-200",
                            open ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
                        );
                        const style = {
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
                            </a>
                        );
                    })}
                </div>
            </div>
        </>
    );
}
