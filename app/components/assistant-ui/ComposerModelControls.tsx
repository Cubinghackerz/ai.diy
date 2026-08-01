/**
 * ComposerModelControls — provider, model, and reasoning effort in the input bar.
 */

import { ModelPicker } from "~/components/ui/ModelPicker";
import { ProviderPicker } from "~/components/ui/ProviderPicker";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { isProviderReady } from "~/lib/setup";
import { resolveModel } from "~/lib/model-capabilities";
import type { ProviderId } from "~/lib/types";
import { type FC } from "react";
import { ReasoningEffortSelector } from "~/components/assistant-ui/ReasoningEffortSelector";

export const ComposerModelControls: FC = () => {
    const { settings, updateChat } = useSettings();
    const providerReady = isProviderReady(settings);

    return (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 pe-2">
            <ProviderPicker
                value={settings.chat.provider}
                onChange={(provider: ProviderId) => {
                    const first = resolveModel(
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

            <ReasoningEffortSelector variant="compact" />
        </div>
    );
};
