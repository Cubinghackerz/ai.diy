import { useEffect, useRef, useState } from "react";
import {
    ArrowUp,
    CaretDown,
    ChatCircle,
    Check,
    Database,
    FileCsv,
    ImageSquare,
    Pause,
    Play,
    Plus,
    Terminal,
} from "@phosphor-icons/react";
import { cn } from "~/lib/utils";
import {
    DEMO_ANSWER,
    DEMO_CHART,
    DEMO_CHIP_MS,
    DEMO_PROMPT,
    DEMO_PROVIDERS,
    FINAL_STAGE,
    FIRST_STAGE,
    nextStage,
    reached,
    stageDuration,
    typedLength,
    type DemoStage,
} from "./demo-timeline";
import { usePrefersReducedMotion } from "./hooks";
import { EASE_OUT } from "./motion";
import { StatusPill } from "./StatusPill";

const SIDEBAR_CHATS = ["Chart sales.csv by month", "Release notes draft", "Local model smoke test"];

/** One in-view, visible-tab, motion-allowed playback of the scripted stages. */
function useDemoPlayback() {
    const reduced = usePrefersReducedMotion();
    const rootRef = useRef<HTMLDivElement>(null);
    const [userPaused, setUserPaused] = useState(false);
    const [inView, setInView] = useState(false);
    const [tabVisible, setTabVisible] = useState(true);
    // The finished frame is what server HTML, no-JS and reduced-motion visitors get.
    const [stage, setStage] = useState<DemoStage>(FINAL_STAGE);
    const [chip, setChip] = useState(0);

    useEffect(() => {
        const node = rootRef.current;
        if (!node || typeof IntersectionObserver === "undefined") return;
        const observer = new IntersectionObserver(
            ([entry]) => setInView(entry?.isIntersecting ?? false),
            { threshold: 0.25 },
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const sync = () => setTabVisible(document.visibilityState !== "hidden");
        sync();
        document.addEventListener("visibilitychange", sync);
        return () => document.removeEventListener("visibilitychange", sync);
    }, []);

    const playing = !reduced && !userPaused && inView && tabVisible;

    const wasPlaying = useRef(false);
    useEffect(() => {
        if (playing && !wasPlaying.current) setStage(FIRST_STAGE);
        if (!playing && wasPlaying.current) setStage(FINAL_STAGE);
        wasPlaying.current = playing;
    }, [playing]);

    useEffect(() => {
        if (!playing) return;
        const timer = window.setTimeout(() => setStage(nextStage(stage)), stageDuration(stage));
        return () => window.clearTimeout(timer);
    }, [playing, stage]);

    useEffect(() => {
        if (stage === FIRST_STAGE) setChip(0);
        if (!playing || stage !== FINAL_STAGE) return;
        const timer = window.setInterval(
            () => setChip((value) => (value + 1) % DEMO_PROVIDERS.length),
            DEMO_CHIP_MS,
        );
        return () => window.clearInterval(timer);
    }, [playing, stage]);

    return {
        rootRef,
        stage,
        chip,
        reduced,
        paused: userPaused,
        toggle: () => setUserPaused((value) => !value),
    };
}

/** Types `text` over time while `mode` is "typing"; shows everything or nothing otherwise. */
function Typed({
    text,
    mode,
    msPerChar,
}: {
    text: string;
    mode: "hidden" | "typing" | "full";
    msPerChar: number;
}) {
    const [shown, setShown] = useState(mode === "full" ? text.length : 0);
    useEffect(() => {
        if (mode === "full") return setShown(text.length);
        if (mode === "hidden") return setShown(0);
        const startedAt = performance.now();
        setShown(0);
        const timer = window.setInterval(() => {
            const count = typedLength(text, performance.now() - startedAt, msPerChar);
            setShown(count);
            if (count >= text.length) window.clearInterval(timer);
        }, 40);
        return () => window.clearInterval(timer);
    }, [mode, text, msPerChar]);
    return <>{text.slice(0, shown)}</>;
}

/** Sample data, drawn as a plain SVG so it is crisp at any size and costs no image request. */
function SalesChart({ animate }: { animate: boolean }) {
    const [grown, setGrown] = useState(!animate);
    useEffect(() => {
        if (!animate) return;
        const frame = window.requestAnimationFrame(() => setGrown(true));
        return () => window.cancelAnimationFrame(frame);
    }, [animate]);

    const max = Math.max(...DEMO_CHART.map((bar) => bar.value));
    return (
        <figure className="m-0">
            <svg
                viewBox="0 0 240 120"
                role="img"
                aria-label="Bar chart of sample monthly sales"
                className="block h-auto w-full"
            >
                {[0.25, 0.5, 0.75, 1].map((line) => (
                    <line
                        key={line}
                        x1="0"
                        x2="240"
                        y1={100 - line * 88}
                        y2={100 - line * 88}
                        className="stroke-white/[0.08]"
                        strokeWidth="1"
                    />
                ))}
                {DEMO_CHART.map((bar, index) => {
                    const height = (bar.value / max) * 88;
                    const x = 10 + index * 38;
                    const last = index === DEMO_CHART.length - 1;
                    return (
                        <g key={bar.label}>
                            <rect
                                x={x}
                                y={100 - height}
                                width="26"
                                height={height}
                                className={last ? "fill-white" : "fill-zinc-400"}
                                style={{
                                    transformBox: "fill-box",
                                    transformOrigin: "bottom",
                                    transform: `scaleY(${grown ? 1 : 0})`,
                                    transition: `transform 600ms ${EASE_OUT} ${index * 70}ms`,
                                }}
                            />
                            <text
                                x={x + 13}
                                y="114"
                                textAnchor="middle"
                                className="fill-zinc-400 font-mono"
                                fontSize="8"
                            >
                                {bar.label}
                            </text>
                        </g>
                    );
                })}
            </svg>
            <figcaption className="mt-1 font-mono text-[10px] tracking-wide text-zinc-400">
                sales by month · sample data
            </figcaption>
        </figure>
    );
}

function FileChip({ icon, name }: { icon: "image" | "csv"; name: string }) {
    const Icon = icon === "image" ? ImageSquare : FileCsv;
    return (
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-[2px] border border-white/[0.12] bg-white/[0.04] px-2 py-1 font-mono text-[11px] text-zinc-200">
            <Icon weight="light" className="size-3.5 shrink-0" />
            <span className="truncate">{name}</span>
        </span>
    );
}

export function HeroWorkspace({ onWatchDemo }: { onWatchDemo: () => void }) {
    const { rootRef, stage, chip, reduced, paused, toggle } = useDemoPlayback();
    const composing = stage === "compose";
    const showArtifact = reached(stage, "artifact");
    const animateArtifact = stage === "artifact";

    return (
        <div
            ref={rootRef}
            role="group"
            aria-label="Preview of the ai.diy workspace"
            className="overflow-hidden rounded-[2px] border border-white/[0.1] bg-[#0a0a0a] shadow-[0_48px_120px_-48px_rgba(0,0,0,0.95)]"
        >
            <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] px-4 py-2.5">
                <span aria-hidden className="size-2 rounded-[2px] bg-zinc-700" />
                <span aria-hidden className="size-2 rounded-[2px] bg-zinc-700" />
                <span aria-hidden className="size-2 rounded-[2px] bg-zinc-700" />
                <span className="ml-3 font-mono text-[10px] tracking-wide text-zinc-400">
                    ai.diy workspace
                </span>
                <div className="ml-auto flex items-center gap-2">
                    <span className="hidden sm:inline-flex">
                        <StatusPill>Preview · sample data</StatusPill>
                    </span>
                    {reduced ? null : (
                        <button
                            type="button"
                            onClick={toggle}
                            aria-pressed={paused}
                            className="inline-flex min-h-8 items-center gap-1.5 rounded-[2px] border border-white/[0.12] bg-white/[0.04] px-2.5 font-mono text-[10px] tracking-wide text-zinc-300 transition-[background-color,border-color,color] duration-200 hover:border-white/25 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                        >
                            {paused ? (
                                <Play weight="fill" className="size-3" />
                            ) : (
                                <Pause weight="fill" className="size-3" />
                            )}
                            {paused ? "Play preview" : "Pause preview"}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onWatchDemo}
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-[2px] border border-white/[0.12] bg-white/[0.04] px-2.5 font-mono text-[10px] tracking-wide text-zinc-300 transition-[background-color,border-color,color] duration-200 hover:border-white/25 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                    >
                        <Play weight="fill" className="size-3" />
                        Watch real demo
                    </button>
                </div>
            </div>

            <p className="sr-only">
                Preview with sample data. You ask the assistant to chart a CSV. It runs Python in
                your browser tab, answers, and saves a chart and a cleaned file to Canvas. The chat
                is saved in your browser and the server stores no provider keys.
            </p>

            <div
                aria-hidden
                className="grid h-[27rem] grid-cols-1 text-left sm:h-[29rem] md:grid-cols-[13rem_minmax(0,1fr)] lg:h-[31rem] lg:grid-cols-[13rem_minmax(0,1fr)_minmax(0,19rem)]"
            >
                <aside className="hidden min-h-0 flex-col border-r border-white/[0.08] bg-[#050505] p-3 md:flex">
                    <div className="flex items-center justify-between">
                        <span className="text-[13px] font-medium text-white">ai.diy</span>
                        <span className="grid size-6 place-items-center rounded-[2px] border border-white/[0.12] text-zinc-300">
                            <Plus weight="light" className="size-3.5" />
                        </span>
                    </div>
                    <p className="mt-5 font-mono text-[10px] tracking-[0.14em] text-zinc-400">
                        CHATS
                    </p>
                    <ul className="mt-2 flex flex-col gap-0.5">
                        {SIDEBAR_CHATS.map((title, index) => (
                            <li
                                key={title}
                                className={cn(
                                    "flex items-center gap-2 truncate rounded-[2px] px-2 py-1.5 text-[12px]",
                                    index === 0 ? "bg-white/[0.07] text-white" : "text-zinc-400",
                                )}
                            >
                                <ChatCircle weight="light" className="size-3.5 shrink-0" />
                                <span className="truncate">{title}</span>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-auto flex items-center gap-2 font-mono text-[10px] text-zinc-400">
                        <span className="size-1.5 shrink-0 bg-[var(--landing-mint,#3DFFB0)]" />
                        Keys stay in this browser
                    </p>
                </aside>

                <div className="flex min-h-0 min-w-0 flex-col">
                    <div className="flex h-10 shrink-0 items-center border-b border-white/[0.08] px-4 text-[12px] font-medium text-zinc-200">
                        <span className="truncate">Chart sales.csv by month</span>
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 py-4 text-[13px] leading-relaxed">
                        {composing ? (
                            // The workspace's own empty state, so the thread is never blank while the prompt types.
                            <div className="m-auto text-center">
                                <p className="text-xl font-medium tracking-[-0.02em] text-white">
                                    ai.diy
                                </p>
                                <p className="mt-1 text-[13px] text-zinc-400">
                                    Local-first chat. Your keys stay on this device.
                                </p>
                            </div>
                        ) : null}

                        {reached(stage, "sent") ? (
                            <div className="ml-auto max-w-[85%] rounded-[2px] border border-white/[0.12] bg-white/[0.05] px-3 py-2 text-zinc-100">
                                {DEMO_PROMPT}
                            </div>
                        ) : null}

                        {reached(stage, "tool") ? (
                            <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-300">
                                <Terminal weight="light" className="size-3.5 shrink-0" />
                                <span>Ran Python in this tab</span>
                                <span className="flex items-center gap-1 text-zinc-400">
                                    {stage === "tool" ? (
                                        "running…"
                                    ) : (
                                        <>
                                            <Check
                                                weight="bold"
                                                className="size-3 text-[var(--landing-mint,#3DFFB0)]"
                                            />
                                            done
                                        </>
                                    )}
                                </span>
                            </div>
                        ) : null}

                        {reached(stage, "answer") ? (
                            <p className="max-w-[46ch] text-zinc-200">
                                <Typed
                                    text={DEMO_ANSWER}
                                    mode={stage === "answer" ? "typing" : "full"}
                                    msPerChar={22}
                                />
                            </p>
                        ) : null}

                        {showArtifact ? (
                            <>
                                <div className="flex flex-wrap gap-2">
                                    <FileChip icon="image" name="sales-by-month.png" />
                                    <FileChip icon="csv" name="sales-cleaned.csv" />
                                </div>
                                <div className="max-w-[16rem] lg:hidden">
                                    <SalesChart animate={animateArtifact} />
                                </div>
                                <p className="flex items-center gap-2 font-mono text-[10px] text-zinc-400">
                                    <Database weight="light" className="size-3.5 shrink-0" />
                                    Saved in this browser (IndexedDB) · the server stores no keys
                                </p>
                            </>
                        ) : null}
                    </div>

                    <div className="shrink-0 px-4 pb-4">
                        <div className="rounded-[2px] border border-white/[0.14] bg-[#050505] p-3">
                            <p className="min-h-5 truncate text-[13px] text-zinc-100">
                                {composing ? (
                                    <>
                                        <Typed text={DEMO_PROMPT} mode="typing" msPerChar={34} />
                                        <span className="ml-px inline-block h-3.5 w-px translate-y-0.5 bg-zinc-200" />
                                    </>
                                ) : (
                                    <span className="text-zinc-400">Message ai.diy</span>
                                )}
                            </p>
                            <div className="mt-3 flex items-center gap-2">
                                <span className="grid size-7 place-items-center rounded-[2px] border border-white/[0.12] text-zinc-300">
                                    <Plus weight="light" className="size-3.5" />
                                </span>
                                <span className="inline-flex h-7 min-w-[8.75rem] items-center justify-between gap-2 rounded-[2px] border border-white/[0.12] px-2 font-mono text-[11px] text-zinc-200">
                                    <span className="truncate">{DEMO_PROVIDERS[chip]}</span>
                                    <CaretDown weight="light" className="size-3 shrink-0" />
                                </span>
                                <span className="ml-auto grid size-7 place-items-center rounded-[2px] bg-white text-black">
                                    <ArrowUp weight="bold" className="size-3.5" />
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <aside className="hidden min-h-0 flex-col border-l border-white/[0.08] bg-[#050505] lg:flex">
                    <div className="flex h-10 shrink-0 items-center gap-1 border-b border-white/[0.08] px-3 font-mono text-[10px] tracking-[0.14em] text-zinc-400">
                        CANVAS
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
                        {showArtifact ? (
                            <>
                                <FileChip icon="image" name="sales-by-month.png" />
                                <SalesChart animate={animateArtifact} />
                            </>
                        ) : (
                            <p className="text-[12px] leading-relaxed text-zinc-400">
                                Charts, files and previews the assistant makes open here, and are
                                saved with the chat.
                            </p>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
}
