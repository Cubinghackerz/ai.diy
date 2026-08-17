import {
    useLayoutEffect,
    useState,
    type CSSProperties,
    type RefObject,
} from "react";

export function useAnchoredMenu(
    open: boolean,
    triggerRef: RefObject<HTMLElement | null>,
    menuRef: RefObject<HTMLElement | null>,
    options: {
        width: number;
        maxHeight: number;
        align?: "left" | "right";
        zIndex?: number;
        gap?: number;
        padding?: number;
    },
): CSSProperties | null {
    const [style, setStyle] = useState<CSSProperties | null>(null);
    const align = options.align ?? "left";
    const gap = options.gap ?? 6;
    const padding = options.padding ?? 8;
    const zIndex = options.zIndex ?? 80;

    useLayoutEffect(() => {
        if (!open) {
            setStyle(null);
            return;
        }

        const update = () => {
            const trigger = triggerRef.current?.getBoundingClientRect();
            if (!trigger) return;
            const menu = menuRef.current?.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const width = Math.min(options.width, viewportWidth - padding * 2);
            const availableBelow = Math.max(
                0,
                viewportHeight - trigger.bottom - gap - padding,
            );
            const availableAbove = Math.max(0, trigger.top - gap - padding);
            const measuredHeight = menu?.height ?? Math.min(options.maxHeight, 320);
            const openAbove =
                availableBelow < Math.min(220, measuredHeight) &&
                availableAbove > availableBelow;
            const availableHeight = openAbove ? availableAbove : availableBelow;
            const maxHeight = Math.min(options.maxHeight, availableHeight);
            const maxLeft = Math.max(padding, viewportWidth - width - padding);
            const desiredLeft =
                align === "right" ? trigger.right - width : trigger.left;

            setStyle({
                position: "fixed",
                top: openAbove ? "auto" : trigger.bottom + gap,
                bottom: openAbove
                    ? viewportHeight - trigger.top + gap
                    : "auto",
                left: Math.min(maxLeft, Math.max(padding, desiredLeft)),
                width,
                maxHeight: Math.max(96, maxHeight),
                zIndex,
            });
        };

        update();
        const frame = window.requestAnimationFrame(update);
        const observer =
            typeof ResizeObserver === "undefined"
                ? null
                : menuRef.current
                  ? new ResizeObserver(update)
                  : null;
        if (menuRef.current) observer?.observe(menuRef.current);
        window.addEventListener("resize", update);
        window.addEventListener("scroll", update, true);
        return () => {
            window.cancelAnimationFrame(frame);
            observer?.disconnect();
            window.removeEventListener("resize", update);
            window.removeEventListener("scroll", update, true);
        };
    }, [
        align,
        gap,
        open,
        options.maxHeight,
        options.width,
        padding,
        zIndex,
        triggerRef,
        menuRef,
    ]);

    return style;
}
