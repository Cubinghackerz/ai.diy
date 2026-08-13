import { useEffect, useId, useState } from "react";
import { Link } from "react-router";
import { List, X } from "@phosphor-icons/react";
import { cn } from "~/lib/utils";
import { DOCS_URL, GITHUB_URL } from "./constants";
import { LandingCta } from "./LandingCta";
import { EASE_IN, EASE_OUT } from "./motion";

const LINKS = [
    { href: "#demo", label: "Demo" },
    { href: "#features", label: "Ownership" },
    { href: "#capabilities", label: "Capabilities" },
    { href: "#deploy", label: "Deploy" },
    { href: DOCS_URL, label: "Docs", external: true },
    { href: GITHUB_URL, label: "GitHub", external: true },
] as const;

export function IslandNav() {
    const [open, setOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const titleId = useId();

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 12);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = "";
            window.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <>
            <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-5 sm:pt-6 md:pr-[11.5rem]">
                <nav
                    className={cn(
                        "pointer-events-auto flex w-full max-w-4xl items-center justify-between gap-2 rounded-full border border-white/[0.12] bg-black/45 px-3 py-1.5 shadow-[0_8px_40px_-20px_rgba(0,0,0,0.75)] backdrop-blur-xl transition-[border-color,background-color] duration-200 sm:px-4 md:grid md:grid-cols-[1fr_auto_1fr]",
                        scrolled && "border-white/[0.16] bg-black/60",
                    )}
                    style={{ transitionTimingFunction: EASE_OUT }}
                    aria-label="Primary"
                >
                    <div className="justify-self-start">
                        <Link
                            to="/"
                            className="inline-flex min-h-10 items-center font-mono text-[13px] font-medium tracking-tight text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                        >
                            ai.diy
                        </Link>
                    </div>

                    <div className="hidden items-center justify-center gap-0.5 md:flex">
                        {LINKS.map((link) =>
                            "external" in link && link.external ? (
                                <a
                                    key={link.label}
                                    href={link.href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex min-h-10 items-center rounded-full px-3 text-[13px] text-zinc-300 transition-[color,background-color] duration-200 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                                    style={{ transitionTimingFunction: EASE_OUT }}
                                >
                                    {link.label}
                                </a>
                            ) : (
                                <a
                                    key={link.label}
                                    href={link.href}
                                    className="inline-flex min-h-10 items-center rounded-full px-3 text-[13px] text-zinc-300 transition-[color,background-color] duration-200 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                                    style={{ transitionTimingFunction: EASE_OUT }}
                                >
                                    {link.label}
                                </a>
                            ),
                        )}
                    </div>

                    <div className="flex items-center justify-self-end gap-1.5">
                        <button
                            type="button"
                            className="inline-flex size-10 items-center justify-center rounded-full text-zinc-300 transition-[color,background-color,transform] duration-200 hover:bg-white/[0.08] hover:text-white active:scale-[0.96] md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                            aria-label={open ? "Close menu" : "Open menu"}
                            aria-expanded={open}
                            aria-controls={titleId}
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
                        <LandingCta to="/workspace" size="compact" className="md:hidden">
                            Open
                        </LandingCta>
                    </div>
                </nav>
            </div>

            <div
                id={titleId}
                className={cn(
                    "fixed inset-0 z-30 bg-black/80 backdrop-blur-3xl transition-[opacity,visibility] duration-200 md:hidden",
                    open ? "visible opacity-100" : "invisible opacity-0",
                )}
                style={{
                    transitionTimingFunction: open ? EASE_OUT : EASE_IN,
                }}
                aria-hidden={!open}
            >
                <div className="flex h-full flex-col justify-center gap-2 px-8 pt-16">
                    {LINKS.map((link, i) => {
                        const className = cn(
                            "block rounded-xl px-3 py-3 text-2xl font-medium text-zinc-100 transition-[opacity,transform] duration-200",
                            open ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
                        );
                        const style = {
                            transitionTimingFunction: EASE_OUT,
                            transitionDelay: open ? `${80 + i * 40}ms` : "0ms",
                        };
                        return "external" in link && link.external ? (
                            <a
                                key={link.label}
                                href={link.href}
                                target="_blank"
                                rel="noreferrer"
                                className={className}
                                style={style}
                                onClick={() => setOpen(false)}
                            >
                                {link.label}
                            </a>
                        ) : (
                            <a
                                key={link.label}
                                href={link.href}
                                className={className}
                                style={style}
                                onClick={() => setOpen(false)}
                            >
                                {link.label}
                            </a>
                        );
                    })}
                    <LandingCta
                        to="/workspace"
                        className="mt-6"
                        size="default"
                    >
                        Open workspace
                    </LandingCta>
                </div>
            </div>
        </>
    );
}
