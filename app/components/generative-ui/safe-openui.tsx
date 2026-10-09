"use client";

/**
 * Safe action handling for OpenUI tool renderers.
 *
 * `@openuidev/assistant-ui`'s `OpenUIPresent` passes any `@OpenUrl` target to
 * `window.open` without checking the scheme, so a `javascript:` URL from a
 * model reply (or from prompt-injected page content) would run script in a
 * same-origin tab. This module replaces that renderer with one that only
 * opens absolute http(s) URLs. `prompt_openui` only handles
 * `ContinueConversation`, so its stock renderer is kept.
 */

import { defineToolkit, useAui, useAuiState, type Toolkit } from "@assistant-ui/react";
import {
    OPENUI_PRESENT_TOOL_NAME,
    OPENUI_PROMPT_TOOL_NAME,
    OpenUIContent,
    createOpenUIToolkit,
} from "@openuidev/assistant-ui";
import { BuiltinActionType, type ActionEvent, type Library } from "@openuidev/react-lang";
import { useCallback, useRef, type ComponentProps } from "react";
import { useChatGenerating } from "~/components/assistant-ui/ChatSessionContext";
import { ThreadBusyContext } from "./busy";

/** True only for absolute http(s) URLs. Relative, scheme-less, and executable schemes fail. */
export function isSafeActionUrl(value: unknown): value is string {
    if (typeof value !== "string") return false;
    let parsed: URL;
    try {
        parsed = new URL(value);
    } catch {
        return false;
    }
    return parsed.protocol === "https:" || parsed.protocol === "http:";
}

export type ActionSinks = {
    open: (url: string, target: string, features: string) => void;
    append: (text: string) => void;
};

/**
 * `busy` mirrors the composer's send lock: while a reply is running, follow-up
 * chips and buttons must not queue extra user messages.
 */
export function handleOpenUIAction(
    event: ActionEvent,
    sinks: ActionSinks,
    options: { busy?: boolean } = {},
) {
    if (event.type === BuiltinActionType.ContinueConversation) {
        if (options.busy) return;
        sinks.append(event.humanFriendlyMessage);
    } else if (event.type === BuiltinActionType.OpenUrl) {
        const url = event.params?.["url"];
        if (isSafeActionUrl(url)) sinks.open(url, "_blank", "noopener,noreferrer");
    }
}

type PresentProps = {
    args: { ui?: string };
    status: { type: string };
};

export function createSafeOpenUIToolkit(options: {
    library: Library;
    presentDescription?: string;
    promptDescription?: string;
    ErrorFallback?: ComponentProps<typeof OpenUIContent>["ErrorFallback"];
    theme?: ComponentProps<typeof OpenUIContent>["theme"];
}): Toolkit {
    const { theme, ...toolkitOptions } = options;
    const stock = createOpenUIToolkit(toolkitOptions) as unknown as Record<
        string,
        { render?: unknown } & Record<string, unknown>
    >;

    function SafePresent({ args, status }: PresentProps) {
        const aui = useAui();
        const running = useAuiState((state) => state.thread.isRunning);
        const generating = useChatGenerating();
        const busy = running || generating;
        const busyRef = useRef(busy);
        busyRef.current = busy;
        const onAction = useCallback(
            (event: ActionEvent) =>
                handleOpenUIAction(
                    event,
                    {
                        open: (url, target, features) => {
                            if (typeof window !== "undefined") window.open(url, target, features);
                        },
                        append: (text) =>
                            aui.thread.append({ role: "user", content: [{ type: "text", text }] }),
                    },
                    { busy: busyRef.current },
                ),
            [aui],
        );
        return (
            <ThreadBusyContext.Provider value={busy}>
                <div className="rich-root" data-busy={busy}>
                    <OpenUIContent
                        library={options.library}
                        theme={theme}
                        response={args.ui ?? ""}
                        isStreaming={status.type === "running"}
                        onAction={onAction}
                        {...(options.ErrorFallback !== undefined && {
                            ErrorFallback: options.ErrorFallback,
                        })}
                    />
                </div>
            </ThreadBusyContext.Provider>
        );
    }

    return defineToolkit({
        ...stock,
        [OPENUI_PRESENT_TOOL_NAME]: { ...stock[OPENUI_PRESENT_TOOL_NAME], render: SafePresent },
        [OPENUI_PROMPT_TOOL_NAME]: stock[OPENUI_PROMPT_TOOL_NAME],
    } as never) as Toolkit;
}
