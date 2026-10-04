/**
 * ChatThreadSync — load/save messages per thread, surface errors, sync canvas artifacts.
 *
 * Hydrate must NEVER overwrite an in-flight send. On a fresh thread the IndexedDB
 * load resolves to [] after the user already sent — that used to call
 * setMessages([]) and erase the conversation.
 */

import { loadThreadUIMessages, replaceThreadMessages, uiMessagesToStored } from "~/lib/chat-store";
import { chatToAiDiyJson, downloadTextFile } from "~/lib/interop/exporters";
import { ARTIFACT_MARKER, type ArtifactContentEncoding } from "~/lib/artifacts";
import { useCanvas, type Artifact, type ArtifactKind } from "~/lib/canvas";
import { getArtifactsForScope } from "~/lib/db";
import { persistArtifactForScope } from "~/lib/artifact-persist.client";
import { observeStorage, reportStorageFailure } from "~/lib/storage-notices";
import { indexChatMemories } from "~/lib/memory";
import { recordUsageFromMessages } from "~/lib/usage-ledger.client";
import { useChatSession } from "~/components/assistant-ui/ChatSessionContext";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { isToolUIPart, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

function mapArtifactKind(kind: string): ArtifactKind {
  const k = kind.toLowerCase();
  if (/html|svg|preview/.test(k)) return "html";
  if (/python|py/.test(k)) return "python";
  if (/code|ts|js|css|json|md|markdown|txt/.test(k)) return "code";
  return "file";
}

function extractArtifactFromText(text: string) {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (!parsed[ARTIFACT_MARKER]) return null;
    const title = String(parsed.title ?? "Artifact");
    const filename = String(parsed.filename ?? "file.txt");
    const content = String(parsed.content ?? "");
    const kind = mapArtifactKind(String(parsed.kind ?? "file"));
    const mimeType = parsed.mimeType ? String(parsed.mimeType) : undefined;
    const contentEncoding =
      parsed.contentEncoding === "base64" || parsed.contentEncoding === "hex"
        ? (parsed.contentEncoding as ArtifactContentEncoding)
        : undefined;
    return { kind, title, filename, content, mimeType, contentEncoding };
  } catch {
    return null;
  }
}

export type SyncedArtifact = Omit<Artifact, "id" | "createdAt" | "scopeId"> & {
  sourceKey?: string;
};

export function ChatThreadSync({
  threadId,
  artifactScopeId = threadId,
  manageArtifactScope = true,
  openArtifacts = true,
  onArtifact,
}: {
  threadId: string | null;
  artifactScopeId?: string | null;
  /** Preview runs keep their artifacts in the run, not the shared Canvas scope. */
  manageArtifactScope?: boolean;
  openArtifacts?: boolean;
  onArtifact?: (artifact: SyncedArtifact) => void;
}) {
  const { chat } = useChatSession();
  const { settings } = useSettings();
  const { addArtifact, setArtifactScope } = useCanvas();
  const seenArtifacts = useRef(new Set<string>());
  const restoredMessageIds = useRef(new Set<string>());
  const chatRef = useRef(chat);
  chatRef.current = chat;
  /** Thread id whose IndexedDB hydrate finished (or was safely skipped). */
  const hydratedThreadId = useRef<string | null>(null);
  const hydrateGen = useRef(0);
  const streamingSnapshot = useRef("");
  const [hydrateEpoch, setHydrateEpoch] = useState(0);

  // Canvas is scoped to the current chat or preview run. Switching scope
  // never leaves artifacts from a different conversation visible.
  useEffect(() => {
    if (!manageArtifactScope) return;
    setArtifactScope(artifactScopeId);
    seenArtifacts.current.clear();
    restoredMessageIds.current.clear();
  }, [artifactScopeId, manageArtifactScope, setArtifactScope]);

  // Preview tabs have no IndexedDB hydrate. Treat already-streamed messages
  // as restored when a tab becomes active so reopening a tab never pops the
  // canvas unexpectedly; its tool result exposes an explicit open button.
  useEffect(() => {
    if (threadId != null) return;
    restoredMessageIds.current = new Set(chat.messages.map((message) => message.id));
  }, [artifactScopeId, threadId]);

  useEffect(() => {
    if (!threadId) return;
    let cancelled = false;
    void getArtifactsForScope(threadId)
      .then((artifacts) => {
        if (cancelled) return;
        for (const artifact of artifacts) {
          addArtifact(
            {
              kind: artifact.kind,
              title: artifact.title,
              filename: artifact.filename,
              content: artifact.content,
              mimeType: artifact.mimeType,
              contentEncoding: artifact.contentEncoding,
              language: artifact.language,
              output: artifact.output,
              sourceKey: artifact.sourceKey,
            },
            { scopeId: threadId, open: false },
          );
        }
      })
      .catch((error) => {
        if (!cancelled) reportStorageFailure(`artifacts-load:${threadId}`, "Artifact", error);
      });
    return () => {
      cancelled = true;
    };
  }, [addArtifact, threadId]);

  // Load messages only when the active thread id changes.
  useEffect(() => {
    if (!threadId) return;

    const gen = ++hydrateGen.current;
    hydratedThreadId.current = null;
    seenArtifacts.current.clear();
    restoredMessageIds.current.clear();

    let cancelled = false;
    void loadThreadUIMessages(threadId)
      .then((messages) => {
        if (cancelled || hydrateGen.current !== gen) return;

        const session = chatRef.current;
        const busy = session.status === "submitted" || session.status === "streaming";

        // User already started chatting while IDB was loading — keep local state.
        if (busy) {
          hydratedThreadId.current = threadId;
          setHydrateEpoch((epoch) => epoch + 1);
          return;
        }
        if (messages.length === 0 && session.messages.length > 0) {
          hydratedThreadId.current = threadId;
          setHydrateEpoch((epoch) => epoch + 1);
          return;
        }

        restoredMessageIds.current = new Set(messages.map((message) => message.id));
        session.setMessages(messages);
        hydratedThreadId.current = threadId;
        setHydrateEpoch((epoch) => epoch + 1);
      })
      .catch((error) => {
        if (cancelled || hydrateGen.current !== gen) return;
        reportStorageFailure(`chat-load:${threadId}`, "Chat history", error);
      });

    return () => {
      cancelled = true;
    };
  }, [threadId]);

  // Persist after hydrate. Submitted is immediate; streaming is a 2s trailing
  // throttle; ready keeps the 400ms debounce. Usage and memory stay on ready.
  useEffect(() => {
    if (!threadId || hydratedThreadId.current !== threadId || chat.messages.length === 0) return;
    const messages = chat.messages;
    const status = chat.status;
    const persist = () =>
      observeStorage(
        `chat:${threadId}`,
        "Chat",
        () =>
          replaceThreadMessages(threadId, messages, {
            model: settings.chat.model,
            provider: settings.chat.provider,
          }),
        () => {
          const stored = uiMessagesToStored(threadId, messages);
          const backup = JSON.parse(
            chatToAiDiyJson({
              thread: {
                id: threadId,
                title: "Unsaved chat",
                createdAt: Date.now(),
                updatedAt: Date.now(),
                model: settings.chat.model,
                provider: settings.chat.provider,
              },
              messages: stored,
            }),
          );
          backup.messages = stored;
          downloadTextFile(
            "ai-diy-unsaved-chat.json",
            JSON.stringify(backup, null, 2),
            "application/json",
          );
        },
      )
        .then(() => {
          window.dispatchEvent(new Event("ai-diy:chats-changed"));
        })
        .catch(() => undefined);

    if (status === "submitted") {
      void persist();
      return;
    }

    if (status === "streaming") {
      const snapshot = messages
        .map((message) => `${message.id}:${JSON.stringify(message.parts)}`)
        .join("\n");
      if (snapshot === streamingSnapshot.current) return;
      const timer = setTimeout(() => {
        streamingSnapshot.current = snapshot;
        void persist();
      }, 2000);
      return () => clearTimeout(timer);
    }

    streamingSnapshot.current = "";
    if (status !== "ready") return;
    const timer = setTimeout(() => {
      void persist();
      void recordUsageFromMessages(messages as UIMessage[], settings, "chat");
      if (settings.memoryEnabled !== false) {
        void indexChatMemories(messages as UIMessage[]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [
    threadId,
    chat.status,
    chat.messages,
    settings.chat.model,
    settings.chat.provider,
    settings.memoryEnabled,
    hydrateEpoch,
  ]);

  // Push create_file / create_skill / prompt_architect / frontend_design_skill results into Canvas.
  useEffect(() => {
    const messages = chat.messages as UIMessage[];
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      for (const part of msg.parts ?? []) {
        if (!isToolUIPart(part)) continue;
        // AI SDK v7: state is a string — only "output-available"
        // has .output populated with the tool result.
        if (part.state !== "output-available") continue;
        const toolName =
          typeof part === "object" && "toolName" in part && typeof part.toolName === "string"
            ? part.toolName
            : part.type.replace(/^tool-/, "");
        if (
          ![
            "create_file",
            "generate_file",
            "create_skill",
            "prompt_architect",
            "create_prompt",
            "frontend_design_skill",
          ].includes(toolName)
        )
          continue;
        const output = part.output;
        const resultText =
          typeof output === "string" ? output : output != null ? JSON.stringify(output) : "";
        if (!resultText.includes(ARTIFACT_MARKER)) continue;
        const artifact = extractArtifactFromText(resultText);
        if (!artifact) continue;
        const key = `${msg.id}:${toolName}:${part.toolCallId ?? artifact.filename}`;
        if (seenArtifacts.current.has(key)) continue;
        seenArtifacts.current.add(key);
        const sourceKey = `${artifact.kind}:${artifact.filename}:${artifact.contentEncoding ?? "text"}:${artifact.content}`;
        const syncedArtifact: SyncedArtifact = {
          ...artifact,
          sourceKey,
        };
        if (onArtifact) {
          onArtifact(syncedArtifact);
          continue;
        }
        const artifactId = addArtifact(syncedArtifact, {
          scopeId: artifactScopeId,
          open: openArtifacts && !restoredMessageIds.current.has(msg.id),
        });
        if (threadId) {
          persistArtifactForScope(threadId, {
            id: artifactId,
            ...syncedArtifact,
            scopeId: threadId,
            createdAt: Date.now(),
          });
        }
      }
    }
  }, [chat.messages, addArtifact, artifactScopeId, onArtifact, openArtifacts, threadId]);

  return null;
}

export function ChatErrorBanner() {
  const { chat } = useChatSession();
  const error = chat.error;
  if (!error) return null;

  return (
    <div
      role="alert"
      className="mx-auto mb-2 flex w-full max-w-(--thread-max-width) items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <span className="flex-1">{error.message}</span>
      <button
        type="button"
        onClick={() => chat.clearError()}
        className="shrink-0 rounded p-0.5 hover:bg-destructive/10"
        aria-label="Dismiss error"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
