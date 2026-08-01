"use client";

import { FolderOpen } from "@phosphor-icons/react";
import { useCanvas } from "~/lib/canvas";

export function ArtifactLauncher() {
    const { artifacts, canvasOpen, openCanvas } = useCanvas();
    if (canvasOpen || artifacts.length === 0) return null;

    return (
        <button
            type="button"
            onClick={openCanvas}
            className="fixed right-4 bottom-4 z-50 inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card/95 px-3 text-xs font-semibold text-foreground shadow-lg backdrop-blur transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label={`Open ${artifacts.length} saved artifact${artifacts.length === 1 ? "" : "s"}`}
        >
            <FolderOpen size={15} weight="duotone" />
            <span>Artifacts</span>
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                {artifacts.length}
            </span>
        </button>
    );
}
