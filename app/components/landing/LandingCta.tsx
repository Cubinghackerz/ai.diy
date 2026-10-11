import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "~/lib/utils";

type Common = {
    children: ReactNode;
    variant?: "primary" | "ghost";
    size?: "default" | "compact";
    className?: string;
    leadingIcon?: ReactNode;
};

type LandingCtaProps =
    | (Common & { to: string; href?: never; external?: false })
    | (Common & { href: string; to?: never; external?: boolean });

/** Flat, solid buttons: a white primary and an outlined secondary. */
export function LandingCta({
    children,
    variant = "primary",
    size = "default",
    className,
    leadingIcon,
    ...rest
}: LandingCtaProps) {
    const classNames = cn(
        "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[6px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
        size === "compact" ? "h-9 px-3.5 text-[13px]" : "h-11 px-5 text-[14px]",
        variant === "primary" && "bg-white text-black hover:bg-zinc-200",
        variant === "ghost" &&
            "border border-white/[0.16] bg-transparent text-zinc-100 hover:border-white/30 hover:bg-white/[0.06]",
        className,
    );
    const content = (
        <>
            {leadingIcon}
            {children}
        </>
    );

    if ("to" in rest && rest.to) {
        return (
            <Link to={rest.to} reloadDocument={rest.to === "/workspace"} className={classNames}>
                {content}
            </Link>
        );
    }

    return (
        <a
            href={rest.href}
            target={rest.external ? "_blank" : undefined}
            rel={rest.external ? "noreferrer" : undefined}
            className={classNames}
        >
            {content}
        </a>
    );
}
