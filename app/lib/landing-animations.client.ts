export async function initLandingAnimations(scope: HTMLElement | null): Promise<void> {
    if (typeof window === "undefined" || !scope) return;
    const [{ default: gsap }, { default: ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
    ]);
    gsap.registerPlugin(ScrollTrigger);

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
    gsap.fromTo(
        stack,
        { y: 36, scale: 0.98 },
        {
            y: 0,
            scale: 1,
            stagger: 0.15,
            ease: "power2.out",
            scrollTrigger: {
                trigger: "[data-stack]",
                start: "top 76%",
                end: "bottom 54%",
                scrub: 1,
            },
        },
    );
}
