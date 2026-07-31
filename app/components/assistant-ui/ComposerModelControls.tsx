/**
 * ComposerModelControls — provider, model, and reasoning effort in the input bar.
 */

import { ModelPicker } from "~/components/ui/ModelPicker";
import { ProviderPicker } from "~/components/ui/ProviderPicker";
import { hapticSelect } from "~/lib/haptics";
import { useSettings } from "~/lib/providers/SettingsProvider";
import {
    modelSupportsReasoning,
    REASONING_EFFORT_OPTIONS,
    type ReasoningEffort,
} from "~/lib/reasoning";
import { isProviderReady } from "~/lib/setup";
import { resolveToolCapableModel } from "~/lib/model-capabilities";
import type { ProviderId } from "~/lib/types";
import { cn } from "~/lib/utils";
import { Brain, CaretDown } from "@phosphor-icons/react";
import { type FC } from "react";

export const ComposerModelControls: FC = () => {
    const { settings, updateChat } = useSettings();
    const providerReady = isProviderReady(settings);
    const showReasoning = modelSupportsReasoning(
        settings.chat.provider,
        settings.chat.model,
    );
    const effort = (settings.chat.reasoningEffort ??
        "medium") as ReasoningEffort;

    return (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 pe-2">
            <ProviderPicker
                value={settings.chat.provider}
                onChange={(provider: ProviderId) => {
                    const first = resolveToolCapableModel(
                        provider,
                        settings.chat.model,
                    );
                    updateChat({ provider, model: first });
                }}
                align="left"
                compact
                className="max-w-[7.5rem] sm:max-w-[9rem]"
            />

            {providerReady ? (
                <ModelPicker
                    provider={settings.chat.provider}
                    value={settings.chat.model}
                    onChange={(modelId) => {
                        updateChat({ model: modelId });
                    }}
                    enabled={providerReady}
                    align="left"
                    className="max-w-[8.5rem] sm:max-w-[14rem]"
                    compact
                />
            ) : (
                <span className="rounded-lg border border-warning/40 bg-warning/10 px-2 py-1 text-[11px] font-medium text-warning">
                    Add API key
                </span>
            )}

            {showReasoning ? (
                <CompactSelect
                    ariaLabel="Thinking effort"
                    value={effort}
                    onChange={(value) => {
                        hapticSelect();
                        updateChat({
                            reasoningEffort: value as ReasoningEffort,
                        });
                    }}
                    className="max-w-[7.5rem]"
                    icon={
                        <Brain
                            size={13}
                            className="shrink-0 text-muted-foreground"
                        />
                    }
                >
                    {REASONING_EFFORT_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                            {opt.label}
                        </option>
                    ))}
                </CompactSelect>
            ) : null}
        </div>
    );
};

function CompactSelect({
    value,
    onChange,
    children,
    ariaLabel,
    className,
    icon,
}: {
    value: string;
    onChange: (value: string) => void;
    children: React.ReactNode;
    ariaLabel: string;
    className?: string;
    icon?: React.ReactNode;
}) {
    return (
        <div className={cn("relative", className)}>
            {icon ? (
                <span className="pointer-events-none absolute top-1/2 left-2 z-10 -translate-y-1/2">
                    {icon}
                </span>
            ) : null}
            <select
                aria-label={ariaLabel}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={cn(
                    "h-7 max-w-full appearance-none truncate rounded-lg border border-border/60 bg-transparent py-0.5 text-[11px] font-medium outline-none transition-colors hover:border-border hover:bg-muted/40 focus:border-border",
                    icon ? "pr-6 pl-7" : "pr-6 pl-2",
                )}
            >
                {children}
            </select>
            <CaretDown
                size={11}
                className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
            />
        </div>
    );
}
