"use client";

import { cn } from "~/lib/utils";
import { hapticSelect } from "~/lib/haptics";
import { useSettings } from "~/lib/providers/SettingsProvider";
import {
    getReasoningEffortOptions,
    type ReasoningEffort,
} from "~/lib/reasoning";
import { BrainIcon, CheckIcon, ChevronDownIcon } from "lucide-react";
import { useEffect, useRef, useState, type FC } from "react";
import { createPortal } from "react-dom";
import { useAnchoredMenu } from "~/lib/use-anchored-menu";

export type ReasoningEffortSelectorProps = {
    className?: string;
};

export const ReasoningEffortSelector: FC<ReasoningEffortSelectorProps> = ({
    className,
}) => {
    const { settings, updateChat } = useSettings();
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const options = getReasoningEffortOptions(
        settings.chat.provider,
        settings.chat.model,
    );
    const configuredEffort = (settings.chat.reasoningEffort ?? "medium") as ReasoningEffort;

    useEffect(() => {
        if (!open || options.length === 0) return;

        const onPointerDown = (event: PointerEvent) => {
            if (
                !rootRef.current?.contains(event.target as Node) &&
                !menuRef.current?.contains(event.target as Node)
            ) {
                setOpen(false);
            }
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };

        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open, options.length]);

    const menuStyle = useAnchoredMenu(open, triggerRef, menuRef, {
        width: 160,
        maxHeight: 260,
        align: "left",
        zIndex: 100,
    });

    if (options.length === 0) return null;

    const activeOption =
        options.find((option) => option.id === configuredEffort) ??
        options.find((option) => option.id === "medium") ??
        options[0];

    return (
        <div
            ref={rootRef}
            className={cn("relative shrink-0", className)}
        >
            <button
                ref={triggerRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={`Reasoning effort: ${activeOption.label.replace("Think ", "")}`}
                onClick={() => setOpen((value) => !value)}
                className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-lg border border-border/70 px-2 text-[11px] font-medium text-muted-foreground outline-none transition-colors",
                    "hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40",
                    open && "bg-accent text-foreground",
                )}
            >
                <BrainIcon className="size-3.5" />
                <span className="hidden sm:inline">Reasoning</span>
                <span className="text-foreground/80">
                    {activeOption.label.replace("Think ", "")}
                </span>
                <ChevronDownIcon
                    className={cn("size-3 transition-transform", open && "rotate-180")}
                />
            </button>

            {open && menuStyle
                ? createPortal(
                      <div
                          ref={menuRef}
                          style={menuStyle}
                          role="menu"
                          aria-label="Reasoning effort"
                          className="overflow-y-auto rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl"
                      >
                          <div className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Reasoning effort
                          </div>
                          {options.map((option) => {
                              const active = activeOption.id === option.id;
                              const label = option.label.replace("Think ", "");
                              return (
                                  <button
                                      key={option.id}
                                      type="button"
                                      role="menuitemradio"
                                      aria-checked={active}
                                      onClick={() => {
                                          hapticSelect();
                                          updateChat({
                                              reasoningEffort: option.id as ReasoningEffort,
                                          });
                                          setOpen(false);
                                      }}
                                      className={cn(
                                          "flex w-full items-center justify-between gap-4 rounded-lg px-2.5 py-1.5 text-left text-xs outline-none transition-colors",
                                          "hover:bg-accent focus-visible:bg-accent",
                                          active && "bg-accent/70 text-foreground",
                                      )}
                                  >
                                      <span>{label}</span>
                                      {active ? <CheckIcon className="size-3.5" /> : null}
                                  </button>
                              );
                          })}
                      </div>,
                      document.body,
                  )
                : null}
        </div>
    );
};
