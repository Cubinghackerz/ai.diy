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
                  { rootMargin: "140px 0px" },
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

        // Constellation gentle rotate
        const constellation = scope.querySelector<HTMLElement>(".landing-constellation");
        if (constellation) {
            gsap.to(constellation.querySelectorAll(".landing-orbit-node"), {
                rotation: 360,
                transformOrigin: "50% 50%",
                duration: 48,
                ease: "none",
                repeat: -1,
                modifiers: {
                    // keep icons upright relative to page — rotate container instead
                },
            });
            // Prefer orbiting the whole ring via CSS-less path: subtle pulse
            gsap.to(constellation, {
                rotate: 360,
                duration: 80,
                ease: "none",
                repeat: -1,
                transformOrigin: "50% 50%",
            });
            gsap.to(constellation.querySelectorAll(".landing-orbit-node img, .landing-orbit-node"), {
                rotate: -360,
                duration: 80,
                ease: "none",
                repeat: -1,
                transformOrigin: "50% 50%",
            });
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

        const reveal = gsap.utils.toArray<HTMLElement>("[data-landing-reveal]", scope);
        reveal.forEach((element) => {
            gsap.fromTo(
                element,
                { y: 28, opacity: 0.001, filter: "blur(4px)" },
                {
                    y: 0,
                    opacity: 1,
                    filter: "blur(0px)",
                    duration: 0.75,
                    immediateRender: false,
                    ease: "power3.out",
                    clearProps: "filter",
                    scrollTrigger: {
                        trigger: element,
                        start: "top 88%",
                        toggleActions: "play none none none",
                    },
                },
            );
        });

        // Section gates fade
        gates.forEach((gate) => {
            if (gate.dataset.animGate === "hero") return;
            gsap.fromTo(
                gate,
                { opacity: 0.55 },
                {
                    opacity: 1,
                    duration: 0.5,
                    scrollTrigger: {
                        trigger: gate,
                        start: "top 85%",
                        toggleActions: "play none none reverse",
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
