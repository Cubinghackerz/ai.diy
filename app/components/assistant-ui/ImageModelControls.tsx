"use client";

import { ImageIcon, CheckIcon, ChevronDownIcon } from "lucide-react";
import { useEffect, useRef, useState, type FC } from "react";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { getModelCapabilities } from "~/lib/model-capabilities";
import {
    IMAGE_SIZE_OPTIONS,
    getImageGenerationSettings,
} from "~/lib/image-generation";
import { cn } from "~/lib/utils";

export const ImageModelControls: FC = () => {
    const { settings, updateChat } = useSettings();
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const capabilities = getModelCapabilities(
        settings.chat.model,
        settings.chat.provider,
    );

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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
    }, [open]);

    if (!capabilities.imageGeneration) return null;

    const imageSettings = getImageGenerationSettings(settings.chat.provider);
    const sizes = IMAGE_SIZE_OPTIONS.filter((option) =>
        imageSettings.sizes.includes(option.id),
    );
    const size =
        sizes.find((option) => option.id === settings.chat.imageSize) ?? sizes[0];

    return (
        <div ref={rootRef} className="relative shrink-0">
            <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="Image generation settings"
                onClick={() => setOpen((value) => !value)}
                className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-lg border border-border/70 px-2 text-[11px] font-medium text-muted-foreground outline-none transition-colors",
                    "hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40",
                    open && "bg-accent text-foreground",
                )}
            >
                <ImageIcon className="size-3.5" />
                <span className="hidden sm:inline">Image</span>
                <ChevronDownIcon className={cn("size-3 transition-transform", open && "rotate-180")} />
            </button>

            {open && (
                <div
                    role="menu"
                    aria-label="Image generation settings"
                    className="absolute bottom-full left-0 z-50 mb-2 min-w-52 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl"
                >
                    <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Image size
                    </div>
                    {sizes.map((option) => {
                        const active = option.id === size.id;
                        return (
                            <button
                                key={option.id}
                                type="button"
                                role="menuitemradio"
                                aria-checked={active}
                                onClick={() => updateChat({ imageSize: option.id })}
                                className={cn(
                                    "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs outline-none hover:bg-accent focus-visible:bg-accent",
                                    active && "bg-accent/70",
                                )}
                            >
                                <span>{option.label}</span>
                                <span className="flex items-center gap-2 text-muted-foreground">
                                    {option.detail}
                                    {active ? <CheckIcon className="size-3.5 text-foreground" /> : null}
                                </span>
                            </button>
                        );
                    })}
                    <div className="my-1.5 border-t border-border" />
                    <div className="flex items-center justify-between px-2.5 py-1.5 text-xs">
                        <span>Images</span>
                        <div className="flex items-center gap-1">
                            {imageSettings.counts.map((count) => (
                                <button
                                    key={count}
                                    type="button"
                                    aria-pressed={settings.chat.imageCount === count}
                                    onClick={() => updateChat({ imageCount: count })}
                                    className={cn(
                                        "size-6 rounded-md text-[11px] font-medium hover:bg-accent",
                                        settings.chat.imageCount === count && "bg-primary text-primary-foreground",
                                    )}
                                >
                                    {count}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
