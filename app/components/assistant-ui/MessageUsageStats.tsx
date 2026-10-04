/** Show provider-reported token totals and an approximate request cost. */

import { useAuiState } from "@assistant-ui/react";
import { getThreadMessageTokenUsage } from "@assistant-ui/react-ai-sdk";
import { lookupInCatalog, useModelCatalog } from "~/lib/model-catalog-cache";
import { estimateCost, formatCost, normalizeUsage } from "~/lib/usage";
import type { ProviderId } from "~/lib/types";

type MessageMetadataLike = {
  usage?: unknown;
  model?: unknown;
  provider?: unknown;
  custom?: { usage?: unknown; model?: unknown; provider?: unknown };
};

/** Read usage/model/provider off an assistant message, both shapes the AI SDK emits. */
export function readMessageMetadata(
  message: unknown,
): { usage?: unknown; model?: string; provider?: string } | undefined {
  if (!message || typeof message !== "object" || !("metadata" in message)) return undefined;
  const metadata = (message as { metadata?: MessageMetadataLike }).metadata;
  if (!metadata) return undefined;
  const model =
    (typeof metadata.model === "string" && metadata.model) ||
    (typeof metadata.custom?.model === "string" && metadata.custom.model) ||
    undefined;
  const provider =
    (typeof metadata.provider === "string" && metadata.provider) ||
    (typeof metadata.custom?.provider === "string" && metadata.custom?.provider) ||
    undefined;
  return {
    usage: metadata.usage ?? metadata.custom?.usage,
    model,
    provider,
  };
}

export function MessageUsageStats() {
  const catalog = useModelCatalog();
  const message = useAuiState((state) => state.message);
  const metadata = readMessageMetadata(message);
  const reportedUsage = normalizeUsage(metadata?.usage);
  const sdkUsage = getThreadMessageTokenUsage(message as { role?: string; metadata?: unknown });
  const inputTokens = reportedUsage?.inputTokens ?? sdkUsage?.inputTokens ?? 0;
  const outputTokens = reportedUsage?.outputTokens ?? sdkUsage?.outputTokens ?? 0;
  const totalTokens =
    reportedUsage?.totalTokens ??
    sdkUsage?.totalTokens ??
    (inputTokens > 0 || outputTokens > 0 ? inputTokens + outputTokens : null);
  const tokenLabel =
    totalTokens != null && totalTokens > 0 ? Math.round(totalTokens).toLocaleString("en-US") : "-";
  const model = metadata?.model;
  const providerRaw = metadata?.provider;
  const provider = (providerRaw === "chatgpt" ? "openai" : providerRaw) as ProviderId | undefined;
  const entry = model && provider ? lookupInCatalog(catalog, provider, model) : undefined;
  const costUsd =
    reportedUsage && totalTokens && totalTokens > 0 ? estimateCost(reportedUsage, entry) : null;
  const costLabel = formatCost(costUsd);

  return (
    <span
      className="ms-1 inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-border/50 bg-background/60 px-2.5 py-1 font-mono"
      aria-label={
        totalTokens != null && totalTokens > 0
          ? `Total tokens used: ${tokenLabel}${costUsd != null ? `, estimated cost ${costLabel}` : ""}.`
          : "Token usage is not available yet."
      }
      title="Provider-reported total tokens for this request, including input, output, system instructions, and tool calls when the provider supplies them."
    >
      <span className="inline-flex items-baseline gap-1">
        <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">
          tok
        </span>
        <span className="text-[10px] tabular-nums text-foreground/90">{tokenLabel}</span>
      </span>
      {costUsd != null ? (
        <>
          <span className="h-2.5 w-px shrink-0 bg-border/70" aria-hidden />
          <span className="inline-flex items-baseline gap-1">
            <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">
              est
            </span>
            <span className="text-[10px] tabular-nums text-foreground/90">{costLabel}</span>
          </span>
        </>
      ) : null}
    </span>
  );
}

/** Compact "which model answered this" badge for the message footer. */
export function MessageModelBadge() {
  const message = useAuiState((state) => state.message);
  const model = readMessageMetadata(message)?.model;
  if (!model) return null;
  return (
    <span
      data-slot="aui_assistant-message-model"
      className="inline-flex max-w-48 shrink-0 items-center truncate font-mono text-[10px] text-muted-foreground/80"
      title={`Answered by ${model}`}
    >
      {model}
    </span>
  );
}
