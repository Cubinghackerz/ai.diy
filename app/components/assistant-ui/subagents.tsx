"use client";

/**
 * Subagents — beta delegation feature.
 *
 * When enabled in Settings > Experimental, the model can call
 * `spawn_subagent`. The browser intercepts the tool call, asks the user for
 * approval in a popup, then runs a nested chat (same tools as the main chat)
 * whose live reasoning and tool calls stream into the popup. Subagents cannot
 * be prompted by the user, and the main model waits for the subagent's final
 * answer before synthesizing its reply.
 */

import { useChat } from "@ai-sdk/react";
import { AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from "ai";
import {
    AlertCircle,
    Check,
    ChevronDown,
    ChevronUp,
    FileText,
    Loader2,
    ShieldCheck,
    X,
} from "lucide-react";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { artifactContentHash, inferArtifactMimeType } from "~/lib/artifacts";
import { useCanvas } from "~/lib/canvas";
import {
    buildLocalMemoryContext,
    hasLocalMemoryEntries,
    readLocalMemory,
} from "~/lib/memory";
import { localProviderKey } from "~/lib/provider-credentials";
import { runBrowserPython } from "~/lib/pyodide";
import { useSettings } from "~/lib/providers/SettingsProvider";

export type SubagentSessionStatus =
    | "awaiting-approval"
    | "running"
    | "complete"
    | "declined"
    | "error";

export type SubagentSession = {
    id: string;
    task: string;
    status: SubagentSessionStatus;
    output?: string;
    error?: string;
};

type SubagentContextValue = {
    sessions: SubagentSession[];
    runSubagent: (toolCallId: string, task: string) => Promise<string>;
    approve: (id: string) => void;
    deny: (id: string) => void;
    complete: (id: string, output: string) => void;
    fail: (id: string, error: string) => void;
    dismiss: (id: string) => void;
};

const SubagentContext = createContext<SubagentContextValue | null>(null);

export function SubagentProvider({
    threadId,
    children,
}: {
    threadId: string | null;
    children: ReactNode;
}) {
    const [sessions, setSessions] = useState<SubagentSession[]>([]);
    const resolversRef = useRef(new Map<string, (value: string) => void>());

    const patchSession = useCallback(
        (id: string, patch: Partial<SubagentSession>) => {
            setSessions((current) =>
                current.map((session) =>
                    session.id === id ? { ...session, ...patch } : session,
                ),
            );
        },
        [],
    );

    const runSubagent = useCallback((toolCallId: string, task: string) => {
        return new Promise<string>((resolve) => {
            resolversRef.current.set(toolCallId, resolve);
            setSessions((current) => [
                ...current,
                {
                    id: toolCallId,
                    task: task.trim() || "Unspecified subtask",
                    status: "awaiting-approval",
                },
            ]);
        });
    }, []);

    const approve = useCallback(
        (id: string) => patchSession(id, { status: "running" }),
        [patchSession],
    );

    const deny = useCallback(
        (id: string) => {
            resolversRef.current.get(id)?.(
                "The user declined the subagent request. Continue without it, or complete the work directly.",
            );
            resolversRef.current.delete(id);
            patchSession(id, { status: "declined" });
        },
        [patchSession],
    );

    const complete = useCallback(
        (id: string, output: string) => {
            resolversRef.current.get(id)?.(output);
            resolversRef.current.delete(id);
            patchSession(id, { status: "complete", output });
        },
        [patchSession],
    );

    const fail = useCallback(
        (id: string, error: string) => {
            resolversRef.current.get(id)?.(`The subagent failed: ${error}`);
            resolversRef.current.delete(id);
            patchSession(id, { status: "error", error });
        },
        [patchSession],
    );

    const dismiss = useCallback((id: string) => {
        setSessions((current) => current.filter((session) => session.id !== id));
    }, []);

    const value = useMemo<SubagentContextValue>(
        () => ({
            sessions,
            runSubagent,
            approve,
            deny,
            complete,
            fail,
            dismiss,
        }),
        [approve, complete, deny, dismiss, fail, runSubagent, sessions],
    );

    return (
        <SubagentContext.Provider value={value}>
            {children}
            <SubagentPopup threadId={threadId} />
        </SubagentContext.Provider>
    );
}

export function useSubagent() {
    const ctx = useContext(SubagentContext);
    if (!ctx) throw new Error("useSubagent requires SubagentProvider");
    return ctx;
}

function parseChatError(response: Response, fallback: string): Promise<string> {
    return response.text().then((text) => {
        try {
            const parsed = JSON.parse(text) as { error?: string; message?: string };
            return parsed.error || parsed.message || fallback;
        } catch {
            return text.trim() || fallback;
        }
    });
}

function subagentResultText(messages: UIMessage[]): string {
    return messages
        .filter((message) => message.role === "assistant")
        .flatMap((message) => message.parts)
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n")
        .trim()
        .slice(0, 64_000);
}

const STATUS_LABEL: Record<SubagentSessionStatus, string> = {
    "awaiting-approval": "Needs approval",
    running: "Running",
    complete: "Done",
    declined: "Declined",
    error: "Failed",
};

function SubagentPopup({ threadId }: { threadId: string | null }) {
    const { sessions, dismiss } = useSubagent();

    if (sessions.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 flex w-[21rem] max-w-[calc(100vw-2rem)] flex-col gap-2">
            {sessions.map((session) => (
                <SubagentSessionCard
                    key={session.id}
                    session={session}
                    threadId={threadId}
                    onDismiss={dismiss}
                />
            ))}
        </div>
    );
}

function SubagentSessionCard({
    session,
    threadId,
    onDismiss,
}: {
    session: SubagentSession;
    threadId: string | null;
    onDismiss: (id: string) => void;
}) {
    const { approve, deny, complete, fail } = useSubagent();
    const [expanded, setExpanded] = useState(true);

    useEffect(() => {
        if (session.status === "awaiting-approval" || session.status === "running") {
            setExpanded(true);
        }
    }, [session.status]);

    const StatusIcon =
        session.status === "running"
            ? Loader2
            : session.status === "complete"
              ? Check
              : session.status === "declined"
                ? X
                : session.status === "error"
                  ? AlertCircle
                  : ShieldCheck;

    const terminal = ["complete", "declined", "error"].includes(session.status);

    return (
        <div className="overflow-hidden rounded-xl border border-border/80 bg-background shadow-lg">
            <button
                type="button"
                onClick={() => setExpanded((current) => !current)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left outline-none hover:bg-accent/50"
                aria-expanded={expanded}
            >
                <StatusIcon
                    size={14}
                    className={`${cnStatus(session.status)}${session.status === "running" ? " animate-spin" : ""}`}
                />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                    Subagent
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                    {STATUS_LABEL[session.status]}
                </span>
                {expanded ? (
                    <ChevronDown size={12} className="shrink-0 text-muted-foreground" />
                ) : (
                    <ChevronUp size={12} className="shrink-0 text-muted-foreground" />
                )}
            </button>

            {expanded ? (
                <div className="border-t border-border/60 px-3 py-2">
                    <p className="mb-2 line-clamp-4 whitespace-pre-wrap text-[11px] leading-relaxed text-foreground">
                        {session.task}
                    </p>

                    {session.status === "awaiting-approval" ? (
                        <>
                            <p className="mb-2 text-[10px] text-muted-foreground">
                                You approve each subagent before it runs. You cannot
                                prompt it while it works.
                            </p>
                            <div className="flex gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => deny(session.id)}
                                    className="flex-1 rounded-lg border border-border px-2 py-1.5 text-[11px] font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground"
                                >
                                    Deny
                                </button>
                                <button
                                    type="button"
                                    onClick={() => approve(session.id)}
                                    className="flex-1 rounded-lg bg-primary px-2 py-1.5 text-[11px] font-semibold text-primary-foreground outline-none hover:bg-primary/90"
                                >
                                    Approve
                                </button>
                            </div>
                        </>
                    ) : null}

                    {session.status === "running" ? (
                        <SubagentRun
                            sessionId={session.id}
                            task={session.task}
                            threadId={threadId}
                            onComplete={(output) => complete(session.id, output)}
                            onError={(error) => fail(session.id, error)}
                        />
                    ) : null}

                    {session.status === "complete" && session.output ? (
                        <div className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/50 px-2 py-1.5 text-[11px] leading-relaxed text-foreground">
                            {session.output}
                        </div>
                    ) : null}

                    {session.status === "error" && session.error ? (
                        <p className="text-[11px] leading-relaxed text-destructive">
                            {session.error}
                        </p>
                    ) : null}

                    {session.status === "declined" ? (
                        <p className="text-[11px] text-muted-foreground">
                            The main model was told the subagent was declined.
                        </p>
                    ) : null}

                    {terminal ? (
                        <button
                            type="button"
                            onClick={() => onDismiss(session.id)}
                            className="mt-2 w-full rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground"
                        >
                            Dismiss
                        </button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

function cnStatus(status: SubagentSessionStatus): string {
    switch (status) {
        case "running":
            return "text-primary";
        case "complete":
            return "text-success";
        case "declined":
            return "text-muted-foreground";
        case "error":
            return "text-destructive";
        case "awaiting-approval":
            return "text-warning";
    }
}

function SubagentRun({
    sessionId,
    task,
    threadId,
    onComplete,
    onError,
}: {
    sessionId: string;
    task: string;
    threadId: string | null;
    onComplete: (output: string) => void;
    onError: (error: string) => void;
}) {
    const { settings } = useSettings();
    const { addArtifact } = useCanvas();
    const settingsRef = useRef(settings);
    settingsRef.current = settings;
    const threadIdRef = useRef(threadId);
    threadIdRef.current = threadId;
    const callbacksRef = useRef({ onComplete, onError });
    callbacksRef.current = { onComplete, onError };
    const sentRef = useRef(false);
    const pendingClientCalls = useRef(0);
    const chatRef = useRef<ReturnType<typeof useChat> | null>(null);

    const transport = useMemo(
        () =>
            new AssistantChatTransport({
                api: "/api/chat",
                fetch: async (input, init) => {
                    const response = await globalThis.fetch(input, init);
                    if (!response.ok) {
                        throw new Error(
                            await parseChatError(response, "Subagent run failed"),
                        );
                    }
                    return response;
                },
                prepareSendMessagesRequest: async (options) => {
                    const s = settingsRef.current;
                    const provider = s.chat.provider;
                    const providerConfig = s.providers[provider];
                    const apiKey = providerConfig?.apiKey?.trim() || "";
                    const baseUrl = providerConfig?.baseUrl?.trim() || undefined;
                    const memoryEnabled = s.memoryEnabled !== false;
                    return {
                        body: {
                            ...options.body,
                            messages: options.messages,
                            model: s.chat.model,
                            provider,
                            apiKey:
                                provider === "custom" &&
                                providerConfig?.openAICompatible?.authMode &&
                                providerConfig.openAICompatible.authMode !== "bearer"
                                    ? ""
                                    : apiKey || localProviderKey(provider),
                            baseUrl,
                            openAICompatible: providerConfig?.openAICompatible,
                            systemPrompt: s.chat.systemPrompt,
                            temperature: s.chat.temperature,
                            maxTokens: s.chat.maxTokens,
                            topP: s.chat.topP,
                            reasoningEffort: s.chat.reasoningEffort,
                            mcpServers: s.mcpServers.filter((server) => server.enabled),
                            memoryContext: memoryEnabled
                                ? await buildLocalMemoryContext()
                                : "",
                            toolSettings: {
                                webSearchEnabled: s.webSearchEnabled,
                                calculatorEnabled: s.calculatorEnabled,
                                pythonEnabled: s.pythonEnabled,
                                webSearchEngine: s.webSearchEngine,
                                searxngUrl: s.searxngUrl,
                                skillsEnabled: s.skillsEnabled,
                                connectors: s.connectors,
                                memoryAvailable:
                                    memoryEnabled && (await hasLocalMemoryEntries()),
                                subagentsEnabled: false,
                            },
                            subagentMode: true,
                        },
                    };
                },
            }),
        [],
    );

    const chat = useChat({
        id: `subagent-${sessionId}`,
        transport,
        onToolCall: ({ toolCall }) => {
            if (
                !["run_python", "run_code", "memory", "ask_user"].includes(
                    toolCall.toolName,
                )
            ) {
                return;
            }
            pendingClientCalls.current += 1;
            const input = toolCall.input as {
                code?: string;
                query?: string;
            };
            const taskPromise =
                toolCall.toolName === "ask_user"
                    ? Promise.resolve(
                          "Subagents cannot ask the user questions. State your assumption and proceed.",
                      )
                    : toolCall.toolName === "memory"
                      ? settingsRef.current.memoryEnabled !== false
                          ? readLocalMemory(input.query)
                          : Promise.resolve("Memory is disabled for this subagent.")
                      : runBrowserPython(input.code ?? "");
            void taskPromise.then(
                (result) => {
                    const output =
                        typeof result === "string" ? result : result.output;
                    const pythonResult =
                        typeof result === "string" ? null : result;
                    if (pythonResult) {
                        for (const artifact of pythonResult.artifacts) {
                            addArtifact(
                                {
                                    kind: "file",
                                    title: artifact.filename,
                                    filename: artifact.filename,
                                    content: artifact.content,
                                    contentEncoding: artifact.contentEncoding,
                                    mimeType: inferArtifactMimeType(artifact.filename),
                                    sourceKey: `python:${artifact.filename}:${artifact.contentEncoding}:${artifact.content.length}:${artifactContentHash(artifact.content)}`,
                                },
                                { scopeId: threadIdRef.current },
                            );
                        }
                    }
                    const addToolOutput = chatRef.current
                        ?.addToolOutput as unknown as
                        | ((args: {
                              tool: string;
                              toolCallId: string;
                              state: "output-available";
                              output: string;
                          }) => void)
                        | undefined;
                    addToolOutput?.({
                        tool: toolCall.toolName,
                        toolCallId: toolCall.toolCallId,
                        state: "output-available",
                        output,
                    });
                },
                (error) => {
                    const addToolOutput = chatRef.current
                        ?.addToolOutput as unknown as
                        | ((args: {
                              tool: string;
                              toolCallId: string;
                              state: "output-error";
                              errorText: string;
                          }) => void)
                        | undefined;
                    addToolOutput?.({
                        tool: toolCall.toolName,
                        toolCallId: toolCall.toolCallId,
                        state: "output-error",
                        errorText:
                            error instanceof Error
                                ? error.message
                                : "Pyodide execution failed",
                    });
                },
            );
        },
        sendAutomaticallyWhen: ({ messages }) => {
            if (pendingClientCalls.current === 0) return false;
            if (!lastAssistantMessageIsCompleteWithToolCalls({ messages })) {
                return false;
            }
            pendingClientCalls.current = 0;
            return true;
        },
        onFinish: ({ messages, isError }) => {
            if (!isError) {
                callbacksRef.current.onComplete(subagentResultText(messages));
            }
        },
        onError: (error) => {
            callbacksRef.current.onError(
                error instanceof Error ? error.message : String(error),
            );
        },
    });
    chatRef.current = chat;

    useEffect(() => {
        if (sentRef.current) return;
        sentRef.current = true;
        void chat.sendMessage({ text: task });
    }, [chat, task]);

    return <SubagentActivity chat={chat} />;
}

function SubagentActivity({
    chat,
}: {
    chat: ReturnType<typeof useChat>;
}) {
    const isRunning =
        chat.status === "submitted" || chat.status === "streaming";
    const parts = chat.messages.flatMap((message) =>
        message.role === "assistant" ? message.parts : [],
    );

    return (
        <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto pr-1">
            {parts.map((part, index) => {
                switch (part.type) {
                    case "reasoning":
                        return (
                            <div
                                key={`reasoning-${index}`}
                                className="rounded-md bg-muted/60 px-2 py-1 text-[10px] italic leading-relaxed text-muted-foreground"
                            >
                                {part.text}
                            </div>
                        );
                    case "text":
                        return part.text ? (
                            <div
                                key={`text-${index}`}
                                className="whitespace-pre-wrap text-xs leading-relaxed text-foreground"
                            >
                                {part.text}
                            </div>
                        ) : null;
                    case "dynamic-tool": {
                        const isActive =
                            part.state === "input-streaming" ||
                            part.state === "input-available";
                        const argsText = JSON.stringify(part.input ?? {}).slice(
                            0,
                            140,
                        );
                        return (
                            <div
                                key={`tool-${index}`}
                                className="flex items-start gap-1.5 rounded-md border border-border/60 bg-background px-2 py-1"
                            >
                                {isActive ? (
                                    <Loader2
                                        size={11}
                                        className="mt-0.5 shrink-0 animate-spin text-primary"
                                    />
                                ) : (
                                    <Check
                                        size={11}
                                        className="mt-0.5 shrink-0 text-success"
                                    />
                                )}
                                <div className="min-w-0">
                                    <span className="font-mono text-[10px] font-semibold">
                                        {part.toolName}
                                    </span>
                                    {argsText ? (
                                        <div className="truncate font-mono text-[10px] text-muted-foreground">
                                            {argsText}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        );
                    }
                    case "file":
                        return (
                            <div
                                key={`file-${index}`}
                                className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
                            >
                                <FileText size={11} className="shrink-0" />
                                <span className="truncate">{part.filename}</span>
                            </div>
                        );
                    default: {
                        // Static tool parts arrive with a `tool-<name>` type;
                        // they share the dynamic-tool shape.
                        if (
                            typeof part.type === "string" &&
                            part.type.startsWith("tool-")
                        ) {
                            const tool = part as unknown as {
                                toolName: string;
                                input?: unknown;
                                state?: string;
                            };
                            const isActive =
                                tool.state === "input-streaming" ||
                                tool.state === "input-available";
                            const argsText = JSON.stringify(tool.input ?? {}).slice(
                                0,
                                140,
                            );
                            return (
                                <div
                                    key={`tool-${index}`}
                                    className="flex items-start gap-1.5 rounded-md border border-border/60 bg-background px-2 py-1"
                                >
                                    {isActive ? (
                                        <Loader2
                                            size={11}
                                            className="mt-0.5 shrink-0 animate-spin text-primary"
                                        />
                                    ) : (
                                        <Check
                                            size={11}
                                            className="mt-0.5 shrink-0 text-success"
                                        />
                                    )}
                                    <div className="min-w-0">
                                        <span className="font-mono text-[10px] font-semibold">
                                            {tool.toolName}
                                        </span>
                                        {argsText ? (
                                            <div className="truncate font-mono text-[10px] text-muted-foreground">
                                                {argsText}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    }
                }
            })}
            {isRunning ? (
                <div className="flex items-center gap-1.5 px-1 py-0.5 text-[10px] text-muted-foreground">
                    <Loader2 size={11} className="animate-spin" />
                    Working…
                </div>
            ) : null}
            {chat.status === "error" && chat.error ? (
                <p className="text-[10px] text-destructive">
                    {chat.error instanceof Error
                        ? chat.error.message
                        : String(chat.error)}
                </p>
            ) : null}
        </div>
    );
}
