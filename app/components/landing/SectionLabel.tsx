import { cn } from "~/lib/utils";

/** Mono index kicker ("01 / OWNERSHIP") that anchors each section to the hairline grid. */
export function SectionLabel({
    index,
    children,
    className,
}: {
    index: string;
    children: string;
    className?: string;
}) {
    return (
        <p
            className={cn(
                "mb-5 flex items-center gap-2.5 font-mono text-[10px] tracking-[0.16em] text-zinc-500",
                className,
            )}
        >
            <span aria-hidden className="size-1.5 bg-[var(--landing-mint,#3DFFB0)]" />
            <span className="text-zinc-300">{index}</span>
            <span aria-hidden className="h-px w-6 bg-white/20" />
            <span>{children.toUpperCase()}</span>
        </p>
    );
}
