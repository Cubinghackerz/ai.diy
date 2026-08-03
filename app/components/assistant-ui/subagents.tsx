"use client";

/**
 * Subagents — delegation with in-chat sessions and live detail panels.
 *
 * When enabled in Settings > Experimental, the model can call
 * `spawn_subagent`. The browser intercepts the tool call, creates a session
 * and shows its card inline in the chat thread, where the user approves or
 * denies it. Up to `MAX_ACTIVE_SUBAGENTS` run concurrently; each session runs
 * a nested chat (same tools as the main chat) whose reasoning, tool calls,
 * files, and final answer stream live into the session card. Clicking a
 * session opens a detail panel — a normal chat-style transcript of exactly
 * what that subagent is doing. Files and artifacts the subagent creates are
 * captured into Canvas, scoped to the current thread.
 */

import { useChat } from "@ai-sdk/react";
import { AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import {
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";
import { type ToolCallMessagePartProps } from "@assistant-ui/react";
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  ARTIFACT_MARKER,
  artifactContentHash,
  inferArtifactMimeType,
  type ArtifactContentEncoding,
} from "~/lib/artifacts";
import { useCanvas, type ArtifactKind } from "~/lib/canvas";
import {
  buildLocalMemoryContext,
  hasLocalMemoryEntries,
  readLocalMemory,
} from "~/lib/memory";
import { localProviderKey } from "~/lib/provider-credentials";
import { runBrowserPython } from "~/lib/pyodide";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { cn } from "~/lib/utils";

export const MAX_ACTIVE_SUBAGENTS = 3;

export type SubagentSessionStatus =
  | "awaiting-approval"
  | "running"
  | "complete"
  | "declined"
  | "error"
  | "limit";

export type SubagentSession = {
  id: string;
  toolCallId: string;
  task: string;
  status: SubagentSessionStatus;
  output?: string;
  error?: string;
};

/** Live subagent run snapshot, published by the nested chat into context. */
export type SubagentLivePart =
  | { type: "reasoning"; text: string }
  | { type: "text"; text: string }
  | { type: "tool"; name: string; state: string; argsText: string }
  | { type: "file"; filename: string; mimeType?: string; data?: string };

export type SubagentRunHandle = {
  sessionId: string;
  status: string;
  parts: SubagentLivePart[];
  error?: string;
  artifactIds: string[];
};

type SubagentContextValue = {
  sessions: SubagentSession[];
  runs: Record<string, SubagentRunHandle>;
  /** Bumped whenever a live run snapshot publishes or unregisters. */
  runVersion: number;
  activeSessionId: string | null;
  runSubagent: (toolCallId: string, task: string) => Promise<string>;
  approve: (id: string) => void;
  deny: (id: string) => void;
  complete: (id: string, output: string) => void;
  fail: (id: string, error: string) => void;
  dismiss: (id: string) => void;
  openSession: (id: string) => void;
  closePanel: () => void;
  publishRun: (handle: SubagentRunHandle) => void;
  unregisterRun: (id: string) => void;
};

const SubagentContext = createContext<SubagentContextValue | null>(null);

function createSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `subagent_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `subagent_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function SubagentProvider({
  threadId,
  children,
}: {
  threadId: string | null;
  children: ReactNode;
}) {
  const [sessions, setSessions] = useState<SubagentSession[]>([]);
  const sessionsRef = useRef<SubagentSession[]>([]);
  sessionsRef.current = sessions;
  const resolversRef = useRef(new Map<string, (value: string) => void>());
  const runsRef = useRef<Record<string, SubagentRunHandle>>({});
  const [runVersion, setRunVersion] = useState(0);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Subagent sessions belong to the current thread; switching chats clears them.
  useEffect(() => {
    setSessions([]);
    setActiveSessionId(null);
    runsRef.current = {};
    setRunVersion((v) => v + 1);
  }, [threadId]);

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
      const session: SubagentSession = {
        id: createSessionId(),
        toolCallId,
        task: task.trim() || "Unspecified subtask",
        status: "awaiting-approval",
      };
      const activeCount = sessionsRef.current.filter(
        (s) => s.status === "awaiting-approval" || s.status === "running",
      ).length;
      if (activeCount >= MAX_ACTIVE_SUBAGENTS) {
        session.status = "limit";
        session.error = `A maximum of ${MAX_ACTIVE_SUBAGENTS} subagents may run at once. Do not spawn another right now — wait for one to finish, or complete the subtask yourself with your tools.`;
        setSessions((current) => [...current, session]);
        resolve(session.error);
        return;
      }
      resolversRef.current.set(session.id, resolve);
      setSessions((current) => [...current, session]);
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
    setActiveSessionId((current) => (current === id ? null : current));
  }, []);

  const openSession = useCallback((id: string) => setActiveSessionId(id), []);
  const closePanel = useCallback(() => setActiveSessionId(null), []);

  const publishRun = useCallback(
    (handle: SubagentRunHandle) => {
      const existing = runsRef.current[handle.sessionId];
      if (existing === handle) return;
      runsRef.current = { ...runsRef.current, [handle.sessionId]: handle };
      setRunVersion((v) => v + 1);
    },
    [],
  );

  const unregisterRun = useCallback((id: string) => {
    if (!runsRef.current[id]) return;
    const next = { ...runsRef.current };
    delete next[id];
    runsRef.current = next;
    setRunVersion((v) => v + 1);
  }, []);

  const value = useMemo<SubagentContextValue>(
    () => ({
      sessions,
      runs: runsRef.current,
      runVersion,
      activeSessionId,
      runSubagent,
      approve,
      deny,
      complete,
      fail,
      dismiss,
      openSession,
      closePanel,
      publishRun,
      unregisterRun,
    }),
    [
      sessions,
      runVersion,
      activeSessionId,
      runSubagent,
      approve,
      deny,
      complete,
      fail,
      dismiss,
      openSession,
      closePanel,
      publishRun,
      unregisterRun,
    ],
  );

  return (
    <SubagentContext.Provider value={value}>
      {children}
      <SubagentRunHost threadId={threadId} />
      <SubagentDetailDialog />
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
  limit: "Limit reached",
};

function statusIcon(status: SubagentSessionStatus) {
  switch (status) {
    case "running":
      return Loader2;
    case "complete":
      return Check;
    case "declined":
      return X;
    case "error":
    case "limit":
      return AlertCircle;
    case "awaiting-approval":
      return ShieldCheck;
  }
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
    case "limit":
    case "awaiting-approval":
      return "text-warning";
  }
}

function isTerminal(status: SubagentSessionStatus): boolean {
  return ["complete", "declined", "error", "limit"].includes(status);
}

/**
 * Mounts one nested chat per session so the subagent keeps working even when
 * its message card is collapsed. The live snapshot is published into the
 * provider so both the in-thread card and the detail panel render it.
 */
function SubagentRunHost({ threadId }: { threadId: string | null }) {
  const { sessions } = useSubagent();
  const mounted = sessions.filter((session) =>
    ["running", "complete", "error"].includes(session.status),
  );
  return (
    <>
      {mounted.map((session) => (
        <SubagentRun
          key={session.id}
          sessionId={session.id}
          task={session.task}
          threadId={threadId}
        />
      ))}
    </>
  );
}

function serializeParts(parts: UIMessage["parts"]): SubagentLivePart[] {
  const out: SubagentLivePart[] = [];
  for (const part of parts) {
    if (part.type === "reasoning" && part.text) {
      out.push({ type: "reasoning", text: part.text });
    } else if (part.type === "text" && part.text) {
      out.push({ type: "text", text: part.text });
    } else if (part.type === "file") {
      out.push({
        type: "file",
        filename: part.filename ?? "file",
        ...(part.mediaType ? { mimeType: part.mediaType } : {}),
        ...(typeof part.url === "string" ? { data: part.url } : {}),
      });
    } else if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) {
      const tool = part as UIMessage["parts"][number] & {
        toolName?: string;
        state?: string;
        input?: unknown;
      };
      out.push({
        type: "tool",
        name:
          typeof tool.toolName === "string" && tool.toolName
            ? tool.toolName
            : part.type.replace(/^tool-/, ""),
        state: tool.state ?? "complete",
        argsText: JSON.stringify(tool.input ?? {}).slice(0, 200),
      });
    }
  }
  return out;
}

function SubagentRun({
  sessionId,
  task,
  threadId,
}: {
  sessionId: string;
  task: string;
  threadId: string | null;
}) {
  const { settings } = useSettings();
  const { addArtifact } = useCanvas();
  const { complete, fail, publishRun, unregisterRun } = useSubagent();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const threadIdRef = useRef(threadId);
  threadIdRef.current = threadId;
  const callbacksRef = useRef({ complete, fail });
  callbacksRef.current = { complete, fail };
  const sentRef = useRef(false);
  const pendingClientCalls = useRef(0);
  const [artifactIds, setArtifactIds] = useState<string[]>([]);
  const artifactIdsRef = useRef<string[]>([]);
  const seenArtifactKeysRef = useRef(new Set<string>());

  const recordArtifactId = useCallback((id: string) => {
    setArtifactIds((current) => {
      if (current.includes(id)) return current;
      artifactIdsRef.current = [...artifactIdsRef.current, id];
      return artifactIdsRef.current;
    });
  }, []);

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
          const output = typeof result === "string" ? result : result.output;
          const pythonResult = typeof result === "string" ? null : result;
          if (pythonResult) {
            for (const artifact of pythonResult.artifacts) {
              const artifactId = addArtifact(
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
              recordArtifactId(artifactId);
            }
          }
          chat.addToolOutput({
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            state: "output-available",
            output,
          });
        },
        (error) => {
          chat.addToolOutput({
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
        callbacksRef.current.complete(sessionId, subagentResultText(messages));
      }
    },
    onError: (error) => {
      callbacksRef.current.fail(
        sessionId,
        error instanceof Error ? error.message : String(error),
      );
    },
  });

  // Publish the live snapshot (parts, status, artifacts) to the provider so
  // in-thread cards and the detail panel render this session's activity.
  const liveParts = useMemo(
    () => serializeParts(chat.messages.flatMap((m) => (m.role === "assistant" ? m.parts : []))),
    [chat.messages],
  );
  const liveStatus = chat.status;
  const liveError = chat.error;

  useEffect(() => {
    publishRun({
      sessionId,
      status: liveStatus,
      parts: liveParts,
      ...(liveError
        ? { error: liveError instanceof Error ? liveError.message : String(liveError) }
        : {}),
      artifactIds,
    });
  }, [sessionId, liveStatus, liveParts, liveError, artifactIds, publishRun]);

  useEffect(() => {
    return () => unregisterRun(sessionId);
  }, [sessionId, unregisterRun]);

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    void chat.sendMessage({ text: task });
  }, [chat, task]);

  // Capture create_file / generate_file results into Canvas, scoped to the
  // current thread so they appear next to the main chat's artifacts.
  useEffect(() => {
    const messages = chat.messages as UIMessage[];
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      for (const part of message.parts ?? []) {
        if (!isToolPart(part)) continue;
        if (part.state !== "output-available") continue;
        const toolName = toolPartName(part);
        if (!["create_file", "generate_file"].includes(toolName)) continue;
        const output = part.output;
        const resultText =
          typeof output === "string"
            ? output
            : output != null
              ? JSON.stringify(output)
              : "";
        if (!resultText.includes(ARTIFACT_MARKER)) continue;
        const artifact = extractArtifactPayload(resultText);
        if (!artifact) continue;
        const key = `${message.id}:${toolName}:${part.toolCallId ?? artifact.filename}`;
        if (seenArtifactKeysRef.current.has(key)) continue;
        seenArtifactKeysRef.current.add(key);
        const artifactId = addArtifact(
          {
            kind: artifact.kind,
            title: artifact.title,
            filename: artifact.filename,
            content: artifact.content,
            mimeType: artifact.mimeType,
            contentEncoding: artifact.contentEncoding,
            sourceKey: `${artifact.kind}:${artifact.filename}:${artifact.contentEncoding ?? "text"}:${artifact.content}`,
          },
          { scopeId: threadId, open: true },
        );
        recordArtifactId(artifactId);
      }
    }
  }, [chat.messages, addArtifact, recordArtifactId, threadId]);

  // The host owns the nested chat; cards and the detail panel render the
  // published snapshot.
  return null;
}

type ToolPart = {
  toolName?: string;
  toolCallId?: string;
  state?: string;
  output?: unknown;
};

function isToolPart(
  part: UIMessage["parts"][number],
): part is UIMessage["parts"][number] & ToolPart {
  return part.type === "dynamic-tool" || part.type.startsWith("tool-");
}

function toolPartName(part: UIMessage["parts"][number] & ToolPart): string {
  if (typeof part.toolName === "string" && part.toolName) return part.toolName;
  return part.type.replace(/^tool-/, "");
}

function mapArtifactKind(kind: string): ArtifactKind {
  const k = kind.toLowerCase();
  if (/html|svg|preview/.test(k)) return "html";
  if (/python|py/.test(k)) return "python";
  if (/code|ts|js|css|json|md|markdown|txt/.test(k)) return "code";
  return "file";
}

function extractArtifactPayload(text: string): {
  kind: ArtifactKind;
  title: string;
  filename: string;
  content: string;
  mimeType?: string;
  contentEncoding?: ArtifactContentEncoding;
} | null {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (!parsed[ARTIFACT_MARKER]) return null;
    return {
      kind: mapArtifactKind(String(parsed.kind ?? "file")),
      title: String(parsed.title ?? "Artifact"),
      filename: String(parsed.filename ?? "file.txt"),
      content: String(parsed.content ?? ""),
      mimeType: parsed.mimeType ? String(parsed.mimeType) : undefined,
      contentEncoding:
        parsed.contentEncoding === "base64" || parsed.contentEncoding === "hex"
          ? (parsed.contentEncoding as ArtifactContentEncoding)
          : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Live (or replay) transcript of one subagent session rendered from the
 * published run snapshot. `compact` is used inside the thread card; the
 * detail panel renders the full chat-style view with markdown answers and
 * collapsible reasoning.
 */
function SubagentActivity({
  run,
  compact = false,
}: {
  run: SubagentRunHandle;
  compact?: boolean;
}) {
  const isRunning = run.status === "submitted" || run.status === "streaming";

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 overflow-y-auto pr-1",
        compact ? "max-h-48" : "",
      )}
    >
      {run.parts.map((part, index) => (
        <SubagentLivePartView key={`part-${index}`} part={part} compact={compact} />
      ))}
      {isRunning ? (
        <div className="flex items-center gap-1.5 px-1 py-0.5 text-[10px] text-muted-foreground">
          <Loader2 size={11} className="animate-spin" />
          Working…
        </div>
      ) : null}
      {run.error ? (
        <p className="text-[10px] text-destructive">{run.error}</p>
      ) : null}
    </div>
  );
}

function SubagentLivePartView({
  part,
  compact,
}: {
  part: SubagentLivePart;
  compact: boolean;
}) {
  switch (part.type) {
    case "reasoning":
      if (compact) {
        return (
          <div className="rounded-md bg-muted/60 px-2 py-1 text-[10px] leading-relaxed text-muted-foreground italic line-clamp-2">
            {part.text}
          </div>
        );
      }
      return (
        <details className="group rounded-md border border-border/60 bg-muted/40 px-2 py-1">
          <summary className="flex cursor-pointer items-center gap-1.5 text-[10px] font-medium text-muted-foreground list-none select-none">
            <ChevronDown
              size={11}
              className="transition-transform group-open:rotate-180"
            />
            Reasoning
          </summary>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {part.text}
          </p>
        </details>
      );
    case "text":
      if (compact) {
        return (
          <div className="text-xs leading-relaxed text-foreground whitespace-pre-wrap line-clamp-6">
            {part.text}
          </div>
        );
      }
      return (
        <div className="aui-md text-sm leading-relaxed text-foreground">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeRaw, rehypeKatex]}
            components={{
              a: (props) => (
                <a
                  {...props}
                  className="text-primary underline underline-offset-2"
                />
              ),
            }}
          >
            {part.text}
          </ReactMarkdown>
        </div>
      );
    case "file": {
      const isImage = part.mimeType?.startsWith("image/");
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <FileText size={11} className="shrink-0" />
            <span className="truncate">{part.filename}</span>
          </div>
          {!compact && isImage && part.data ? (
            <img
              src={part.data}
              alt={part.filename || "Subagent file"}
              className="max-h-48 w-auto rounded-lg border border-border/60 object-contain"
            />
          ) : null}
        </div>
      );
    }
    case "tool": {
      const isActive =
        part.state === "input-streaming" || part.state === "input-available";
      return (
        <div className="flex items-start gap-1.5 rounded-md border border-border/60 bg-background px-2 py-1">
          {isActive ? (
            <Loader2
              size={11}
              className="mt-0.5 shrink-0 animate-spin text-primary"
            />
          ) : (
            <Check size={11} className="mt-0.5 shrink-0 text-success" />
          )}
          <div className="min-w-0">
            <span className="font-mono text-[10px] font-semibold">
              {part.name}
            </span>
            {part.argsText ? (
              <div className="truncate font-mono text-[10px] text-muted-foreground">
                {part.argsText}
              </div>
            ) : null}
          </div>
        </div>
      );
    }
  }
}

/**
 * In-thread session card. Rendered by the main chat for every
 * `spawn_subagent` tool call, it mirrors the session state in
 * `SubagentProvider`: approve/deny while pending, a compact live transcript
 * while running, the final output when done, and an "Open" action that pops
 * the full detail panel.
 */
export function SubagentToolCard(props: ToolCallMessagePartProps) {
  const { toolCallId, args, result } = props;
  const { sessions, runs, openSession, approve, deny, dismiss } =
    useSubagent();
  const session = sessions.find((s) => s.toolCallId === toolCallId);
  const task =
    (session?.task ??
      (typeof args === "object" &&
      args !== null &&
      "task" in args &&
      typeof (args as { task?: unknown }).task === "string"
        ? (args as { task: string }).task.trim()
        : "")) || "Subagent subtask";
  const run = session ? runs[session.id] : undefined;
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (
      !session ||
      session.status === "awaiting-approval" ||
      session.status === "running"
    ) {
      setExpanded(true);
    }
  }, [session?.status]);

  if (!session) {
    // A restored/older message whose session no longer lives in this mount.
    const output = typeof result === "string" ? result : "";
    return (
      <div className="my-1 overflow-hidden rounded-xl border border-border/80 bg-background shadow-sm">
        <div className="flex items-center gap-2 px-3 py-2">
          <ShieldCheck size={14} className="shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-xs font-semibold">
            Subagent
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            Done
          </span>
        </div>
        <div className="border-t border-border/60 px-3 py-2">
          <p className="line-clamp-3 text-[11px] leading-relaxed text-foreground whitespace-pre-wrap">
            {task}
          </p>
          {output ? (
            <p className="mt-1.5 line-clamp-3 text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {output}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  const Icon = statusIcon(session.status);
  const terminal = isTerminal(session.status);

  return (
    <div className="my-1 overflow-hidden rounded-xl border border-border/80 bg-background shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => openSession(session.id)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none hover:opacity-80"
          title="Open subagent panel"
        >
          <Icon
            size={14}
            className={cn(
              "shrink-0",
              cnStatus(session.status),
              session.status === "running" && "animate-spin",
            )}
          />
          <span className="min-w-0 flex-1 truncate text-xs font-semibold">
            Subagent
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {STATUS_LABEL[session.status]}
          </span>
        </button>
        <button
          type="button"
          onClick={() => openSession(session.id)}
          className="shrink-0 rounded-md border border-border/70 bg-muted/40 px-1.5 py-1 text-[10px] font-medium text-foreground outline-none transition-colors hover:bg-accent"
          title="Open panel"
        >
          <ArrowUpRight size={12} />
        </button>
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="shrink-0 text-muted-foreground outline-none hover:text-foreground"
          aria-expanded={expanded}
          title={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </button>
      </div>

      {expanded ? (
        <div className="border-t border-border/60 px-3 py-2">
          <p className="mb-2 line-clamp-4 text-[11px] leading-relaxed text-foreground whitespace-pre-wrap">
            {session.task}
          </p>

          {session.status === "awaiting-approval" ? (
            <>
              <p className="mb-2 text-[10px] text-muted-foreground">
                You approve each subagent before it runs. Up to{" "}
                {MAX_ACTIVE_SUBAGENTS} can run at the same time.
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
                  Approve & run
                </button>
              </div>
            </>
          ) : null}

          {session.status === "running" ? (
            run ? (
              <SubagentActivity run={run} compact />
            ) : (
              <div className="flex items-center gap-1.5 px-1 py-0.5 text-[10px] text-muted-foreground">
                <Loader2 size={11} className="animate-spin" />
                Starting…
              </div>
            )
          ) : null}

          {session.status === "complete" && session.output ? (
            <div className="max-h-44 overflow-y-auto rounded-lg bg-muted/50 px-2 py-1.5 text-[11px] leading-relaxed text-foreground whitespace-pre-wrap">
              {session.output}
            </div>
          ) : null}

          {session.status === "error" && session.error ? (
            <p className="text-[11px] leading-relaxed text-destructive">
              {session.error}
            </p>
          ) : null}

          {session.status === "limit" && session.error ? (
            <p className="text-[11px] leading-relaxed text-warning">
              {session.error}
            </p>
          ) : null}

          {session.status === "declined" ? (
            <p className="text-[11px] text-muted-foreground">
              The main model was told the subagent was declined.
            </p>
          ) : null}

          {terminal ? (
            <div className="mt-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => openSession(session.id)}
                className="flex-1 rounded-lg bg-primary px-2 py-1.5 text-[11px] font-semibold text-primary-foreground outline-none hover:bg-primary/90"
              >
                Open panel
              </button>
              <button
                type="button"
                onClick={() => dismiss(session.id)}
                className="rounded-lg border border-border px-2 py-1.5 text-[11px] font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground"
              >
                Dismiss
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Detail panel — a chat-style popup showing exactly what one subagent is
 * doing: its task, live reasoning, tool calls, files, and final answer, plus
 * the artifacts it created in Canvas.
 */
function SubagentDetailDialog() {
  const { activeSessionId, sessions, runs, closePanel, approve, deny, dismiss } =
    useSubagent();
  const { artifacts, setActiveArtifactId, openCanvas } = useCanvas();
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);

  const session = sessions.find((s) => s.id === activeSessionId);
  const run = session ? runs[session.id] : undefined;
  const runArtifacts =
    run?.artifactIds
      .map((id) => artifacts.find((a) => a.id === id))
      .filter((a): a is NonNullable<typeof a> => Boolean(a)) ?? [];
  const partsLength = run ? run.parts.length : 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !pinnedRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [partsLength, run?.status]);

  if (!session) return null;

  const Icon = statusIcon(session.status);

  return (
    <Dialog open onOpenChange={(open) => !open && closePanel()}>
      <DialogContent className="h-[min(84vh,52rem)] max-w-[calc(100%-2rem)] gap-0 overflow-hidden p-0 sm:max-w-[46rem]">
        <div className="flex h-full flex-col">
          <DialogHeader className="shrink-0 gap-1 border-b border-border/70 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
                <Icon
                  size={14}
                  className={cn(
                    "shrink-0",
                    cnStatus(session.status),
                    session.status === "running" && "animate-spin",
                  )}
                />
                <span>Subagent — {STATUS_LABEL[session.status]}</span>
              </DialogTitle>
              {isTerminal(session.status) ? (
                <button
                  type="button"
                  onClick={() => dismiss(session.id)}
                  className="shrink-0 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground"
                >
                  Dismiss
                </button>
              ) : null}
            </div>
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {session.task}
            </p>
          </DialogHeader>

          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
            onScroll={(event) => {
              const el = event.currentTarget;
              pinnedRef.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 24;
            }}
          >
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-xl bg-muted px-3 py-2 text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                {session.task}
              </div>
            </div>

            {session.status === "awaiting-approval" ? (
              <div className="mt-3 flex flex-col items-start gap-2">
                <p className="text-xs text-muted-foreground">
                  Approve this subagent to start, or deny it. It runs
                  unprompted and reports back to the main model.
                </p>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => deny(session.id)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground"
                  >
                    Deny
                  </button>
                  <button
                    type="button"
                    onClick={() => approve(session.id)}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground outline-none hover:bg-primary/90"
                  >
                    Approve & run
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-3 flex flex-col gap-2">
              {run ? <SubagentActivity run={run} /> : null}

              {!run && session.output ? (
                <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                  {session.output}
                </div>
              ) : null}

              {session.status === "error" && session.error ? (
                <p className="text-xs leading-relaxed text-destructive">
                  {session.error}
                </p>
              ) : null}

              {session.status === "limit" && session.error ? (
                <p className="text-xs leading-relaxed text-warning">
                  {session.error}
                </p>
              ) : null}
            </div>

            {runArtifacts.length > 0 ? (
              <div className="mt-3 rounded-lg border border-border/70 p-2">
                <p className="mb-1.5 text-[10px] font-medium text-muted-foreground">
                  Created in Canvas
                </p>
                <div className="flex flex-col gap-1">
                  {runArtifacts.map((artifact) => (
                    <div
                      key={artifact.id}
                      className="flex items-center gap-2 text-xs"
                    >
                      <FileText
                        size={12}
                        className="shrink-0 text-muted-foreground"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {artifact.filename ?? artifact.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveArtifactId(artifact.id);
                          openCanvas();
                        }}
                        className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium text-foreground outline-none hover:bg-accent"
                      >
                        Open
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-border/70 px-4 py-2">
            <p className="text-[11px] text-muted-foreground">
              {session.status === "running"
                ? "This panel shows the subagent's work live."
                : session.status === "awaiting-approval"
                  ? "Waiting for your approval."
                  : session.status === "complete"
                    ? "The subagent finished; its result was sent back to the main model."
                    : session.status === "declined"
                      ? "The subagent was declined before it started."
                      : session.status === "limit"
                        ? "The concurrent subagent limit was reached."
                        : "The subagent failed."}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
