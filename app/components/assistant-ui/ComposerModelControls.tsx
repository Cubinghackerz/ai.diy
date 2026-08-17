/**
 * ComposerModelControls — provider, model, and reasoning effort in the input bar.
 */

import { ModelPicker } from "~/components/ui/ModelPicker";
import { ProviderPicker } from "~/components/ui/ProviderPicker";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { isProviderReady } from "~/lib/setup";
import { getModelCapabilities, lastModelForProvider } from "~/lib/model-capabilities";
import type { ProviderId } from "~/lib/types";
import { type FC } from "react";
import { VideoCamera } from "@phosphor-icons/react";
import { ReasoningEffortSelector } from "~/components/assistant-ui/ReasoningEffortSelector";
import { ImageModelControls } from "~/components/assistant-ui/ImageModelControls";

export const ComposerModelControls: FC = () => {
    const { settings, updateChat } = useSettings();
    const providerReady = isProviderReady(settings);
    const video = getModelCapabilities(
        settings.chat.model,
        settings.chat.provider,
    ).video;

    return (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 pe-2">
            <ProviderPicker
                value={settings.chat.provider}
                onChange={(provider: ProviderId) => {
                    updateChat({
                        provider,
                        model: lastModelForProvider(provider, settings.chat),
                    });
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

            <ReasoningEffortSelector />
            <ImageModelControls />
            {video ? (
                <span
                    title="This model generates videos. Sending a message starts a video generation."
                    className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border/70 px-2 text-[11px] font-medium text-muted-foreground"
                >
                    <VideoCamera size={14} weight="duotone" className="text-primary" />
                    <span className="hidden sm:inline">Video</span>
                </span>
            ) : null}
        </div>
    );
};
