export async function initLandingAnimations(
    scope: HTMLElement | null,
): Promise<() => void> {
    if (typeof window === "undefined" || !scope) return () => {};

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        scope.querySelectorAll<HTMLElement>(".landing-hero-step").forEach((el) => {
            el.style.opacity = "1";
        });
        return () => {};
    }

    const [{ default: gsap }, { default: ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
    ]);
    gsap.registerPlugin(ScrollTrigger);

    const gates = Array.from(scope.querySelectorAll<HTMLElement>("[data-anim-gate]"));
    const observer =
        "IntersectionObserver" in window
            ? new IntersectionObserver(
                  (entries) => {
                      for (const entry of entries) {
                          entry.target.classList.toggle(
                              "landing-anim-active",
                              entry.isIntersecting,
                          );
                      }
                  },
                  { rootMargin: "120px 0px" },
              )
            : null;

    if (observer) {
        gates.forEach((gate) => observer.observe(gate));
    } else {
        gates.forEach((gate) => gate.classList.add("landing-anim-active"));
    }

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
                { opacity: 0, y: 12 },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.45,
                    stagger: 0.045,
                    ease: "power3.out",
                    delay: 0.05,
                },
            );
        }

        const reveal = gsap.utils.toArray<HTMLElement>("[data-landing-reveal]", scope);
        reveal.forEach((element) => {
            const inHero = Boolean(element.closest('[data-anim-gate="hero"]'));
            gsap.fromTo(
                element,
                inHero ? { opacity: 0.4, y: 8 } : { y: 16, opacity: 0.001 },
                {
                    y: 0,
                    opacity: 1,
                    duration: 0.55,
                    immediateRender: false,
                    ease: "power3.out",
                    scrollTrigger: {
                        trigger: element,
                        start: inHero ? "top 95%" : "top 88%",
                        toggleActions: "play none none none",
                    },
                },
            );
        });
    }, scope);

    return () => {
        observer?.disconnect();
        document.removeEventListener("visibilitychange", syncDocumentVisibility);
        context.revert();
        scope.classList.remove("landing-tab-hidden");
        gates.forEach((gate) => gate.classList.remove("landing-anim-active"));
    };
}
