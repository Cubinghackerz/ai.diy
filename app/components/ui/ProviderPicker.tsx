/**
 * ProviderPicker — searchable provider dropdown (matches ModelPicker UX).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Command } from "cmdk";
import { CaretDown, MagnifyingGlass } from "@phosphor-icons/react";
import { hapticSelect } from "~/lib/haptics";
import { isLocalProvider } from "~/lib/setup";
import { PROVIDER_DEFAULTS, type ProviderId } from "~/lib/types";
import { cn } from "~/lib/utils";

const PROVIDER_IDS = Object.keys(PROVIDER_DEFAULTS) as ProviderId[];

export function ProviderPicker({
    value,
    onChange,
    className,
    align = "left",
    compact = false,
}: {
    value: ProviderId;
    onChange: (provider: ProviderId) => void;
    className?: string;
    align?: "left" | "right";
    compact?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const selected = PROVIDER_DEFAULTS[value];

    const options = useMemo(
        () =>
            PROVIDER_IDS.map((id) => ({
                id,
                name: PROVIDER_DEFAULTS[id].name,
                local: isLocalProvider(id),
            })),
        [],
    );

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDoc);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <div ref={rootRef} className={cn("relative", className)}>
            <button
                type="button"
                onClick={() => {
                    hapticSelect();
                    setOpen((v) => !v);
                }}
                className={cn(
                    "flex max-w-full items-center gap-1.5 rounded-lg border border-border/70 bg-transparent font-medium outline-none transition-colors hover:border-border hover:bg-muted/40",
                    compact
                        ? "h-7 py-0.5 pr-1.5 pl-2 text-[11px]"
                        : "h-8 bg-background py-1 pr-2 pl-2.5 text-xs",
                )}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label="Provider"
            >
                <span className="truncate">{selected?.name || value}</span>
                <CaretDown
                    size={12}
                    className="shrink-0 text-muted-foreground"
                />
            </button>

            {open ? (
                <div
                    className={cn(
                        "absolute z-50 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg",
                        compact
                            ? "bottom-[calc(100%+6px)]"
                            : "top-[calc(100%+6px)]",
                        align === "right" ? "right-0" : "left-0",
                    )}
                >
                    <Command className="flex max-h-72 flex-col" label="Search providers">
                        <div className="flex items-center gap-2 border-b border-border px-3">
                            <MagnifyingGlass
                                size={14}
                                className="shrink-0 text-muted-foreground"
                            />
                            <Command.Input
                                placeholder="Search providers…"
                                className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                autoFocus
                            />
                        </div>
                        <Command.List className="overflow-y-auto p-1">
                            <Command.Empty className="px-3 py-6 text-center text-xs text-muted-foreground">
                                No providers match.
                            </Command.Empty>
                            {options.map((p) => (
                                <Command.Item
                                    key={p.id}
                                    value={`${p.name} ${p.id}`}
                                    onSelect={() => {
                                        hapticSelect();
                                        onChange(p.id);
                                        setOpen(false);
                                    }}
                                    className={cn(
                                        "flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs outline-none aria-selected:bg-accent",
                                        p.id === value && "bg-accent/70",
                                    )}
                                >
                                    <span className="font-medium text-foreground">
                                        {p.name}
                                    </span>
                                    {p.local ? (
                                        <span className="text-[10px] text-muted-foreground">
                                            Local
                                        </span>
                                    ) : null}
                                </Command.Item>
                            ))}
                        </Command.List>
                    </Command>
                </div>
            ) : null}
        </div>
    );
}
