/** Show provider-reported token totals and an approximate request cost. */

import { useAuiState } from "@assistant-ui/react";
import { getThreadMessageTokenUsage } from "@assistant-ui/react-ai-sdk";
import { lookupInCatalog, useModelCatalog } from "~/lib/model-catalog-cache";
import { estimateCost, formatCost, normalizeUsage } from "~/lib/usage";
import type { ProviderId } from "~/lib/types";

export function MessageUsageStats() {
    const catalog = useModelCatalog();
    const message = useAuiState((state) => state.message);
    const metadata =
        message && typeof message === "object" && "metadata" in message
            ? (message.metadata as {
                  usage?: unknown;
                  model?: unknown;
                  provider?: unknown;
                  custom?: { usage?: unknown; model?: unknown; provider?: unknown };
              } | undefined)
            : undefined;
    const reportedUsage =
        normalizeUsage(metadata?.usage) ?? normalizeUsage(metadata?.custom?.usage);
    const sdkUsage = getThreadMessageTokenUsage(
        message as { role?: string; metadata?: unknown },
    );
    const inputTokens = reportedUsage?.inputTokens ?? sdkUsage?.inputTokens ?? 0;
    const outputTokens = reportedUsage?.outputTokens ?? sdkUsage?.outputTokens ?? 0;
    const totalTokens =
        reportedUsage?.totalTokens ??
        sdkUsage?.totalTokens ??
        (inputTokens > 0 || outputTokens > 0 ? inputTokens + outputTokens : null);
    const tokenLabel =
        totalTokens != null && totalTokens > 0
            ? Math.round(totalTokens).toLocaleString("en-US")
            : "-";
    const model =
        (typeof metadata?.model === "string" && metadata.model) ||
        (typeof metadata?.custom?.model === "string" && metadata.custom.model) ||
        undefined;
    const providerRaw =
        (typeof metadata?.provider === "string" && metadata.provider) ||
        (typeof metadata?.custom?.provider === "string" && metadata.custom.provider) ||
        undefined;
    const provider = (providerRaw === "chatgpt" ? "openai" : providerRaw) as
        | ProviderId
        | undefined;
    const entry =
        model && provider
            ? lookupInCatalog(catalog, provider, model)
            : undefined;
    const costUsd =
        reportedUsage && totalTokens && totalTokens > 0
            ? estimateCost(reportedUsage, entry)
            : null;
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
                <span className="text-[10px] tabular-nums text-foreground/90">
                    {tokenLabel}
                </span>
            </span>
            {costUsd != null ? (
                <>
                    <span className="h-2.5 w-px shrink-0 bg-border/70" aria-hidden />
                    <span className="inline-flex items-baseline gap-1">
                        <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">
                            est
                        </span>
                        <span className="text-[10px] tabular-nums text-foreground/90">
                            {costLabel}
                        </span>
                    </span>
                </>
            ) : null}
        </span>
    );
}
