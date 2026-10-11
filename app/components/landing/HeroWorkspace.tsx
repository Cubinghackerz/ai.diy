import { useEffect, useRef, useState } from "react";
import {
    ArrowUp,
    CaretDown,
    ChatCircle,
    Check,
    Brain,
    Database,
    FileCsv,
    GearSix,
    ImageSquare,
    Microphone,
    Pause,
    Play,
    Plus,
    SidebarSimple,
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
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-[4px] border border-white/[0.12] bg-white/[0.04] px-2 py-1 font-mono text-[11px] text-zinc-200">
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
            className="overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0a0a0a]"
        >
            <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] px-4 py-2.5">
                <span aria-hidden className="size-2 rounded-[4px] bg-zinc-700" />
                <span aria-hidden className="size-2 rounded-[4px] bg-zinc-700" />
                <span aria-hidden className="size-2 rounded-[4px] bg-zinc-700" />
                <span className="ml-3 font-mono text-[10px] tracking-wide text-zinc-400">
                    ai.diy workspace
                </span>
                <div className="ml-auto flex items-center gap-2">
                    <span className="hidden font-mono text-[10px] tracking-wide text-zinc-400 sm:inline">
                        Preview · sample data
                    </span>
                    {reduced ? null : (
                        <button
                            type="button"
                            onClick={toggle}
                            aria-pressed={paused}
                            className="inline-flex min-h-8 items-center gap-1.5 rounded-[4px] border border-white/[0.12] bg-white/[0.04] px-2.5 font-mono text-[10px] tracking-wide text-zinc-300 transition-[background-color,border-color,color] duration-200 hover:border-white/25 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
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
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-[4px] border border-white/[0.12] bg-white/[0.04] px-2.5 font-mono text-[10px] tracking-wide text-zinc-300 transition-[background-color,border-color,color] duration-200 hover:border-white/25 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
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
                className="grid h-[28rem] grid-cols-1 text-left sm:h-[30rem] md:grid-cols-[14.5rem_minmax(0,1fr)] lg:h-[33rem] lg:grid-cols-[14.5rem_minmax(0,1fr)_minmax(0,19rem)]"
            >
                {/* Sidebar: the real workspace's brand, tabs, actions and chat list. */}
                <aside className="hidden min-h-0 flex-col gap-3 border-r border-white/[0.08] bg-[#0c0c0c] p-3 md:flex">
                    <div className="flex items-center gap-2 px-1 pt-1">
                        <span className="text-[17px] font-semibold tracking-[-0.04em] text-white">
                            ai.diy
                        </span>
                        <span className="rounded-full border border-white/20 bg-white/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-zinc-200">
                            Beta
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1 text-[12px] font-medium">
                        <span className="flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.1] py-1.5 text-white">
                            <ChatCircle weight="regular" className="size-3.5" />
                            Chats
                        </span>
                        <span className="flex items-center justify-center gap-1.5 py-1.5 text-zinc-400">
                            <GearSix weight="regular" className="size-3.5" />
                            Settings
                        </span>
                    </div>
                    <div className="grid grid-cols-[1fr_auto] gap-1.5 text-[12px] text-zinc-200">
                        <span className="flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.1] py-2">
                            <Plus weight="regular" className="size-3.5" />
                            New Thread
                        </span>
                        <span className="flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.1] px-3 py-2">
                            <Brain weight="regular" className="size-3.5" />
                            Memory
                        </span>
                    </div>
                    <p className="mt-1 px-1 font-mono text-[10px] tracking-[0.14em] text-zinc-500">
                        CHATS
                    </p>
                    <ul className="flex flex-col gap-0.5">
                        {SIDEBAR_CHATS.map((title, index) => (
                            <li
                                key={title}
                                className={cn(
                                    "flex items-center gap-2 truncate rounded-xl px-2.5 py-2 text-[12.5px]",
                                    index === 0 ? "bg-white/[0.08] text-white" : "text-zinc-400",
                                )}
                            >
                                <ChatCircle weight="regular" className="size-3.5 shrink-0" />
                                <span className="truncate">{title}</span>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-auto flex items-center gap-2 px-1 font-mono text-[10px] text-zinc-400">
                        <span className="size-1.5 shrink-0 rounded-full bg-[var(--landing-mint,#3DFFB0)]" />
                        Keys stay in this browser
                    </p>
                </aside>

                <div className="flex min-h-0 min-w-0 flex-col bg-[#0a0a0a]">
                    <div className="flex h-11 shrink-0 items-center gap-3 border-b border-white/[0.08] px-3 text-[13px] font-semibold text-zinc-100">
                        <SidebarSimple weight="regular" className="size-[18px] text-zinc-400" />
                        <span className="truncate">Chart sales.csv by month</span>
                    </div>

                    <div className="mx-auto flex min-h-0 w-full max-w-[40rem] flex-1 flex-col gap-3 overflow-hidden px-4 py-4 text-[13px] leading-relaxed">
                        {composing ? (
                            // The workspace's own empty state, so the thread is never blank while the prompt types.
                            <div className="m-auto text-center">
                                <p className="text-3xl font-semibold tracking-[-0.03em] text-white">
                                    ai.diy
                                </p>
                                <p className="mx-auto mt-2 max-w-xs text-[13px] text-zinc-400">
                                    Your local-first workspace is ready. Ask a question, attach a
                                    file, or type / to run a skill.
                                </p>
                            </div>
                        ) : null}

                        {reached(stage, "sent") ? (
                            <div className="ml-auto max-w-[85%] rounded-2xl bg-white/[0.07] px-4 py-2 text-zinc-100">
                                {DEMO_PROMPT}
                            </div>
                        ) : null}

                        {reached(stage, "tool") ? (
                            <div className="flex w-fit items-center gap-2 rounded-lg border border-white/[0.1] px-2.5 py-1.5 font-mono text-[11px] text-zinc-300">
                                <Terminal weight="regular" className="size-3.5 shrink-0" />
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

                    {/* Composer: the full interface's rounded input with provider and model chips. */}
                    <div className="mx-auto w-full max-w-[40rem] shrink-0 px-4 pb-4">
                        <div className="rounded-3xl border border-white/[0.1] bg-[#161616] p-2.5">
                            <p className="min-h-10 truncate px-2.5 py-2 text-[14px] text-zinc-100">
                                {composing ? (
                                    <>
                                        <Typed text={DEMO_PROMPT} mode="typing" msPerChar={34} />
                                        <span className="ml-px inline-block h-4 w-px translate-y-0.5 bg-zinc-200" />
                                    </>
                                ) : (
                                    <span className="text-zinc-500">
                                        Send a message... (type / to use a command or a skill)
                                    </span>
                                )}
                            </p>
                            <div className="mt-1 flex items-center gap-1.5">
                                <span className="grid size-7 place-items-center rounded-full text-zinc-300">
                                    <Plus weight="bold" className="size-4" />
                                </span>
                                <span className="inline-flex h-7 min-w-[8.5rem] items-center justify-between gap-2 rounded-lg border border-white/[0.1] px-2 text-[11px] font-medium text-zinc-200">
                                    <span className="truncate">{DEMO_PROVIDERS[chip]}</span>
                                    <CaretDown weight="regular" className="size-3 shrink-0" />
                                </span>
                                <span className="hidden h-7 items-center gap-2 rounded-lg border border-white/[0.1] px-2 text-[11px] font-medium text-zinc-200 sm:inline-flex">
                                    GPT-6 Luna
                                    <CaretDown weight="regular" className="size-3 shrink-0" />
                                </span>
                                <span className="ml-auto grid size-7 place-items-center rounded-full text-zinc-400">
                                    <Microphone weight="regular" className="size-4" />
                                </span>
                                <span
                                    className={cn(
                                        "grid size-7 place-items-center rounded-full",
                                        composing
                                            ? "bg-white text-black"
                                            : "bg-zinc-600 text-zinc-300",
                                    )}
                                >
                                    <ArrowUp weight="bold" className="size-3.5" />
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Canvas: where charts, files and previews open, saved with the chat. */}
                <aside className="hidden min-h-0 flex-col border-l border-white/[0.08] bg-[#0c0c0c] lg:flex">
                    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-white/[0.08] px-3 text-[12px] font-semibold text-zinc-300">
                        <Database weight="regular" className="size-3.5 text-zinc-500" />
                        Canvas
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
                        {showArtifact ? (
                            <>
                                <FileChip icon="image" name="sales-by-month.png" />
                                <div className="rounded-xl border border-white/[0.08] bg-[#0a0a0a] p-3">
                                    <SalesChart animate={animateArtifact} />
                                </div>
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
