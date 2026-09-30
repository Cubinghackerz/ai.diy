"use client";

/**
 * OpenUI generative-UI registration — mounted only when the Generative UI
 * tool-access toggle is on and the active model supports tools.
 *
 * Registers `present_openui` / `prompt_openui` as client tools on the model
 * context: `AssistantChatTransport` forwards their JSON schemas to /api/chat,
 * the server exposes them to the model without server executors, and the
 * renderers below paint the streamed OpenUI Lang spec. The Lang component
 * vocabulary is contributed as model instructions and forwarded to the
 * backend via the request's `modelInstructions` field.
 *
 * Loaded lazily: @openuidev/react-ui pulls a large component tree + styles,
 * so it only enters the bundle when the feature is enabled.
 */

import "@openuidev/react-ui/layered/styles/index.css";
import {
    AuiProvider,
    Tools,
    useAssistantInstructions,
    useAui,
} from "@assistant-ui/react";
import { createOpenUIIntegration } from "@openuidev/assistant-ui";
import type { ReactNode } from "react";

const integration = createOpenUIIntegration({
    theme: { mode: "dark" },
});

function OpenUIInstructions() {
    useAssistantInstructions(integration.instructions);
    return null;
}

export default function OpenUIRegistration({
    children,
}: {
    children: ReactNode;
}) {
    const aui = useAui({ tools: Tools({ toolkit: integration.toolkit }) });
    return (
        <AuiProvider value={aui}>
            <OpenUIInstructions />
            {children}
        </AuiProvider>
    );
}
