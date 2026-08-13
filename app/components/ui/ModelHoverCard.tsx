/**
 * ModelHoverCard — positioned popover showing model description, capability
 * badges, context window, and estimated pricing (from models.dev).
 */

import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
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
    placement = "auto",
}: {
    anchor: { top: number; bottom: number; left: number; right: number };
    model: MergedModelInfo;
    /** above = tooltip over trigger (composer). side = next to list rows. */
    placement?: "auto" | "above" | "side";
}) {
    const width = 288;
    const gap = 8;
    const estimatedHeight = 200;
    const spaceBelow = window.innerHeight - anchor.bottom;
    const spaceAbove = anchor.top;
    const spaceRight = window.innerWidth - anchor.right;

    const useSide =
        placement === "side" ||
        (placement === "auto" &&
            spaceRight >= width + gap &&
            spaceBelow < estimatedHeight + gap &&
            spaceAbove < estimatedHeight + gap);

    const preferAbove =
        placement === "above" ||
        (!useSide && spaceBelow < estimatedHeight + gap && spaceAbove >= spaceBelow);

    let style: CSSProperties;

    if (useSide) {
        let left = anchor.right + gap;
        if (left + width > window.innerWidth - 8) {
            left = Math.max(8, anchor.left - width - gap);
        }
        const anchorMid = (anchor.top + anchor.bottom) / 2;
        let top = anchorMid - estimatedHeight / 2;
        top = Math.max(8, Math.min(top, window.innerHeight - estimatedHeight - 8));
        style = { position: "fixed", top, left, width, zIndex: 120, pointerEvents: "none" };
    } else if (preferAbove) {
        // Anchor with `bottom` so unknown content height still sits flush above the pill.
        const bottom = Math.max(8, window.innerHeight - anchor.top + gap);
        let left = anchor.left;
        if (left + width > window.innerWidth - 8) {
            left = window.innerWidth - width - 8;
        }
        if (left < 8) left = 8;
        style = { position: "fixed", bottom, left, width, zIndex: 120, pointerEvents: "none" };
    } else {
        let top = anchor.bottom + gap;
        top = Math.max(8, Math.min(top, window.innerHeight - estimatedHeight - 8));
        let left = anchor.left;
        if (left + width > window.innerWidth - 8) {
            left = window.innerWidth - width - 8;
        }
        if (left < 8) left = 8;
        style = { position: "fixed", top, left, width, zIndex: 120, pointerEvents: "none" };
    }

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
            style={style}
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
