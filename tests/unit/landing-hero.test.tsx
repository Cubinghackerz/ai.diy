import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    DEMO_ANSWER,
    DEMO_PROMPT,
    DEMO_STAGES,
    FINAL_STAGE,
    FIRST_STAGE,
    nextStage,
    reached,
    stageDuration,
    typedLength,
} from "~/components/landing/demo-timeline";
import { HeroWorkspace } from "~/components/landing/HeroWorkspace";

describe("demo timeline", () => {
    it("runs the stages in order and loops back to the start", () => {
        expect(DEMO_STAGES.map((stage) => stage.id)).toEqual([
            "compose",
            "sent",
            "tool",
            "answer",
            "artifact",
            "hold",
        ]);
        expect(nextStage("compose")).toBe("sent");
        expect(nextStage(FINAL_STAGE)).toBe(FIRST_STAGE);
        expect(DEMO_STAGES.every((stage) => stageDuration(stage.id) > 0)).toBe(true);
    });

    it("keeps earlier content visible once a later stage is reached", () => {
        expect(reached("answer", "sent")).toBe(true);
        expect(reached("sent", "answer")).toBe(false);
        expect(reached(FINAL_STAGE, "artifact")).toBe(true);
    });

    it("types at a steady rate and never past the end", () => {
        expect(typedLength("hello", 0, 30)).toBe(0);
        expect(typedLength("hello", 65, 30)).toBe(2);
        expect(typedLength("hello", 10_000, 30)).toBe(5);
    });
});

let intersect: (visible: boolean) => void = () => undefined;
class FakeIntersectionObserver {
    constructor(callback: IntersectionObserverCallback) {
        intersect = (visible) =>
            callback(
                [{ isIntersecting: visible } as IntersectionObserverEntry],
                this as unknown as IntersectionObserver,
            );
    }
    observe() {}
    unobserve() {}
    disconnect() {}
}

beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    });
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

const advance = (ms: number) =>
    act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });

/** React flushes effects when `act` exits, so each stage's timer needs its own act. */
async function playStages(...stages: Parameters<typeof stageDuration>[0][]) {
    for (const stage of stages) await advance(stageDuration(stage) + 5);
}

describe("HeroWorkspace", () => {
    it("renders the finished frame with no playback (server HTML, no-JS, reduced motion)", () => {
        render(<HeroWorkspace onWatchDemo={() => undefined} />);

        // Real text in the DOM, not an image: the prompt, the tool run, the full answer, the files.
        expect(screen.getByText(DEMO_PROMPT)).toBeDefined();
        expect(screen.getByText("Ran Python in this tab")).toBeDefined();
        expect(screen.getByText(DEMO_ANSWER)).toBeDefined();
        expect(screen.getAllByText("sales-by-month.png").length).toBeGreaterThan(0);
        expect(screen.getByText(/Saved in this browser/)).toBeDefined();
        expect(
            screen.getByRole("group", { name: "Preview of the ai.diy workspace" }),
        ).toBeDefined();
    });

    it("says it is a preview with sample data, not a live session", () => {
        render(<HeroWorkspace onWatchDemo={() => undefined} />);
        expect(screen.getByText("Preview · sample data")).toBeDefined();
        expect(screen.queryByText("Live")).toBeNull();
    });

    it("opens the real demo from its own button", () => {
        const onWatchDemo = vi.fn();
        render(<HeroWorkspace onWatchDemo={onWatchDemo} />);
        fireEvent.click(screen.getByRole("button", { name: /Watch real demo/ }));
        expect(onWatchDemo).toHaveBeenCalledTimes(1);
    });

    it("plays from the start when scrolled into view, finishes, and loops", async () => {
        vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
        render(<HeroWorkspace onWatchDemo={() => undefined} />);
        expect(screen.getByText(DEMO_ANSWER)).toBeDefined();

        await act(async () => intersect(true));
        // Restarted: nothing has been sent yet, so the answer is gone.
        expect(screen.queryByText(DEMO_ANSWER)).toBeNull();
        expect(screen.queryByText("Ran Python in this tab")).toBeNull();

        await playStages("compose", "sent", "tool", "answer", "artifact");
        expect(screen.getByText(DEMO_ANSWER)).toBeDefined();
        expect(screen.getByText(/Saved in this browser/)).toBeDefined();

        // After the hold the script loops back to the beginning.
        await playStages("hold");
        expect(screen.queryByText(DEMO_ANSWER)).toBeNull();
    });

    it("can be paused (showing the finished frame) and replayed", async () => {
        vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
        render(<HeroWorkspace onWatchDemo={() => undefined} />);
        await act(async () => intersect(true));
        expect(screen.queryByText(DEMO_ANSWER)).toBeNull();

        const pause = screen.getByRole("button", { name: /Pause preview/ });
        fireEvent.click(pause);
        expect(screen.getByText(DEMO_ANSWER)).toBeDefined();
        expect(pause.getAttribute("aria-pressed")).toBe("true");

        // Paused means paused: time passing changes nothing.
        await advance(30_000);
        expect(screen.getByText(DEMO_ANSWER)).toBeDefined();

        fireEvent.click(screen.getByRole("button", { name: /Play preview/ }));
        expect(screen.queryByText(DEMO_ANSWER)).toBeNull();
    });

    it("stops when scrolled out of view", async () => {
        vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
        render(<HeroWorkspace onWatchDemo={() => undefined} />);
        await act(async () => intersect(true));
        expect(screen.queryByText(DEMO_ANSWER)).toBeNull();
        await act(async () => intersect(false));
        expect(screen.getByText(DEMO_ANSWER)).toBeDefined();
    });
});
