/**
 * ChatThreadSync — load/save messages per thread, surface errors, sync canvas artifacts.
 *
 * Hydrate must NEVER overwrite an in-flight send. On a fresh thread the IndexedDB
 * load resolves to [] after the user already sent — that used to call
 * setMessages([]) and erase the conversation.
 */

import {
    loadThreadUIMessages,
    replaceThreadMessages,
} from "~/lib/chat-store";
import { ARTIFACT_MARKER } from "~/lib/artifacts";
import { useCanvas, type ArtifactKind } from "~/lib/canvas";
import { useChatSession } from "~/components/assistant-ui/ChatSessionContext";
import { isToolUIPart, type UIMessage } from "ai";
import { useEffect, useRef } from "react";
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
        return { kind, title, filename, content };
    } catch {
        return null;
    }
}

export function ChatThreadSync({
    threadId,
    artifactScopeId = threadId,
}: {
    threadId: string | null;
    artifactScopeId?: string | null;
}) {
    const { chat } = useChatSession();
    const { addArtifact, setArtifactScope } = useCanvas();
    const seenArtifacts = useRef(new Set<string>());
    const restoredMessageIds = useRef(new Set<string>());
    const chatRef = useRef(chat);
    chatRef.current = chat;
    /** Thread id whose IndexedDB hydrate finished (or was safely skipped). */
    const hydratedThreadId = useRef<string | null>(null);
    const hydrateGen = useRef(0);

    // Canvas is scoped to the current chat or preview run. Switching scope
    // never leaves artifacts from a different conversation visible.
    useEffect(() => {
        setArtifactScope(artifactScopeId);
        seenArtifacts.current.clear();
        restoredMessageIds.current.clear();
    }, [artifactScopeId, setArtifactScope]);

    // Preview tabs have no IndexedDB hydrate. Treat already-streamed messages
    // as restored when a tab becomes active so reopening a tab never pops the
    // canvas unexpectedly; its tool result exposes an explicit open button.
    useEffect(() => {
        if (threadId != null) return;
        restoredMessageIds.current = new Set(
            chat.messages.map((message) => message.id),
        );
    }, [artifactScopeId, threadId]);

    // Load messages only when the active thread id changes.
    useEffect(() => {
        if (!threadId) return;

        const gen = ++hydrateGen.current;
        hydratedThreadId.current = null;
        seenArtifacts.current.clear();
        restoredMessageIds.current.clear();

        let cancelled = false;
        void loadThreadUIMessages(threadId).then((messages) => {
            if (cancelled || hydrateGen.current !== gen) return;

            const session = chatRef.current;
            const busy =
                session.status === "submitted" ||
                session.status === "streaming";

            // User already started chatting while IDB was loading — keep local state.
            if (busy) {
                hydratedThreadId.current = threadId;
                return;
            }
            if (messages.length === 0 && session.messages.length > 0) {
                hydratedThreadId.current = threadId;
                return;
            }

            restoredMessageIds.current = new Set(
                messages.map((message) => message.id),
            );
            session.setMessages(messages);
            hydratedThreadId.current = threadId;
        });

        return () => {
            cancelled = true;
        };
    }, [threadId]);

    // Persist to IndexedDB when idle (not while loading a thread switch).
    useEffect(() => {
        if (!threadId || chat.status !== "ready") return;
        if (hydratedThreadId.current !== threadId) return;
        if (chat.messages.length === 0) return;
        const timer = setTimeout(() => {
            void replaceThreadMessages(threadId, chat.messages);
        }, 400);
        return () => clearTimeout(timer);
    }, [threadId, chat.status, chat.messages]);

    // Push create_file / create_skill / frontend_design_skill results into Canvas.
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
                    typeof part === "object" &&
                    "toolName" in part &&
                    typeof part.toolName === "string"
                        ? part.toolName
                        : part.type.replace(/^tool-/, "");
                if (
                    !["create_file", "create_skill", "frontend_design_skill"].includes(
                        toolName,
                    )
                )
                    continue;
                const output = part.output;
                const resultText =
                    typeof output === "string"
                        ? output
                        : output != null
                          ? JSON.stringify(output)
                          : "";
                if (!resultText.includes(ARTIFACT_MARKER)) continue;
                const artifact = extractArtifactFromText(resultText);
                if (!artifact) continue;
                const key = `${msg.id}:${toolName}:${part.toolCallId ?? artifact.filename}`;
                if (seenArtifacts.current.has(key)) continue;
                seenArtifacts.current.add(key);
                addArtifact({
                    kind: artifact.kind,
                    title: artifact.title,
                    filename: artifact.filename,
                    content: artifact.content,
                    sourceKey: `${artifact.kind}:${artifact.filename}:${artifact.content}`,
                }, {
                    scopeId: artifactScopeId,
                    open: !restoredMessageIds.current.has(msg.id),
                });
            }
        }
    }, [chat.messages, addArtifact, artifactScopeId]);

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
