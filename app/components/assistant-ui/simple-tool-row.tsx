"use client";

import { useState } from "react";
import { CheckIcon, LoaderIcon, XIcon } from "lucide-react";
import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import {
  ToolFallback,
  ToolFallbackArgs,
  ToolFallbackResult,
  isAutoExecutedClientTool,
} from "~/components/assistant-ui/tool-fallback";
import { toolHumanLabel } from "~/components/assistant-ui/work-summary";
import { isLinuxClientTool } from "~/lib/cheerpx";
import { cn } from "~/lib/utils";

/** Tools that ask the user something or render their own card: keep the full view. */
function needsFullView(toolName: string): boolean {
  return (
    toolName === "ask_user" ||
    toolName === "npm_project" ||
    toolName === "linux_environment_skill" ||
    toolName === "spawn_subagent" ||
    toolName === "spawn_subagents" ||
    isLinuxClientTool(toolName)
  );
}

function resultFailed(result: unknown): boolean {
  if (typeof result === "string") return /^Tool .+ failed:/.test(result);
  return Boolean(
    result && typeof result === "object" && (result as { isError?: unknown }).isError === true,
  );
}

/**
 * One tool call in the Simple interface: a single plain line ("Used Discord",
 * "Ran a search") with a quiet "Details" toggle for the arguments and result.
 * The raw JSON that the full interface shows never appears unless asked for.
 * Tools that need the user (approval, ask_user) or draw their own card keep the
 * full view so nothing that needs attention is hidden.
 */
export const SimpleToolRow: ToolCallMessagePartComponent = (props) => {
  const { toolName, argsText, result, status } = props;
  const [open, setOpen] = useState(false);
  const awaitingUser = status?.type === "requires-action" && !isAutoExecutedClientTool(toolName);
  if (needsFullView(toolName) || awaitingUser) return <ToolFallback {...props} />;

  const label = toolHumanLabel(toolName, argsText);
  const running = status?.type === "running" || status?.type === "requires-action";
  const cancelled = status?.type === "incomplete" && status.reason === "cancelled";
  const failed = (status?.type === "incomplete" && !cancelled) || resultFailed(result);
  const text = running
    ? label.live
    : failed
      ? `Couldn't finish: ${label.name}`
      : cancelled
        ? `Stopped: ${label.name}`
        : label.past;
  const Icon = running ? LoaderIcon : failed || cancelled ? XIcon : CheckIcon;

  return (
    <Collapsible open={open} onOpenChange={setOpen} data-slot="simple-tool-row" className="w-full">
      <div className="flex items-center gap-2 py-0.5 text-xs text-muted-foreground">
        <Icon
          aria-hidden
          className={cn(
            "size-3 shrink-0",
            running && "animate-spin [animation-duration:0.6s]",
            failed && "text-destructive",
          )}
        />
        <span className={cn(failed && "text-destructive", cancelled && "line-through")}>
          {text}
        </span>
        {!running ? (
          <CollapsibleTrigger className="ms-1 rounded text-[11px] underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50">
            {open ? "Hide details" : "Details"}
          </CollapsibleTrigger>
        ) : null}
      </div>
      <CollapsibleContent>
        <div className="flex flex-col gap-2 ps-5 pt-1 pb-2">
          <ToolFallbackArgs argsText={argsText} toolName={toolName} />
          {!cancelled ? <ToolFallbackResult result={result} toolName={toolName} /> : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
