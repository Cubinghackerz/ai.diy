import { revealHeroSteps } from "~/lib/landing-reveal";

export const HERO_WATCHDOG_MS = 900;

type InitOptions = {
    /** Fired only after steps are visibly revealed, not when the module finishes loading. */
    onRevealed?: () => void;
};

function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Test-only stall: the tween is created (opacity 0) and never completed.
 * The watchdog must still reveal. Set via sessionStorage before navigation.
 */
function shouldStallHeroTween() {
    try {
        return window.sessionStorage.getItem("landing-hero-stall") === "1";
    } catch {
        return false;
    }
}

export async function initLandingAnimations(
    scope: HTMLElement | null,
    options: InitOptions = {},
): Promise<() => void> {
    if (typeof window === "undefined" || !scope) return () => {};

    let revealed = scope.dataset.heroRevealed === "1";
    const finish = () => {
        if (revealed) return;
        revealed = true;
        revealHeroSteps(scope);
        options.onRevealed?.();
    };

    if (prefersReducedMotion()) {
        finish();
        return () => {};
    }

    if (revealed) {
        options.onRevealed?.();
        return () => {};
    }

    const syncDocumentVisibility = () => {
        scope.classList.toggle("landing-tab-hidden", document.hidden);
    };
    document.addEventListener("visibilitychange", syncDocumentVisibility, {
        passive: true,
    });
    syncDocumentVisibility();

    let watchdog = 0;
    let context: { revert: () => void } | null = null;

    try {
        const { default: gsap } = await import("gsap");
        if (scope.dataset.heroRevealed === "1") {
            revealed = true;
            options.onRevealed?.();
            return () => {
                document.removeEventListener("visibilitychange", syncDocumentVisibility);
                scope.classList.remove("landing-tab-hidden");
            };
        }

        context = gsap.context(() => {
            const heroSteps = gsap.utils.toArray<HTMLElement>(".landing-hero-step", scope);
            if (!heroSteps.length) {
                finish();
                return;
            }
            const tween = gsap.fromTo(
                heroSteps,
                { opacity: 0, y: 8, filter: "blur(3px)" },
                {
                    opacity: 1,
                    y: 0,
                    filter: "blur(0px)",
                    duration: 0.5,
                    stagger: 0.04,
                    ease: "power3.out",
                    delay: 0.04,
                    clearProps: "filter",
                    onComplete: finish,
                },
            );
            if (shouldStallHeroTween()) tween.pause(0);
            watchdog = window.setTimeout(() => {
                tween.kill();
                finish();
            }, HERO_WATCHDOG_MS);
        }, scope);
    } catch {
        finish();
    }

    return () => {
        window.clearTimeout(watchdog);
        document.removeEventListener("visibilitychange", syncDocumentVisibility);
        context?.revert();
        scope.classList.remove("landing-tab-hidden");
    };
}
