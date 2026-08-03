/**
 * ModelHoverCard — positioned popover showing model description, capability
 * badges, context window, and estimated pricing (from models.dev).
 */

import { createPortal } from "react-dom";
import {
    Brain,
    Eye,
    ImageSquare,
    ListChecks,
    SpeakerHigh,
    VideoCamera,
    Wrench,
} from "@phosphor-icons/react";
import type { MergedModelInfo } from "~/lib/model-catalog";
import {
    formatContextWindow,
    formatPricePerMillion,
} from "~/lib/model-catalog";
import { ModelLogo } from "~/components/ui/ModelLogo";
import { cn } from "~/lib/utils";

export function ModelHoverCard({
    anchor,
    model,
}: {
    anchor: { top: number; bottom: number; left: number; right: number };
    model: MergedModelInfo;
}) {
    const width = 288;
    const gap = 8;
    let left = anchor.right + gap;
    if (left + width > window.innerWidth - 8) {
        left = anchor.left - width - gap;
    }
    if (left < 8) left = 8;
    const estimatedHeight = 260;
    const top = Math.min(
        Math.max(8, anchor.top),
        Math.max(8, window.innerHeight - estimatedHeight - 8),
    );

    const badges: { label: string; icon: typeof Wrench; active: boolean }[] = [
        { label: "Tools", icon: Wrench, active: model.supportsTools === true },
        { label: "Vision", icon: Eye, active: model.supportsVision === true },
        { label: "Reasoning", icon: Brain, active: model.supportsReasoning === true },
        {
            label: "Structured output",
            icon: ListChecks,
            active: model.supportsStructuredOutputs === true,
        },
        {
            label: "Image gen",
            icon: ImageSquare,
            active: model.supportsImageGeneration === true,
        },
        {
            label: "Audio output",
            icon: SpeakerHigh,
            active: model.supportsAudio === true,
        },
        {
            label: "Video gen",
            icon: VideoCamera,
            active: model.supportsVideo === true,
        },
    ];
    const context = formatContextWindow(model.contextWindow);
    const price = formatPricePerMillion(model.catalogEntry?.cost);
    const description =
        model.description ||
        "No description available for this model.";

    return createPortal(
        <div
            role="tooltip"
            style={{
                position: "fixed",
                top,
                left,
                width,
                zIndex: 120,
                pointerEvents: "none",
            }}
            className="rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-xl shadow-black/20"
        >
            <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                    <ModelLogo
                        provider={model.provider}
                        modelId={model.id}
                        size={16}
                    />
                    <span className="truncate text-xs font-semibold">
                        {model.name || model.id}
                    </span>
                </span>
                {model.name !== model.id ? (
                    <span className="shrink-0 font-mono text-[9px] text-muted-foreground">
                        {model.id}
                    </span>
                ) : null}
            </div>
            <p className="mt-1.5 line-clamp-3 text-[11px] leading-snug text-muted-foreground">
                {description}
            </p>
            {badges.some((b) => b.active) ? (
                <div className="mt-2 flex flex-wrap gap-1">
                    {badges
                        .filter((b) => b.active)
                        .map((b) => {
                            const Icon = b.icon;
                            return (
                                <span
                                    key={b.label}
                                    className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground"
                                >
                                    <Icon size={9} weight="bold" />
                                    {b.label}
                                </span>
                            );
                        })}
                </div>
            ) : null}
            {(context || price) && (
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/70 pt-1.5 text-[10px] text-muted-foreground">
                    {context ? (
                        <span className="truncate">{context} context</span>
                    ) : (
                        <span className="truncate opacity-0">·</span>
                    )}
                    {price ? (
                        <span
                            className={cn(
                                "shrink-0 font-medium",
                                context ? "text-right" : "",
                            )}
                        >
                            {price}
                        </span>
                    ) : (
                        <span className="shrink-0 italic opacity-70">
                            no public pricing
                        </span>
                    )}
                </div>
            )}
        </div>,
        document.body,
    );
}
