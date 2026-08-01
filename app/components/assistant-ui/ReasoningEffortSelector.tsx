"use client";

import { cn } from "~/lib/utils";
import { hapticSelect } from "~/lib/haptics";
import { useSettings } from "~/lib/providers/SettingsProvider";
import {
    getReasoningEffortOptions,
    type ReasoningEffort,
} from "~/lib/reasoning";
import type { FC } from "react";

export type ReasoningEffortSelectorProps = {
    /** Layout: compact pills (input bar) vs. segmented (settings). */
    variant?: "compact" | "settings";
    className?: string;
};

export const ReasoningEffortSelector: FC<ReasoningEffortSelectorProps> = ({
    variant = "settings",
    className,
}) => {
    const { settings, updateChat } = useSettings();
    const options = getReasoningEffortOptions(
        settings.chat.provider,
        settings.chat.model,
    );
    const effort = (settings.chat.reasoningEffort ??
        "medium") as ReasoningEffort;

    if (options.length === 0) return null;

    const isSettings = variant === "settings";

    return (
        <div
            className={cn(
                "flex items-center gap-1.5",
                isSettings ? "flex-col items-stretch gap-2" : "flex-row",
                className,
            )}
        >
            {isSettings && (
                <label className="text-[11px] font-medium text-muted-foreground">
                    Reasoning effort
                </label>
            )}
            <div
                className={cn(
                    "grid gap-1 rounded-xl bg-muted/60 p-1",
                    isSettings
                        ? "grid-cols-2 sm:grid-cols-4"
                        : "grid-cols-2 sm:grid-cols-3",
                )}
            >
                {options.map((opt) => {
                    const active = effort === opt.id;
                    const label = opt.label.replace("Think ", "");
                    return (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                                hapticSelect();
                                updateChat({
                                    reasoningEffort: opt.id as ReasoningEffort,
                                });
                            }}
                            className={cn(
                                "rounded-lg px-1.5 py-1 text-center font-medium outline-none transition-colors",
                                isSettings
                                    ? "text-xs"
                                    : "text-[11px]",
                                active
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                            )}
                            aria-pressed={active}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
