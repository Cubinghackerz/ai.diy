export async function initLandingAnimations(
    scope: HTMLElement | null,
): Promise<() => void> {
    if (typeof window === "undefined" || !scope) return () => {};

    // Do not even parse GSAP for reduced-motion users. CSS also disables the
    // lightweight ambient loops, leaving the authored aperture visible and still.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
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
                          entry.target.classList.toggle("landing-anim-active", entry.isIntersecting);
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
    document.addEventListener("visibilitychange", syncDocumentVisibility, { passive: true });
    syncDocumentVisibility();

    const context = gsap.context(() => {
        const heroTunnel = scope.querySelector<HTMLElement>(".hero-tunnel-layer");
        const aperture = scope.querySelector<HTMLElement>(".hero-aperture");
        if (heroTunnel) {
            gsap.timeline({ defaults: { ease: "power3.out" } })
                .fromTo(heroTunnel, { opacity: 0.18 }, { opacity: 0.92, duration: 1.4 }, 0)
                .fromTo(
                    aperture,
                    { scale: 0.96, opacity: 0.7 },
                    { scale: 1, opacity: 1, duration: 1.1 },
                    0.08,
                );
        }

        const reveal = gsap.utils.toArray<HTMLElement>("[data-landing-reveal]", scope);
        reveal.forEach((element) => {
            gsap.fromTo(
                element,
                { y: 24 },
                {
                    y: 0,
                    duration: 0.9,
                    immediateRender: false,
                    ease: "power3.out",
                    scrollTrigger: {
                        trigger: element,
                        start: "top 86%",
                        toggleActions: "play none none reverse",
                    },
                },
            );
        });

        const stack = gsap.utils.toArray<HTMLElement>("[data-stack-card]", scope);
        if (stack.length) {
            gsap.fromTo(
                stack,
                { y: 36, scale: 0.98 },
                {
                    y: 0,
                    scale: 1,
                    stagger: 0.15,
                    ease: "power2.out",
                    scrollTrigger: {
                        trigger: scope.querySelector("[data-stack]"),
                        start: "top 76%",
                        end: "bottom 54%",
                        scrub: 1,
                    },
                },
            );
        }

        const radialLines = scope.querySelectorAll<SVGLineElement>(".radial-line");
        if (radialLines.length) {
            gsap.fromTo(
                radialLines,
                { strokeDashoffset: 1 },
                {
                    strokeDashoffset: 0,
                    stagger: 0.02,
                    duration: 1.1,
                    ease: "power2.out",
                    scrollTrigger: {
                        trigger: scope.querySelector("[data-anim-gate='radial']"),
                        start: "top 70%",
                        toggleActions: "play none none reverse",
                    },
                },
            );
        }
    }, scope);

    return () => {
        observer?.disconnect();
        document.removeEventListener("visibilitychange", syncDocumentVisibility);
        context.revert();
        scope.classList.remove("landing-tab-hidden");
        gates.forEach((gate) => gate.classList.remove("landing-anim-active"));
    };
}
