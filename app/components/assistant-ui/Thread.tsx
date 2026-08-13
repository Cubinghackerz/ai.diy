"use client";

import {
  ComposerAddAttachment,
  ComposerAttachments,
  ComposerAttachmentGuard,
  UserMessageAttachments,
} from "~/components/assistant-ui/attachment";
import { ComposerModelControls } from "~/components/assistant-ui/ComposerModelControls";
import { ThreadFollowupSuggestions } from "~/components/assistant-ui/follow-up-suggestions";
import { MarkdownText } from "~/components/assistant-ui/markdown-text";
import { MessageUsageStats } from "~/components/assistant-ui/MessageUsageStats";
import {
  ReasoningContent,
  ReasoningRoot,
  ReasoningText,
  ReasoningTrigger,
} from "~/components/assistant-ui/reasoning";
import { ToolFallback } from "~/components/assistant-ui/tool-fallback";
import {
  ToolGroupContent,
  ToolGroupRoot,
  ToolGroupTrigger,
} from "~/components/assistant-ui/tool-group";
import { TooltipIconButton } from "~/components/assistant-ui/tooltip-icon-button";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import {
  ActionBarMorePrimitive,
  ActionBarPrimitive,
  AuiIf,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  groupPartByType,
  MessagePrimitive,
  ThreadPrimitive,
  type ToolCallMessagePartComponent,
  unstable_useComposerInput,
  useAui,
  useAuiState,
} from "@assistant-ui/react";
import {
    ArrowDownIcon,
    ArrowUpIcon,
    CheckIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    CopyIcon,
    DownloadIcon,
    MicIcon,
    MoreHorizontalIcon,
    PencilIcon,
    RefreshCwIcon,
    SparklesIcon,
    SquareIcon,
    XIcon,
} from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ComponentType,
    type FC,
    type PropsWithChildren,
} from "react";
import { useSettings } from "~/lib/providers/SettingsProvider";
import {
    BUILTIN_FORCED_SKILLS,
    forcedSkillStore,
    skillMatchesSlashQuery,
    type ForcedSkill,
} from "~/lib/skill-command";

export type ThreadGroupPart = MessagePrimitive.GroupedParts.GroupPart;

/**
 * Optional component overrides for the thread. `AssistantMessage` and
 * `Welcome` replace whole sections; the remaining slots override how the
 * assistant message renders tool calls and part groups. Tool UIs registered
 * by name (toolkit `render`, `useAssistantDataUI`) take precedence over
 * `ToolFallback`.
 */
export type ThreadComponents = {
  AssistantMessage?: ComponentType | undefined;
  Welcome?: ComponentType | undefined;
  ToolFallback?: ToolCallMessagePartComponent | undefined;
  ToolGroup?:
    | ComponentType<PropsWithChildren<{ group: ThreadGroupPart }>>
    | undefined;
  ReasoningGroup?:
    | ComponentType<PropsWithChildren<{ group: ThreadGroupPart }>>
    | undefined;
};

export type ThreadProps = {
  components?: ThreadComponents | undefined;
  /** Preview runs render messages only; their prompt is composed elsewhere. */
  hideComposer?: boolean;
  /** Comparison columns: full width, paint immediately, hide the shared prompt bubble. */
  compact?: boolean;
};

const EMPTY_COMPONENTS: ThreadComponents = {};

const ThreadComponentsContext =
  createContext<ThreadComponents>(EMPTY_COMPONENTS);

const ThreadLayoutContext = createContext({ compact: false });

export const Thread: FC<ThreadProps> = ({
  components = EMPTY_COMPONENTS,
  hideComposer = false,
  compact = false,
}) => {
  const messageCount = useAuiState((state) => state.thread.messages.length);
  const isEmpty = messageCount === 0;

  return (
    <ThreadLayoutContext.Provider value={{ compact }}>
      <ThreadComponentsContext.Provider value={components}>
        <ThreadRoot
          isEmpty={isEmpty}
          messageCount={messageCount}
          hideComposer={hideComposer}
        />
      </ThreadComponentsContext.Provider>
    </ThreadLayoutContext.Provider>
  );
};

const ThreadRoot: FC<{
  isEmpty: boolean;
  messageCount: number;
  hideComposer: boolean;
}> = ({
  isEmpty,
  messageCount,
  hideComposer,
}) => {
  const { Welcome = ThreadWelcome } = useContext(ThreadComponentsContext);
  const { compact } = useContext(ThreadLayoutContext);
  const composerEmpty = useAuiState((s) => s.composer.isEmpty);
  const hasAssistant = useAuiState((s) =>
    s.thread.messages.some((message) => message.role === "assistant"),
  );
  const showWelcome = compact ? !hasAssistant : isEmpty;

  return (
    <ThreadPrimitive.Root
      className={cn(
        "aui-root aui-thread-root bg-background @container flex h-full flex-col",
        compact && "[&_[data-role=user]]:hidden",
      )}
      style={{
        ["--thread-max-width" as string]: compact ? "100%" : "44rem",
        ["--composer-bg" as string]:
          "color-mix(in oklab, var(--color-muted) 55%, var(--color-background))",
        ["--composer-radius" as string]: "1.25rem",
        ["--composer-padding" as string]: "10px",
      }}
    >
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        data-slot="aui_thread-viewport"
        className="relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth"
      >
        <div
          className={cn(
            "mx-auto flex w-full max-w-(--thread-max-width) flex-1 flex-col px-4 pt-4",
            compact && "px-3 pt-3",
            isEmpty && !compact && "justify-center",
          )}
        >
          {showWelcome ? <Welcome /> : null}

          <div
            data-slot="aui_message-group"
            className={cn(
              "flex flex-col gap-y-6 empty:hidden",
              hideComposer ? "pb-4" : "mb-14",
            )}
          >
            <ThreadMessages />
          </div>

          {!hideComposer ? (
            <ThreadPrimitive.ViewportFooter
              className={cn(
                "aui-thread-viewport-footer bg-background flex flex-col gap-4 overflow-visible pb-4 md:pb-6",
                !isEmpty &&
                  "sticky bottom-0 mt-auto rounded-t-(--composer-radius)",
              )}
            >
              <ThreadScrollToBottom />
              <ThreadFollowupSuggestions />
              <Composer />
              {isEmpty && composerEmpty ? <ThreadSuggestions /> : null}
            </ThreadPrimitive.ViewportFooter>
          ) : null}
        </div>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
};

/**
 * Render messages by index from a subscribed count. The count selector
 * re-renders this list as messages stream in; each MessageByIndex item
 * subscribes to its own message state for content updates.
 */
const ThreadMessages: FC = () => {
    const messageCount = useAuiState((s) => s.thread.messages.length);
    const messageComponents = useMemo(() => ({ Message: ThreadMessage }), []);

    if (messageCount === 0) return null;

    return (
        <>
            {Array.from({ length: messageCount }, (_, index) => (
                <ThreadPrimitive.MessageByIndex
                    key={`thread-message-${index}`}
                    index={index}
                    components={messageComponents}
                />
            ))}
        </>
    );
};

const ThreadMessage: FC = () => {
  const { AssistantMessage: AssistantMessageComponent = AssistantMessage } =
    useContext(ThreadComponentsContext);
  const role = useAuiState((s) => s.message.role);
  const isEditing = useAuiState((s) => s.message.composer.isEditing);

  if (isEditing) return <EditComposer />;
  if (role === "user") return <UserMessage />;
  return <AssistantMessageComponent />;
};

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom render={<TooltipIconButton tooltip="Scroll to bottom" variant="outline" className="aui-thread-scroll-to-bottom dark:border-border dark:bg-background dark:hover:bg-accent absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible" />}><ArrowDownIcon /></ThreadPrimitive.ScrollToBottom>
  );
};

const ThreadWelcome: FC = () => {
  return (
    <div className="aui-thread-welcome-root mb-8 flex flex-col items-center gap-3 px-4 text-center">
      <h1 className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-3xl font-semibold tracking-tight duration-200">
        ai.diy
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
        Your local-first workspace is ready. Ask a question, attach a file, or type <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground">/</code> to run a skill.
      </p>
    </div>
  );
};

const STARTER_PROMPTS = [
  {
    label: "Research a topic",
    prompt: "/Research Research the tradeoffs between local and hosted AI workspaces.",
  },
  {
    label: "Plan a project",
    prompt: "Help me break a project into clear, verifiable steps.",
  },
  {
    label: "Review some code",
    prompt: "Review this JavaScript for correctness, security, and maintainability: fetch(url).then((res) => res.json())",
  },
  {
    label: "Make a chart",
    prompt: "Use Python to create a simple chart from this dataset: 2, 4, 3, 7, 6, 9.",
  },
] as const;

const ThreadSuggestions: FC = () => {
  return (
    <div className="aui-thread-welcome-suggestions flex w-full flex-col items-center gap-3 px-4">
      <p className="font-mono text-[10px] tracking-wide text-muted-foreground/70">
        USE A PRESET
      </p>
      <div className="flex w-full flex-wrap items-center justify-center gap-2">
        {STARTER_PROMPTS.map((suggestion) => (
          <ThreadPrimitive.Suggestion
            key={suggestion.label}
            prompt={suggestion.prompt}
            method="replace"
            className="aui-thread-welcome-suggestion text-foreground hover:bg-muted border-border/60 h-auto rounded-full border px-3.5 py-1.5 text-sm font-normal whitespace-nowrap transition-colors"
          >
            {suggestion.label}
          </ThreadPrimitive.Suggestion>
        ))}
      </div>
    </div>
  );
};

type ComposerDraftContextValue = {
  value: string;
  setText: (value: string) => void;
  send: () => void;
  canSend: boolean;
  isRunning: boolean;
  stop: () => void;
  appliedSkills: ForcedSkill[];
  setAppliedSkills: (skills: ForcedSkill[]) => void;
};

const ComposerDraftContext = createContext<ComposerDraftContextValue | null>(
  null,
);

const useComposerDraft = () => {
  const ctx = useContext(ComposerDraftContext);
  if (!ctx) throw new Error("useComposerDraft requires Composer");
  return ctx;
};

const ComposerInput: FC = () => {
  const { value, setText, send, isRunning, appliedSkills, setAppliedSkills } =
    useComposerDraft();
  const { settings } = useSettings();
  const disabled = useAuiState(
    (s) => s.thread.isDisabled || Boolean(s.composer.dictation?.inputDisabled),
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const commandActive = value.startsWith("/");

  const skills = useMemo(() => {
    if (!commandActive) return [];
    const query = value.slice(1).trim().toLowerCase();
    const custom = settings.customSkills
      .filter((skill) => skill.enabled)
      .map((skill) => ({ name: skill.name, content: skill.content }));
    const selectedNames = new Set(
      appliedSkills.map((skill) => skill.name.toLowerCase()),
    );
    // Builtins first so Compaction / Research are not pushed off by custom skills.
    const all = [...BUILTIN_FORCED_SKILLS, ...custom].filter(
      (skill) => !selectedNames.has(skill.name.toLowerCase()),
    );
    const matches = query
      ? all.filter((skill) => skillMatchesSlashQuery(skill.name, query))
      : all;
    return matches.slice(0, 16);
  }, [appliedSkills, commandActive, settings.customSkills, value]);

  useEffect(() => {
    setMenuOpen(commandActive);
  }, [commandActive]);

  useEffect(() => {
    setHighlighted(0);
  }, [value]);

  const applySkill = (skill: ForcedSkill) => {
    if (appliedSkills.some((item) => item.name === skill.name)) return;
    const nextSkills = [...appliedSkills, skill];
    forcedSkillStore.current = nextSkills;
    setAppliedSkills(nextSkills);
    setText("");
    setMenuOpen(false);
  };

  return (
    <div className="relative">
      {menuOpen && skills.length > 0 ? (
        <div className="absolute bottom-full left-0 right-0 z-30 mb-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg">
          <p className="px-2 pb-1 pt-0.5 text-[10px] font-medium text-muted-foreground">
            Commands &amp; skills — the AI must use each selection
          </p>
          {skills.map((skill, index) => (
            <button
              key={skill.name}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                applySkill(skill);
              }}
              onMouseEnter={() => setHighlighted(index)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs outline-none ${
                highlighted === index
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }`}
            >
              <SparklesIcon size={12} className="shrink-0 text-primary" />
              <span className="truncate font-medium">{skill.name}</span>
            </button>
          ))}
        </div>
      ) : null}
      <TextareaAutosize
        name="input"
        minRows={1}
        maxRows={8}
        value={value}
        disabled={disabled}
        placeholder="Send a message... (type / to use a command or a skill)"
        className="aui-composer-input caret-foreground placeholder:text-muted-foreground/70 max-h-32 min-h-10 w-full resize-none bg-transparent px-2.5 py-1 text-base outline-none ring-0 shadow-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
        autoFocus
        enterKeyHint="send"
        aria-label="Message input"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => setMenuOpen(false)}
        onKeyDown={(e) => {
          if (menuOpen && skills.length > 0) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlighted((h) => (h + 1) % skills.length);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlighted((h) => (h - 1 + skills.length) % skills.length);
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              applySkill(skills[highlighted]);
              return;
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setMenuOpen(false);
              return;
            }
          }
          if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
          if (isRunning) return;
          e.preventDefault();
          send();
        }}
      />
      {appliedSkills.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 px-1 pt-1">
          {appliedSkills.map((skill) => (
            <span
              key={skill.name}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
            >
              <SparklesIcon size={10} />
              <span className="truncate">Skill: {skill.name}</span>
              <button
                type="button"
                aria-label={`Remove ${skill.name} skill`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const nextSkills = appliedSkills.filter(
                    (item) => item.name !== skill.name,
                  );
                  forcedSkillStore.current = nextSkills;
                  setAppliedSkills(nextSkills);
                }}
                className="ml-0.5 rounded-full p-0.5 outline-none hover:bg-primary/20"
              >
                <XIcon size={10} />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const Composer: FC = () => {
  const aui = useAui();
  const {
    value,
    setText,
    send: composerSend,
    canSend: storeCanSend,
  } = unstable_useComposerInput();
  const isRunning = useAuiState((s) => s.thread.isRunning);
  const [appliedSkills, setAppliedSkills] = useState<ForcedSkill[]>([]);

  const canSend = storeCanSend && !isRunning;

  const send = () => {
    if (!canSend) return;
    // Keep forced skills in the module store until the transport reads them.
    // Clearing here raced prepareSendMessagesRequest and dropped every skill.
    forcedSkillStore.current = appliedSkills;
    setAppliedSkills([]);
    composerSend();
  };

  const stop = () => {
    aui.thread.cancelRun();
  };

  return (
    <ComposerDraftContext.Provider
      value={{ value, setText, send, canSend, isRunning, stop, appliedSkills, setAppliedSkills }}
    >
      <ComposerPrimitive.Root
        className="aui-composer-root relative flex w-full flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          if (isRunning) return;
          send();
        }}
      >
        <div
          data-slot="aui_composer-shell"
          className="border-border/70 flex w-full flex-col gap-2 rounded-(--composer-radius) border bg-(--composer-bg) p-(--composer-padding)"
        >
          <ComposerAttachments />
          <ComposerAttachmentGuard />
          <ComposerInput />
          <ComposerAction />
        </div>
      </ComposerPrimitive.Root>
    </ComposerDraftContext.Provider>
  );
};

const ComposerSendButton: FC = () => {
  const { canSend, send, isRunning, stop } = useComposerDraft();

  if (isRunning) {
    return (
      <TooltipIconButton
        tooltip="Stop generating"
        side="bottom"
        type="button"
        variant="default"
        size="icon"
        className="aui-composer-cancel size-7 rounded-full"
        aria-label="Stop generating"
        onClick={stop}
      >
        <SquareIcon className="aui-composer-cancel-icon size-3.5 fill-current" />
      </TooltipIconButton>
    );
  }

  return (
    <TooltipIconButton
      tooltip="Send message"
      side="bottom"
      type="button"
      variant="default"
      size="icon"
      className="aui-composer-send size-7 rounded-full"
      aria-label="Send message"
      disabled={!canSend}
      onClick={send}
    >
      <ArrowUpIcon className="aui-composer-send-icon size-4.5" />
    </TooltipIconButton>
  );
};

const ComposerAction: FC = () => {
  const dictationStatus = useAuiState((s) => s.composer.dictation?.status.type);

  return (
    <div className="aui-composer-action-wrapper relative flex items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <ComposerAddAttachment />
        <ComposerModelControls />
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <AuiIf condition={(s) => s.thread.capabilities.dictation && !s.thread.isRunning}>
          <AuiIf condition={(s) => s.composer.dictation == null}>
            <ComposerPrimitive.Dictate render={<TooltipIconButton tooltip="Voice input" side="bottom" type="button" variant="ghost" size="icon" className="aui-composer-dictate size-7 rounded-full" aria-label="Start voice input" />}><MicIcon className="aui-composer-dictate-icon size-4" /></ComposerPrimitive.Dictate>
          </AuiIf>
          <AuiIf condition={(s) => s.composer.dictation != null}>
            <ComposerPrimitive.StopDictation render={<TooltipIconButton tooltip="Stop dictation" side="bottom" type="button" variant="ghost" size="icon" className="aui-composer-stop-dictation text-destructive size-7 rounded-full" aria-label="Stop voice input" />}><SquareIcon className="aui-composer-stop-dictation-icon size-3.5 animate-pulse fill-current" /></ComposerPrimitive.StopDictation>
          </AuiIf>
          <span className="sr-only" aria-live="polite">
            {dictationStatus === "starting" ? "Starting voice input" : dictationStatus === "running" ? "Listening for voice input" : ""}
          </span>
        </AuiIf>
        <ComposerSendButton />
      </div>
    </div>
  );
};

const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className="aui-message-error-root border-destructive bg-destructive/10 text-destructive dark:bg-destructive/5 mt-2 rounded-md border p-3 text-sm whitespace-pre-wrap dark:text-red-200">
        <ErrorPrimitive.Message className="aui-message-error-message" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};

const AssistantMessage: FC = () => {
  const {
    ToolFallback: ToolFallbackComponent = ToolFallback,
    ToolGroup,
    ReasoningGroup,
  } = useContext(ThreadComponentsContext);
  const { compact } = useContext(ThreadLayoutContext);

  const ACTION_BAR_PT = "pt-1.5";
  // Keep the action bar inside the contained root's paint box, then cancel its reserved space in flow.
  const ACTION_BAR_HEIGHT = `min-h-7.5 ${ACTION_BAR_PT}`;

  return (
    <MessagePrimitive.Root
      data-slot="aui_assistant-message-root"
      data-role="assistant"
      className={cn(
        "fade-in slide-in-from-bottom-1 animate-in relative -mb-7.5 pb-7.5 duration-150",
        !compact &&
          "[contain-intrinsic-size:auto_200px] [content-visibility:auto]",
      )}
    >
      <div
        data-slot="aui_assistant-message-content"
        className="text-foreground px-2 leading-relaxed wrap-break-word"
      >
        <MessagePrimitive.GroupedParts
          groupBy={groupPartByType({
            reasoning: ["group-chainOfThought", "group-reasoning"],
            "tool-call": ["group-chainOfThought", "group-tool"],
            "standalone-tool-call": [],
          })}
        >
          {({ part, children }) => {
            switch (part.type) {
              case "group-chainOfThought":
                return <div data-slot="aui_chain-of-thought">{children}</div>;
              case "group-tool":
                if (ToolGroup) {
                  return <ToolGroup group={part}>{children}</ToolGroup>;
                }
                return (
                  <ToolGroupRoot variant="ghost">
                    <ToolGroupTrigger
                      count={part.indices.length}
                      active={part.status.type === "running"}
                    />
                    <ToolGroupContent>{children}</ToolGroupContent>
                  </ToolGroupRoot>
                );
              case "group-reasoning": {
                if (ReasoningGroup) {
                  return (
                    <ReasoningGroup group={part}>{children}</ReasoningGroup>
                  );
                }
                const running = part.status.type === "running";
                return (
                  <ReasoningRoot streaming={running}>
                    <ReasoningTrigger active={running} />
                    <ReasoningContent aria-busy={running}>
                      <ReasoningText>{children}</ReasoningText>
                    </ReasoningContent>
                  </ReasoningRoot>
                );
              }
              case "text":
                return <MarkdownText />;
              case "reasoning":
                // The parent group owns the single disclosure. Rendering a
                // second ReasoningRoot here creates nested reasoning panels.
                return <MarkdownText />;
              case "tool-call":
                return part.toolUI ?? <ToolFallbackComponent {...part} />;
              case "file":
                return part.mimeType.startsWith("image/") ? (
                  <figure className="my-3 max-w-2xl overflow-hidden rounded-2xl border border-border/70 bg-muted/30 shadow-sm">
                    <img
                      src={part.data}
                      alt={part.filename || "Generated image"}
                      className="block h-auto max-h-[min(70vh,42rem)] w-full object-contain"
                      loading="lazy"
                    />
                    {part.filename ? (
                      <figcaption className="border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
                        {part.filename}
                      </figcaption>
                    ) : null}
                  </figure>
                ) : part.mimeType.startsWith("video/") ? (
                  <figure className="my-3 max-w-2xl overflow-hidden rounded-2xl border border-border/70 bg-muted/30 shadow-sm">
                    <video
                      src={part.data}
                      controls
                      playsInline
                      preload="metadata"
                      className="block max-h-[min(70vh,42rem)] w-full"
                    >
                      Your browser does not support video playback.
                    </video>
                    {part.filename ? (
                      <figcaption className="border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
                        {part.filename}
                      </figcaption>
                    ) : null}
                  </figure>
                ) : part.mimeType.startsWith("audio/") ? (
                  <audio
                    src={part.data}
                    controls
                    preload="metadata"
                    className="my-2 max-w-2xl"
                  >
                    Your browser does not support audio playback.
                  </audio>
                ) : (
                  <a
                    href={part.data}
                    download={part.filename}
                    className="my-2 inline-flex rounded-lg border border-border px-3 py-2 text-xs text-primary underline-offset-4 hover:underline"
                  >
                    {part.filename || "Download file"}
                  </a>
                );
              case "data":
                return part.dataRendererUI;
              case "indicator":
                return (
                  <span
                    data-slot="aui_assistant-message-indicator"
                    className="animate-pulse font-sans"
                    aria-label="Assistant is working"
                  >
                    {"●"}
                  </span>
                );
              default:
                return null;
            }
          }}
        </MessagePrimitive.GroupedParts>
        <MessageError />
      </div>

      <div
        data-slot="aui_assistant-message-footer"
        className={cn(
          "ms-2 flex min-h-7 flex-wrap items-center gap-1",
          ACTION_BAR_HEIGHT,
        )}
      >
        <BranchPicker />
        <AssistantActionBar />
        <MessageUsageStats />
      </div>
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-assistant-action-bar-root text-muted-foreground animate-in fade-in col-start-3 row-start-2 -ms-1 flex gap-1 duration-200"
    >
      <ActionBarPrimitive.Copy render={<TooltipIconButton tooltip="Copy" />}><AuiIf condition={(s) => s.message.isCopied}>
                      <CheckIcon className="animate-in zoom-in-50 fade-in duration-200 ease-out" />
                    </AuiIf><AuiIf condition={(s) => !s.message.isCopied}>
                      <CopyIcon className="animate-in zoom-in-75 fade-in duration-150" />
                    </AuiIf></ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload render={<TooltipIconButton tooltip="Refresh" />}><RefreshCwIcon /></ActionBarPrimitive.Reload>
      <ActionBarMorePrimitive.Root>
        <ActionBarMorePrimitive.Trigger render={<TooltipIconButton tooltip="More" className="data-[state=open]:bg-accent" />}><MoreHorizontalIcon /></ActionBarMorePrimitive.Trigger>
        <ActionBarMorePrimitive.Content
          side="bottom"
          align="start"
          sideOffset={6}
          className="aui-action-bar-more-content bg-popover/95 text-popover-foreground data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:animate-out data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] overflow-hidden rounded-xl border p-1.5 shadow-lg backdrop-blur-sm"
        >
          <ActionBarPrimitive.ExportMarkdown render={<ActionBarMorePrimitive.Item className="aui-action-bar-more-item hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none" />}><DownloadIcon className="size-4" />Export as Markdown
                              </ActionBarPrimitive.ExportMarkdown>
        </ActionBarMorePrimitive.Content>
      </ActionBarMorePrimitive.Root>
    </ActionBarPrimitive.Root>
  );
};

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root
      data-slot="aui_user-message-root"
      className="fade-in slide-in-from-bottom-1 animate-in grid auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 duration-150 [contain-intrinsic-size:auto_200px] [content-visibility:auto] [&:where(>*)]:col-start-2"
      data-role="user"
    >
      <UserMessageAttachments />

      <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
        <div className="aui-user-message-content peer bg-muted text-foreground rounded-xl px-4 py-2 wrap-break-word empty:hidden">
          <MessagePrimitive.Parts />
        </div>
        <div className="aui-user-action-bar-wrapper absolute start-0 top-1/2 -translate-x-full -translate-y-1/2 pe-2 peer-empty:hidden rtl:translate-x-full">
          <UserActionBar />
        </div>
      </div>

      <BranchPicker
        data-slot="aui_user-branch-picker"
        className="col-span-full col-start-1 row-start-3 -me-1 justify-end"
      />
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => {
  const aui = useAui();
  const isEditing = useAuiState((s) => s.composer.isEditing);

  const startEdit = () => {
    if (isEditing) return;
    try {
      aui.composer.beginEdit();
    } catch {
      // "Edit already in progress" — ignore duplicate clicks.
    }
  };

  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-user-action-bar-root flex flex-col items-end"
    >
      <ActionBarPrimitive.Copy
        render={<TooltipIconButton tooltip="Copy your message" />}
      >
        <AuiIf condition={(s) => s.message.isCopied}>
          <CheckIcon className="animate-in zoom-in-50 fade-in duration-200" />
        </AuiIf>
        <AuiIf condition={(s) => !s.message.isCopied}>
          <CopyIcon className="animate-in zoom-in-75 fade-in duration-150" />
        </AuiIf>
      </ActionBarPrimitive.Copy>
      <TooltipIconButton
        tooltip="Edit"
        className="aui-user-action-edit"
        type="button"
        disabled={isEditing}
        onClick={startEdit}
      >
        <PencilIcon />
      </TooltipIconButton>
    </ActionBarPrimitive.Root>
  );
};

const EditComposer: FC = () => {
  return (
    <MessagePrimitive.Root
      data-slot="aui_edit-composer-wrapper"
      className="flex flex-col px-2 [contain-intrinsic-size:auto_200px] [content-visibility:auto]"
    >
      <ComposerPrimitive.Root className="aui-edit-composer-root border-border/60 dark:border-muted-foreground/15 ms-auto flex w-full max-w-[85%] flex-col rounded-(--composer-radius) border bg-(--composer-bg) shadow-[0_4px_16px_-8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
        <ComposerPrimitive.Input
          className="aui-edit-composer-input text-foreground min-h-14 w-full resize-none bg-transparent px-4 pt-3 pb-1 text-base outline-none"
          autoFocus
        />
        <div className="aui-edit-composer-footer mx-2.5 mb-2.5 flex items-center gap-1.5 self-end">
          <ComposerPrimitive.Cancel render={<Button variant="ghost" size="sm" className="h-8 rounded-full px-3.5" />}>Cancel
                              </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send render={<Button size="sm" className="h-8 rounded-full px-3.5" />}>Update
                              </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  );
};

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        "aui-branch-picker-root text-muted-foreground -ms-2 me-2 inline-flex items-center text-xs",
        className,
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous render={<TooltipIconButton tooltip="Previous" />}><ChevronLeftIcon /></BranchPickerPrimitive.Previous>
      <span className="aui-branch-picker-state font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next render={<TooltipIconButton tooltip="Next" />}><ChevronRightIcon /></BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};
