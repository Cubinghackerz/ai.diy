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
import { AuiProvider, Tools, useAssistantInstructions, useAui } from "@assistant-ui/react";
import { createOpenUIIntegration } from "@openuidev/assistant-ui";
import type { ReactNode } from "react";
import { richLibrary, richPromptOptions } from "~/components/generative-ui/library";
import { ExternalMediaContext } from "~/components/generative-ui/media";
import { buildJsonRenderInstructions } from "~/components/generative-ui/json/instructions";
import { createJsonRenderToolkit } from "~/components/generative-ui/json/present";
import { createSafeOpenUIToolkit } from "~/components/generative-ui/safe-openui";
import { SectionBoundary } from "~/components/ui/SectionBoundary";
import { useSettings } from "~/lib/providers/SettingsProvider";
import type { Toolkit } from "@assistant-ui/react";

const theme = { mode: "dark" } as const;

// The integration supplies tool names, parameters, and the system-prompt
// instructions; the toolkit itself comes from createSafeOpenUIToolkit so that
// `@OpenUrl` actions can only open http(s) links.
const integration = createOpenUIIntegration({
  library: richLibrary,
  promptOptions: richPromptOptions,
  theme,
});

const safeToolkit = createSafeOpenUIToolkit({ library: richLibrary, theme });

// json-render adds dashboards, charts and Python figures under the same
// Generative UI switch; its instructions are short because the catalog is fixed.
const jsonRenderInstructions = buildJsonRenderInstructions();

const toolkit: Toolkit = Object.fromEntries(
  Object.entries({ ...safeToolkit, ...createJsonRenderToolkit() }).map(([name, definition]) => {
    const Render = definition.render;
    if (!Render) return [name, definition];
    const render: typeof Render = (props) => (
      <SectionBoundary label="Generative UI" resetKey={props.toolCallId}>
        <Render {...props} />
      </SectionBoundary>
    );
    return [name, { ...definition, render }];
  }),
);

function OpenUIInstructions() {
  useAssistantInstructions(integration.instructions);
  useAssistantInstructions(jsonRenderInstructions);
  return null;
}

export default function OpenUIRegistration({ children }: { children: ReactNode }) {
  const aui = useAui({ tools: Tools({ toolkit }) });
  const { settings } = useSettings();
  return (
    <AuiProvider value={aui}>
      <ExternalMediaContext.Provider value={settings.toolAccess.externalMedia === true}>
        <OpenUIInstructions />
        {children}
      </ExternalMediaContext.Provider>
    </AuiProvider>
  );
}
