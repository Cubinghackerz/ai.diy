export async function initLandingAnimations(
    scope: HTMLElement | null,
): Promise<() => void> {
    if (typeof window === "undefined" || !scope) return () => {};

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        scope.querySelectorAll<HTMLElement>(".landing-hero-step").forEach((el) => {
            el.style.opacity = "1";
            el.style.transform = "none";
            el.style.filter = "none";
        });
        return () => {};
    }

    const { default: gsap } = await import("gsap");

    const syncDocumentVisibility = () => {
        scope.classList.toggle("landing-tab-hidden", document.hidden);
    };
    document.addEventListener("visibilitychange", syncDocumentVisibility, {
        passive: true,
    });
    syncDocumentVisibility();

    const context = gsap.context(() => {
        const heroSteps = gsap.utils.toArray<HTMLElement>(".landing-hero-step", scope);
        if (heroSteps.length) {
            gsap.fromTo(
                heroSteps,
                { opacity: 0, y: 18, filter: "blur(6px)" },
                {
                    opacity: 1,
                    y: 0,
                    filter: "blur(0px)",
                    duration: 0.7,
                    stagger: 0.06,
                    ease: "power3.out",
                    delay: 0.04,
                    clearProps: "filter",
                },
            );
        }

        const panel = scope.querySelector<HTMLElement>(".landing-hero-panel");
        if (panel) {
            gsap.fromTo(
                panel,
                { scale: 0.985 },
                {
                    scale: 1,
                    duration: 1.1,
                    ease: "power3.out",
                },
            );
        }

        // Floating icons on closing band
        gsap.utils.toArray<HTMLElement>(".landing-floater", scope).forEach((el, i) => {
            gsap.to(el, {
                y: i % 2 === 0 ? -10 : 10,
                duration: 2.8 + i * 0.25,
                ease: "sine.inOut",
                yoyo: true,
                repeat: -1,
            });
        });

        // Scroll reveals are owned by <Reveal>; hero and closing floaters stay here.
    }, scope);

    return () => {
        document.removeEventListener("visibilitychange", syncDocumentVisibility);
        context.revert();
        scope.classList.remove("landing-tab-hidden");
    };
}
