import { useRef, type PointerEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowUpRight } from "@phosphor-icons/react";
import { cn } from "~/lib/utils";
import { useFinePointer, usePrefersReducedMotion } from "./hooks";
import { EASE_OUT } from "./motion";

type Common = {
    children: ReactNode;
    variant?: "primary" | "ghost" | "inverse";
    size?: "default" | "compact";
    className?: string;
    leadingIcon?: ReactNode;
};

type LandingCtaProps =
    | (Common & { to: string; href?: never; external?: false })
    | (Common & { href: string; to?: never; external?: boolean });

export function LandingCta({
    children,
    variant = "primary",
    size = "default",
    className,
    leadingIcon,
    ...rest
}: LandingCtaProps) {
    const compact = size === "compact";
    const withCircle = variant === "primary";
    const magnetRef = useRef<HTMLAnchorElement>(null);
    const reduced = usePrefersReducedMotion();
    const fine = useFinePointer();

    const pull = (event: PointerEvent<HTMLAnchorElement>) => {
        if (!fine || reduced) return;
        const el = magnetRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 8;
        const y = ((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 6;
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    };
    const release = () => {
        const el = magnetRef.current;
        if (!el) return;
        el.style.transform = "";
    };

    const classNames = cn(
        "group inline-flex items-center font-medium transition-[transform,background-color,border-color,color] duration-200 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2",
        compact ? "min-h-10 gap-2 text-[12px]" : "min-h-12 gap-2 text-[14px]",
        variant === "primary" &&
            cn(
                "rounded-full bg-white text-black hover:bg-zinc-100 focus-visible:ring-white/60",
                compact ? "py-1.5 pl-4 pr-1.5" : "py-2.5 pl-6 pr-2.5",
            ),
        variant === "ghost" &&
            cn(
                "rounded-full border border-white/20 bg-white/[0.04] px-5 text-zinc-100 hover:border-white/40 hover:bg-white/[0.1] focus-visible:ring-white/40",
                compact ? "py-1.5" : "py-2.5",
            ),
        variant === "inverse" &&
            "min-h-12 w-full justify-center gap-2 rounded-full bg-black py-3 text-[13px] text-white hover:bg-zinc-800 focus-visible:ring-black/40",
        className,
    );
    const style = { transitionTimingFunction: EASE_OUT };
    const content = (
        <>
            {leadingIcon}
            {children}
            {variant !== "ghost" ? (
                withCircle ? (
                    <span
                        className={cn(
                            "inline-flex items-center justify-center rounded-full bg-black/10 transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-0.5",
                            compact ? "size-7" : "size-8 group-hover:scale-105",
                        )}
                    >
                        <ArrowUpRight weight="bold" className="size-3.5" />
                    </span>
                ) : (
                    <ArrowUpRight
                        weight="bold"
                        className="size-3.5 transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-0.5"
                    />
                )
            ) : null}
        </>
    );

    if ("to" in rest && rest.to) {
        return (
            <Link
                ref={magnetRef}
                to={rest.to}
                reloadDocument={rest.to === "/workspace"}
                className={classNames}
                style={style}
                onPointerMove={pull}
                onPointerLeave={release}
            >
                {content}
            </Link>
        );
    }

    return (
        <a
            ref={magnetRef}
            href={rest.href}
            target={rest.external ? "_blank" : undefined}
            rel={rest.external ? "noreferrer" : undefined}
            className={classNames}
            style={style}
            onPointerMove={pull}
            onPointerLeave={release}
        >
            {content}
        </a>
    );
}
