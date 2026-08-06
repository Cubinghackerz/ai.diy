export async function initLandingAnimations(scope: HTMLElement | null): Promise<void> {
    if (typeof window === "undefined" || !scope) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [{ default: gsap }, { default: ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
    ]);
    gsap.registerPlugin(ScrollTrigger);

    if (reduceMotion) return;

    const cleanBlur = (element: HTMLElement) =>
        gsap.fromTo(
            element,
            { opacity: 0, y: 24, filter: "blur(14px)" },
            {
                opacity: 1,
                y: 0,
                filter: "blur(0px)",
                duration: 0.9,
                ease: "power3.out",
                immediateRender: false,
                scrollTrigger: {
                    trigger: element,
                    start: "top 82%",
                    once: true,
                },
            },
        );

    const revealText = gsap.utils.toArray<HTMLElement>("[data-reveal-text]", scope);
    revealText.forEach((element) => {
        const children = Array.from(element.children) as HTMLElement[];
        if (element.children.length === 0) {
            cleanBlur(element);
            return;
        }
        gsap.fromTo(
            element,
            { opacity: 0 },
            {
                opacity: 1,
                duration: 0.3,
                immediateRender: false,
                scrollTrigger: {
                    trigger: element,
                    start: "top 84%",
                    once: true,
                },
            },
        );
        children.forEach((child) => {
            cleanBlur(child);
        });
    });

    const stack = gsap.utils.toArray<HTMLElement>("[data-stack-card]", scope);
    gsap.fromTo(
        stack,
        { y: 32, opacity: 0 },
        {
            y: 0,
            opacity: 1,
            stagger: 0.1,
            ease: "power2.out",
            scrollTrigger: {
                trigger: "[data-stack]",
                start: "top 72%",
                toggleActions: "play none none reverse",
            },
        },
    );

    const svg = scope.querySelector<SVGSVGElement>("[data-diagram-svg]");
    const lines = svg ? Array.from(svg.querySelectorAll<SVGPathElement>("[data-line]")) : [];
    if (svg && lines.length) {
        lines.forEach((line) => {
            const length = line.getTotalLength();
            gsap.set(line, { strokeDasharray: length, strokeDashoffset: length });
        });
        const tl = gsap.timeline({
            delay: 0.6,
            defaults: { ease: "power1.inOut" },
            scrollTrigger: {
                trigger: scope.querySelector("[data-hero-diagram]"),
                start: "top 70%",
                toggleActions: "play none none reverse",
            },
        });
        tl.to(lines, { strokeDashoffset: 0, duration: 1.4, stagger: 0.25 });
        const nodes = svg.querySelectorAll<SVGGElement>("[data-node]");
        gsap.fromTo(
            nodes,
            { opacity: 0, scale: 0.9 },
            {
                opacity: 1,
                scale: 1,
                duration: 0.45,
                stagger: 0.12,
                delay: 0.7,
                ease: "power2.out",
            },
        );
    }
}