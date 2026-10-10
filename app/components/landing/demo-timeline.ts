/**
 * Script for the hero workspace preview.
 *
 * The preview is illustrative playback with sample data, not a recording. It is
 * a small state machine (one state change per stage) rather than frame-by-frame
 * React state, so it costs a handful of renders per loop. Kept free of React so
 * the timing rules can be unit tested.
 */

export const DEMO_PROMPT = "Chart sales.csv by month and save a cleaned copy.";
export const DEMO_ANSWER =
    "Done. Sales climb from January to June with a dip in April. I ran the script in this tab and saved the chart and a cleaned CSV to Canvas.";

export const DEMO_STAGES = [
    /** The prompt types into the composer. */
    { id: "compose", ms: 2600 },
    { id: "sent", ms: 700 },
    /** Python runs in the browser tab. */
    { id: "tool", ms: 1500 },
    { id: "answer", ms: 3400 },
    { id: "artifact", ms: 1900 },
    /** The finished frame; provider chips rotate while it holds. */
    { id: "hold", ms: 6000 },
] as const;

export type DemoStage = (typeof DEMO_STAGES)[number]["id"];

/** The frame shown with no JavaScript, under reduced motion, and while paused. */
export const FINAL_STAGE: DemoStage = "hold";
export const FIRST_STAGE: DemoStage = DEMO_STAGES[0].id;

export function stageIndex(stage: DemoStage): number {
    return DEMO_STAGES.findIndex((item) => item.id === stage);
}

/** True once the script has reached `stage` (so a later stage keeps earlier content visible). */
export function reached(current: DemoStage, stage: DemoStage): boolean {
    return stageIndex(current) >= stageIndex(stage);
}

export function stageDuration(stage: DemoStage): number {
    return DEMO_STAGES[stageIndex(stage)].ms;
}

/** The stage after `stage`, wrapping from the last back to the first. */
export function nextStage(stage: DemoStage): DemoStage {
    return DEMO_STAGES[(stageIndex(stage) + 1) % DEMO_STAGES.length].id;
}

/** How many characters of `text` are visible `elapsedMs` into a typing stage. */
export function typedLength(text: string, elapsedMs: number, msPerChar: number): number {
    if (elapsedMs <= 0) return 0;
    return Math.min(text.length, Math.floor(elapsedMs / msPerChar));
}

/** Providers the preview cycles through; names only, no model claims that could go stale. */
export const DEMO_PROVIDERS = [
    "ChatGPT plan",
    "Claude · your key",
    "Gemini · your key",
    "Ollama · local",
] as const;

export const DEMO_CHIP_MS = 1500;

export const DEMO_CHART = [
    { label: "Jan", value: 38 },
    { label: "Feb", value: 46 },
    { label: "Mar", value: 52 },
    { label: "Apr", value: 31 },
    { label: "May", value: 60 },
    { label: "Jun", value: 72 },
] as const;
