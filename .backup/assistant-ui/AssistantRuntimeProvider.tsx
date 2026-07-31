/**
 * AssistantRuntimeProvider — Sets up assistant-ui runtime connected to Vercel AI SDK backend
 * 
 * Uses AssistantChatTransport and useChatRuntime from '@assistant-ui/react-ai-sdk'.
 * Credentials and settings are sent dynamically in the request body (BYOK).
 */

import { AssistantRuntimeProvider as AuiRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { useMemo, type ReactNode } from "react";

export function AssistantRuntimeProvider({ children }: { children: ReactNode }) {
    const { settings } = useSettings();
    const providerConfig = settings.providers[settings.chat.provider];

    const transport = useMemo(
        () =>
            new AssistantChatTransport({
                api: "/api/chat",
                body: {
                    model: settings.chat.model,
                    provider: settings.chat.provider,
                    apiKey: providerConfig?.apiKey || "",
                    baseUrl: providerConfig?.baseUrl || undefined,
                    systemPrompt: settings.chat.systemPrompt,
                    temperature: settings.chat.temperature,
                    maxTokens: settings.chat.maxTokens,
                    topP: settings.chat.topP,
                    toolSettings: {
                        webSearchEnabled: settings.webSearchEnabled,
                        calculatorEnabled: settings.calculatorEnabled,
                        pythonEnabled: settings.pythonEnabled,
                    },
                },
            }),
        [settings, providerConfig]
    );

    const runtime = useChatRuntime({ transport });

    return (
        <AuiRuntimeProvider runtime={runtime}>
            {children}
        </AuiRuntimeProvider>
    );
}