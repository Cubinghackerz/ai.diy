import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

/** A plain heading and one muted sentence. No kicker, index, or reveal effects. */
export function SectionHeader({
    id,
    title,
    children,
    className,
}: {
    id?: string;
    title: string;
    children?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("max-w-2xl", className)}>
            <h2
                id={id}
                className="text-balance text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl"
            >
                {title}
            </h2>
            {children ? (
                <p className="mt-4 text-pretty text-base leading-relaxed text-zinc-400">
                    {children}
                </p>
            ) : null}
        </div>
    );
}
