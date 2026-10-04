/** Force hero entrance steps to their visible final state. Safe during SSR (no-op). */
export function revealHeroSteps(scope: ParentNode | null) {
    if (!scope || typeof document === "undefined") return;
    scope.querySelectorAll<HTMLElement>(".landing-hero-step").forEach((el) => {
        el.style.opacity = "1";
        el.style.transform = "none";
        el.style.filter = "none";
    });
    if (scope instanceof HTMLElement) scope.dataset.heroRevealed = "1";
}
