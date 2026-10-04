import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { GITHUB_URL, LANDING_JUMPS } from "./constants";
import { EASE_OUT } from "./motion";

const ACTIONS = [
    { href: "/workspace", label: "Open workspace", external: false },
    { href: GITHUB_URL, label: "GitHub", external: true },
] as const;

export function JumpPalette({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const restoreRef = useRef<HTMLElement | null>(null);
    const titleId = useId();
    const [query, setQuery] = useState("");

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
            const target = event.target;
            if (
                target instanceof HTMLElement &&
                (target.isContentEditable ||
                    target.tagName === "INPUT" ||
                    target.tagName === "TEXTAREA" ||
                    target.tagName === "SELECT")
            ) {
                return;
            }
            event.preventDefault();
            onOpenChange(!open);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onOpenChange, open]);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (open) {
            restoreRef.current =
                document.activeElement instanceof HTMLElement ? document.activeElement : null;
            setQuery("");
            if (!dialog.open) dialog.showModal();
            dialog.querySelector<HTMLElement>("[data-jump-first]")?.focus();
            return;
        }
        if (dialog.open) dialog.close();
        restoreRef.current?.focus();
    }, [open]);

    const needle = query.trim().toLowerCase();
    const jumps = LANDING_JUMPS.filter((item) => item.label.toLowerCase().includes(needle));
    const actions = ACTIONS.filter((item) => item.label.toLowerCase().includes(needle));

    return (
        <dialog
            ref={dialogRef}
            aria-labelledby={titleId}
            className="w-[min(28rem,calc(100%-2rem))] max-w-[calc(100%-2rem)] rounded-[2px] border border-white/10 bg-[#0a0a0a] p-0 text-zinc-50 backdrop:bg-black/80"
            onClose={() => onOpenChange(false)}
        >
            <div className="flex items-center justify-between border-b border-white/[0.08] px-3 py-2">
                <h2 id={titleId} className="font-mono text-[10px] tracking-[0.16em] text-zinc-500">
                    Jump to a section
                </h2>
                <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="inline-flex min-h-10 items-center px-2 text-[13px] text-zinc-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                >
                    Close
                </button>
            </div>
            <label className="block border-b border-white/[0.08] px-3 py-2">
                <span className="sr-only">Filter sections</span>
                <input
                    data-jump-first=""
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Jump to…"
                    className="min-h-11 w-full bg-transparent text-[14px] text-white outline-none placeholder:text-zinc-500"
                />
            </label>
            <ul className="max-h-[min(24rem,60dvh)] overflow-y-auto p-1">
                {jumps.map((item) => (
                    <li key={item.href}>
                        <a
                            href={item.href}
                            onClick={() => onOpenChange(false)}
                            className="flex min-h-11 items-center rounded-[2px] px-3 text-[14px] text-zinc-200 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                            style={{ transitionTimingFunction: EASE_OUT }}
                        >
                            {item.label}
                        </a>
                    </li>
                ))}
                {actions.map((item) => (
                    <li key={item.href}>
                        {item.external ? (
                            <a
                                href={item.href}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => onOpenChange(false)}
                                className="flex min-h-11 items-center rounded-[2px] px-3 text-[14px] text-zinc-200 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                            >
                                {item.label}
                            </a>
                        ) : (
                            <Link
                                to={item.href}
                                onClick={() => onOpenChange(false)}
                                className="flex min-h-11 items-center rounded-[2px] px-3 text-[14px] text-zinc-200 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                            >
                                {item.label}
                            </Link>
                        )}
                    </li>
                ))}
                {jumps.length + actions.length === 0 ? (
                    <li className="px-3 py-4 text-[13px] text-zinc-500">No matches</li>
                ) : null}
            </ul>
        </dialog>
    );
}
