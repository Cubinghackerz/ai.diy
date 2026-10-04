import { afterEach, describe, expect, it, vi } from "vitest";
import { revealHeroSteps } from "~/lib/landing-reveal";

const kill = vi.fn();
let complete: (() => void) | undefined;

vi.mock("gsap", () => ({
    default: {
        context(run: () => void) {
            run();
            return { revert() {} };
        },
        utils: {
            toArray(selector: string, scope: ParentNode) {
                return Array.from(scope.querySelectorAll(selector));
            },
        },
        fromTo(_target: unknown, _from: unknown, vars: { onComplete?: () => void }) {
            complete = vars.onComplete;
            return { kill, pause() {} };
        },
    },
}));

function mockMotion(reduce: boolean) {
    window.matchMedia = ((query: string) => ({
        matches: reduce && query.includes("reduce"),
        media: query,
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent() {
            return false;
        },
    })) as typeof window.matchMedia;
}

function mountStep() {
    const root = document.createElement("div");
    const step = document.createElement("div");
    step.className = "landing-hero-step";
    step.style.opacity = "0";
    root.append(step);
    document.body.append(root);
    return { root, step };
}

describe("landing hero reveal", () => {
    afterEach(() => {
        document.body.innerHTML = "";
        sessionStorage.clear();
        complete = undefined;
        kill.mockClear();
        vi.useRealTimers();
    });

    it("reveals immediately for reduced motion", async () => {
        mockMotion(true);
        const { root, step } = mountStep();
        const { initLandingAnimations } = await import("~/lib/landing-animations.client");
        await initLandingAnimations(root);
        expect(step.style.opacity).toBe("1");
    });

    it("reveals when the tween completes", async () => {
        mockMotion(false);
        const { root, step } = mountStep();
        const { initLandingAnimations } = await import("~/lib/landing-animations.client");
        await initLandingAnimations(root);
        expect(step.style.opacity).toBe("0");
        complete?.();
        expect(step.style.opacity).toBe("1");
    });

    it("reveals after the watchdog when the tween never completes", async () => {
        mockMotion(false);
        vi.useFakeTimers();
        sessionStorage.setItem("landing-hero-stall", "1");
        const { root, step } = mountStep();
        const { HERO_WATCHDOG_MS, initLandingAnimations } =
            await import("~/lib/landing-animations.client");
        await initLandingAnimations(root);
        expect(step.style.opacity).toBe("0");
        await vi.advanceTimersByTimeAsync(HERO_WATCHDOG_MS);
        expect(step.style.opacity).toBe("1");
        expect(kill).toHaveBeenCalled();
    });

    it("revealHeroSteps is a no-op without a scope", () => {
        expect(() => revealHeroSteps(null)).not.toThrow();
    });
});
