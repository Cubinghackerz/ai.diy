"use client";

/**
 * Collapsed work summaries for assistant messages.
 *
 * Tool calls: one line per tool run, e.g. "Ran 4 searches" or "Built website",
 * with a spinner + live action ("Searching the web…") while tools run.
 * Clicking expands the full per-tool history.
 *
 * Reasoning: one merged card per message — full live view only while the
 * model is thinking, then a compact "Worked for 6s" line. Clicking expands
 * the full chain-of-thought text. Multiple reasoning runs never stack
 * separate cards.
 */

import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type FC,
    type ReactNode,
} from "react";
import { useAuiState, PartByIndexProvider } from "@assistant-ui/react";
import { CheckIcon, ChevronDownIcon, LoaderIcon } from "lucide-react";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { MarkdownText } from "~/components/assistant-ui/markdown-text";
import {
    ReasoningContent,
    ReasoningRoot,
    ReasoningText,
} from "~/components/assistant-ui/reasoning";
import { skillLabelForTool } from "~/lib/skill-command";
import { cn } from "~/lib/utils";

export interface ToolPartLike {
    type?: string;
    toolName?: string;
    status?: { type?: string };
    timing?: {
        startedAt: number;
        completedAt?: number;
    };
}

export interface ReasoningPartLike {
    type?: string;
    status?: { type?: string };
}

const SEARCH_PATTERN =
    /search|instant_answer|duckduckgo|brave|searxng|firecrawl.*search/i;
const FETCH_PATTERN = /fetch|read_url|scrape|web_fetch|parse|crawl|browse/i;
const IMAGE_PATTERN = /image|midjourney|dall.?e|flux/i;
const CODE_PATTERN = /python|run_code|pyodide|execute/i;

export interface ToolHumanLabel {
    /** Short noun, e.g. "Web search". */
    name: string;
    /** Present-continuous, e.g. "Searching the web…". */
    live: string;
    /** Simple past verb phrase for a single call, e.g. "Ran a search". */
    past: string;
}

/** Human-friendly label for a raw tool name. */
export function toolHumanLabel(toolName: string): ToolHumanLabel {
    const raw = toolName.trim();
    if (!raw) return { name: "Tool", live: "Running…", past: "Used a tool" };
    const skillName = skillLabelForTool(raw);
    if (SEARCH_PATTERN.test(raw)) {
        return {
            name: skillName ?? "Web search",
            live: "Searching the web…",
            past: "Ran a search",
        };
    }
    if (FETCH_PATTERN.test(raw)) {
        return {
            name: skillName ?? "Page read",
            live: "Reading a page…",
            past: "Read a page",
        };
    }
    if (raw === "research_skill") {
        return { name: "Research", live: "Researching…", past: "Researched" };
    }
    if (CODE_PATTERN.test(raw)) {
        return {
            name: skillName ?? "Python",
            live: "Running Python…",
            past: "Ran Python",
        };
    }
    if (IMAGE_PATTERN.test(raw)) {
        return {
            name: skillName ?? "Image",
            live: "Generating image…",
            past: "Generated image",
        };
    }
    if (raw === "compaction_skill") {
        return {
            name: "Compaction",
            live: "Compacting context…",
            past: "Compacted context",
        };
    }
    if (raw === "url_doctor") {
        return { name: "URL check", live: "Checking URLs…", past: "Checked URLs" };
    }
    if (raw === "connect_request") {
        return {
            name: "Connected app",
            live: "Talking to a connected app…",
            past: "Called a connected app",
        };
    }
    if (skillName) {
        return {
            name: skillName,
            live: `Using ${skillName}…`,
            past: `Used ${skillName}`,
        };
    }
    return {
        name: raw,
        live: `Running ${raw}…`,
        past: `Ran ${raw}`,
    };
}

/** Summary line for a finished run of tool calls. */
export function toolRunSummary(names: string[]): string {
    if (!names.length) return "Used tools";
    let searches = 0;
    let fetches = 0;
    const others = new Map<string, number>();
    for (const name of names) {
        if (SEARCH_PATTERN.test(name)) searches++;
        else if (FETCH_PATTERN.test(name)) fetches++;
        else {
            const key = toolHumanLabel(name).name;
            others.set(key, (others.get(key) ?? 0) + 1);
        }
    }
    const parts: string[] = [];
    if (searches > 0) parts.push(searches === 1 ? "Ran a search" : `Ran ${searches} searches`);
    if (fetches > 0) parts.push(fetches === 1 ? "Read a page" : `Read ${fetches} pages`);
    if (others.size === 1 && names.length - searches - fetches === 1) {
        const [[key]] = others;
        parts.push(`Used ${key}`);
    } else if (others.size > 0) {
        const count = names.length - searches - fetches;
        parts.push(count === 1 ? "Used a tool" : `Used ${count} tools`);
    }
    return parts.length ? parts.join(" · ") : "Used tools";
}

function formatWorkSeconds(ms: number): string {
    const seconds = ms / 1000;
    if (seconds < 1) return "<1s";
    if (seconds < 10) return `${(Math.floor(seconds * 10) / 10).toFixed(1)}s`;
    return `${Math.round(seconds)}s`;
}

function timedToolSpan(tools: ToolPartLike[]): number | null {
    const starts = tools
        .map((tool) => tool.timing?.startedAt)
        .filter((value): value is number => Number.isFinite(value));
    const ends = tools
        .map((tool) => tool.timing?.completedAt)
        .filter((value): value is number => Number.isFinite(value));
    if (!starts.length || !ends.length) return null;
    const duration = Math.max(...ends) - Math.min(...starts);
    return duration >= 0 ? duration : null;
}

/**
 * Tracks wall-clock time a group spent running, once, across start/stop
 * transitions. Returns `null` when the run finished before mount (loaded
 * messages) or never ran.
 */
function useWorkDuration(running: boolean): number | null {
    const [elapsed, setElapsed] = useState<number | null>(null);
    const startedAtRef = useRef<number | null>(null);
    const accumulatedRef = useRef(0);

    useEffect(() => {
        if (running) {
            if (startedAtRef.current == null) startedAtRef.current = Date.now();
            return;
        }
        if (startedAtRef.current == null) return;
        accumulatedRef.current += Date.now() - startedAtRef.current;
        startedAtRef.current = null;
        setElapsed(accumulatedRef.current);
    }, [running]);

    return elapsed;
}

function SummaryTrigger({
    active,
    label,
    icon,
    className,
    ref,
    ...props
}: React.ComponentProps<typeof CollapsibleTrigger> & {
    active?: boolean;
    label: ReactNode;
    icon: ReactNode;
    ref?: React.Ref<HTMLButtonElement> | undefined;
}) {
    return (
        <CollapsibleTrigger
            ref={ref}
            data-slot="work-summary-trigger"
            className={cn(
                "aui-work-summary-trigger group/trigger text-muted-foreground hover:text-foreground flex w-fit origin-left items-center gap-2 py-1.5 text-sm transition-[color,scale] active:scale-[0.98]",
                className,
            )}
            {...props}
        >
            {icon}
            <span
                data-slot="work-summary-trigger-label"
                className="aui-work-summary-trigger-label relative inline-block text-start leading-none font-normal"
            >
                <span>{label}</span>
                {active ? (
                    <span
                        aria-hidden
                        data-slot="work-summary-trigger-shimmer"
                        className="aui-work-summary-trigger-shimmer shimmer pointer-events-none absolute inset-0 motion-reduce:animate-none"
                    >
                        {label}
                    </span>
                ) : null}
            </span>
            <ChevronDownIcon
                data-slot="work-summary-trigger-chevron"
                className={cn(
                    "aui-work-summary-trigger-chevron size-3 shrink-0",
                    "transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
                    "-rotate-90",
                    "group-data-open/trigger:rotate-0",
                    "group-data-panel-open/trigger:rotate-0",
                )}
            />
        </CollapsibleTrigger>
    );
}

function SummaryContent({ children }: { children: ReactNode }) {
    return (
        <CollapsibleContent
            data-slot="work-summary-content"
            className={cn(
                "aui-work-summary-content relative overflow-hidden text-sm outline-none",
                "group/collapsible-content ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:animate-none",
                "data-closed:animate-collapsible-up",
                "data-open:animate-collapsible-down",
                "data-closed:fill-mode-forwards",
                "data-closed:pointer-events-none",
                "data-open:duration-200 data-closed:duration-200",
            )}
        >
            <div
                className={cn(
                    "flex flex-col gap-1 pt-1 pb-2 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:animate-none",
                    "group-data-open/collapsible-content:animate-in group-data-open/collapsible-content:fade-in-0 group-data-open/collapsible-content:blur-in-[2px] group-data-open/collapsible-content:slide-in-from-top-1",
                    "group-data-closed/collapsible-content:animate-out group-data-closed/collapsible-content:fade-out-0 group-data-closed/collapsible-content:blur-out-[2px] group-data-closed/collapsible-content:slide-out-to-top-1",
                )}
            >
                {children}
            </div>
        </CollapsibleContent>
    );
}

/**
 * Compact tool-run row. While tools run it shows the current 1-2 actions;
 * after completion it collapses to "Ran 4 searches · Used 2 tools" with the
 * full per-tool history behind a click.
 */
export const ToolWorkGroup: FC<{
    indices: readonly number[];
    children: ReactNode;
}> = ({ indices, children }) => {
    const parts = useAuiState((s) => s.message.parts);
    const tools = useMemo(
        () =>
            indices
                .map((index) => parts[index])
                .filter(
                    (part) =>
                        Boolean(part) &&
                        (part as ToolPartLike).type === "tool-call",
                ) as ToolPartLike[],
        [parts, indices],
    );
    const runningParts = useMemo(
        () =>
            tools.filter(
                (tool) =>
                    tool.status?.type === "running" ||
                    tool.status?.type === "requires-action",
            ),
        [tools],
    );
    const running = runningParts.length > 0;
    const liveDuration = useWorkDuration(running);
    const duration = timedToolSpan(tools) ?? liveDuration;

    const liveLabel = useMemo(() => {
        if (!running) return null;
        const labels: string[] = [];
        const seen = new Set<string>();
        for (const tool of runningParts) {
            const label = toolHumanLabel(tool.toolName ?? "").live;
            if (seen.has(label)) continue;
            seen.add(label);
            labels.push(label);
            if (labels.length === 2) break;
        }
        if (runningParts.length > labels.length) return `${runningParts.length} tools running…`;
        if (labels.length === 1) return labels[0];
        if (labels.length === 2) return `${labels[0]} · ${labels[1]}`;
        return `${runningParts.length} tools running…`;
    }, [running, runningParts]);

    const doneLabel = useMemo(
        () =>
            running
                ? null
                : toolRunSummary(
                      tools.map((tool) => tool.toolName ?? "").filter(Boolean),
                  ),
        [running, tools],
    );

    const label = liveLabel ?? doneLabel ?? "Tools";
    const durationLabel = !running && duration != null ? formatWorkSeconds(duration) : null;

    return (
        <Collapsible
            data-slot="work-summary-tool-group"
            data-running={running}
            className="aui-work-summary-tool-group w-full"
        >
            <SummaryTrigger
                active={running}
                label={
                    <>
                        <span className="text-xs font-medium">{label}</span>
                        {durationLabel ? (
                            <span className="ms-1.5 font-mono text-[10px] tabular-nums text-muted-foreground/80">
                                {durationLabel}
                            </span>
                        ) : null}
                    </>
                }
                icon={
                    running ? (
                        <LoaderIcon className="size-3 shrink-0 animate-spin [animation-duration:0.6s]" />
                    ) : (
                        <CheckIcon className="size-3 shrink-0" />
                    )
                }
            />
            <SummaryContent>{children}</SummaryContent>
        </Collapsible>
    );
};

/** One quiet disclosure for every tool call in the assistant message. */
export const ToolCallsWorkSummary: FC<{
    indices: readonly number[];
    children: ReactNode;
}> = ({ indices, children }) => {
    const parts = useAuiState((s) => s.message.parts);
    const tools = useMemo(
        () =>
            indices
                .map((index) => parts[index])
                .filter(
                    (part) =>
                        Boolean(part) &&
                        (part as ToolPartLike).type === "tool-call",
                ) as ToolPartLike[],
        [parts, indices],
    );
    const runningParts = useMemo(
        () =>
            tools.filter(
                (tool) =>
                    tool.status?.type === "running" ||
                    tool.status?.type === "requires-action",
            ),
        [tools],
    );
    const running = runningParts.length > 0;
    const liveDuration = useWorkDuration(running);
    const duration = timedToolSpan(tools) ?? liveDuration;
    const liveLabel = useMemo(() => {
        if (!running) return null;
        const active = runningParts
            .map((tool) => toolHumanLabel(tool.toolName ?? "").live)
            .filter((label, index, labels) => labels.indexOf(label) === index)
            .slice(0, 1)[0];
        return active ?? "Running tools…";
    }, [running, runningParts]);
    const durationLabel = !running && duration != null ? formatWorkSeconds(duration) : null;
    const triggerRef = useRef<HTMLButtonElement | null>(null);

    if (!tools.length) return null;

    return (
        <Collapsible
            data-slot="work-summary-tool-calls"
            data-running={running}
            className="aui-work-summary-tool-calls w-full"
            onOpenChange={(open) => {
                if (!open) return;
                // Keep the expanded section in view: streaming content must not
                // push the open row off-screen.
                window.setTimeout(() => {
                    triggerRef.current?.scrollIntoView({ block: "nearest" });
                }, 240);
            }}
        >
            <SummaryTrigger
                ref={triggerRef}
                active={running}
                label={
                    <>
                        <span className="text-xs font-medium">Tool calls</span>
                        <span className="ms-1.5 text-[11px] text-muted-foreground/80">
                            {tools.length}
                        </span>
                        {liveLabel ? (
                            <span className="ms-1.5 text-[11px] text-muted-foreground/80">
                                · {liveLabel}
                            </span>
                        ) : durationLabel ? (
                            <span className="ms-1.5 font-mono text-[10px] tabular-nums text-muted-foreground/80">
                                · {durationLabel}
                            </span>
                        ) : null}
                    </>
                }
                icon={
                    running ? (
                        <LoaderIcon className="size-3 shrink-0 animate-spin [animation-duration:0.6s]" />
                    ) : (
                        <CheckIcon className="size-3 shrink-0" />
                    )
                }
            />
            <SummaryContent>{children}</SummaryContent>
        </Collapsible>
    );
};

/**
 * Single merged reasoning card. Open with live text while the model thinks;
 * once the answer starts it collapses, staying "Working…" until the entire
 * response stops generating, then shows the full run time ("Worked for 12s").
 * Clicking expands the full chain-of-thought.
 */
export const ReasoningWorkSummary: FC<{ indices: readonly number[] }> = ({ indices }) => {
    const parts = useAuiState((s) => s.message.parts);
    const messageRunning = useAuiState((s) => s.message.status?.type === "running");
    const reasoningParts = useMemo(
        () =>
            indices
                .map((index) => parts[index])
                .filter(
                    (part) =>
                        Boolean(part) &&
                        (part as ReasoningPartLike).type === "reasoning",
                ) as ReasoningPartLike[],
        [parts, indices],
    );
    const reasoningRunning = reasoningParts.some(
        (part) => part.status?.type === "running",
    );
    // Active until the whole message (reasoning + tools + streaming answer)
    // has stopped; duration covers the entire generation.
    const running = messageRunning || reasoningRunning;
    const duration = useWorkDuration(messageRunning);
    const durationLabel =
        !messageRunning && duration != null ? formatWorkSeconds(duration) : null;
    const collapsedLabel = durationLabel ? `Worked for ${durationLabel}` : "Reasoning";

    if (!reasoningParts.length) return null;

    return (
        <ReasoningRoot streaming={running}>
            <SummaryTrigger
                active={running}
                label={
                    <span className="text-xs font-medium">
                        {running ? "Working…" : collapsedLabel}
                    </span>
                }
                icon={
                    running ? (
                        <LoaderIcon className="size-3.5 shrink-0 animate-spin [animation-duration:0.6s]" />
                    ) : (
                        <CheckIcon className="size-3.5 shrink-0" />
                    )
                }
            />
            <ReasoningContent aria-busy={running}>
                <ReasoningText>
                    {indices.map((index) => (
                        <PartByIndexProvider key={index} index={index}>
                            <MarkdownText />
                        </PartByIndexProvider>
                    ))}
                </ReasoningText>
            </ReasoningContent>
        </ReasoningRoot>
    );
};
