import { useEffect, useMemo, useRef, useState } from "react";
import { Link, type HeadersFunction } from "react-router";
import { cn } from "~/lib/utils";
import { useSettings } from "~/lib/providers/SettingsProvider";
import type { ProviderId } from "~/lib/types";
import { ModelLogo } from "~/components/ui/ModelLogo";
import LightTunnel from "~/components/landing/LightTunnel";
import {
    ArrowRight,
    ArrowUpRight,
    Brain,
    Check,
    Code,
    Command,
    Lightning,
    List,
    LockKey,
    Moon,
    PlugsConnected,
    Sun,
    X,
} from "@phosphor-icons/react";

const ACCORDION_ITEMS = [
    {
        title: "Your keys, your call",
        body: "Bring provider credentials you control. They stay in this browser and connect directly to the model endpoint you choose.",
        icon: LockKey,
    },
    {
        title: "A workspace that remembers",
        body: "Chats, projects, artifacts, and local memory stay close to the work instead of disappearing into a disposable tab.",
        icon: Brain,
    },
    {
        title: "Tools when they matter",
        body: "Search, MCP connectors, code, files, and model capabilities meet in one calm surface, ready when the task needs them.",
        icon: PlugsConnected,
    },
];

const PROVIDER_NETWORK: Array<{ id: ProviderId; label: string }> = [
    { id: "openai", label: "OpenAI" },
    { id: "anthropic", label: "Anthropic" },
    { id: "gemini", label: "Google Gemini" },
    { id: "groq", label: "Groq" },
    { id: "openrouter", label: "OpenRouter" },
    { id: "deepseek", label: "DeepSeek" },
    { id: "bedrock", label: "Amazon Bedrock" },
    { id: "azure", label: "Azure OpenAI" },
    { id: "vertex", label: "Google Vertex" },
    { id: "gateway", label: "Vercel Gateway" },
    { id: "togetherai", label: "Together AI" },
    { id: "mistral", label: "Mistral" },
    { id: "huggingface", label: "Hugging Face" },
    { id: "lmstudio", label: "LM Studio" },
    { id: "xai", label: "xAI" },
    { id: "ollama", label: "Ollama" },
    { id: "custom", label: "Custom" },
];

export const headers: HeadersFunction = () => ({
    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
});

function ThemeToggle() {
    const { settings, updateSettings } = useSettings();
    const [dark, setDark] = useState(false);

    useEffect(() => {
        setDark(document.documentElement.classList.contains("dark"));
    }, [settings.theme]);

    return (
        <button
            type="button"
            aria-label={dark ? "Use light theme" : "Use dark theme"}
            aria-pressed={dark}
            onClick={() => {
                const next = !dark;
                setDark(next);
                updateSettings({ theme: next ? "dark" : "light" });
            }}
            className="inline-flex size-9 items-center justify-center rounded-full border border-[color:var(--landing-hairline)] text-[color:var(--landing-ink-dim)] transition-[background-color,color,transform] duration-300 hover:scale-105 hover:bg-[color:var(--landing-ink)] hover:text-[color:var(--landing-ground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)]"
        >
            {dark ? <Sun size={16} weight="bold" /> : <Moon size={16} weight="bold" />}
        </button>
    );
}

function useResolvedDark() {
    const { settings } = useSettings();
    const [dark, setDark] = useState(true);

    useEffect(() => {
        const sync = () => setDark(document.documentElement.classList.contains("dark"));
        sync();
        const observer = new MutationObserver(sync);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        return () => observer.disconnect();
    }, [settings.theme]);

    return dark;
}

function ApertureHero() {
    const dark = useResolvedDark();
    const tunnelProps = useMemo(
        () =>
            dark
                ? {
                      cableColor: "#a855f7",
                      pulseColor: "#c4b5fd",
                      tunnelColor: "#5227ff",
                      brightness: 0.95,
                  }
                : {
                      cableColor: "#7c3aed",
                      pulseColor: "#a78bfa",
                      tunnelColor: "#6d28d9",
                      brightness: 0.82,
                  },
        [dark],
    );

    return (
        <div className="hero-aperture relative mx-auto aspect-square w-full max-w-[34rem]">
            <div className="hero-aperture-bezel absolute inset-[4%] overflow-hidden rounded-full border border-[color:var(--landing-hairline)] shadow-[inset_0_0_60px_rgba(168,85,247,0.18),0_24px_80px_-40px_rgba(82,39,255,0.55)]">
                <div className="hero-tunnel-layer absolute inset-0" aria-hidden="true">
                    <LightTunnel
                        cableColor={tunnelProps.cableColor}
                        pulseColor={tunnelProps.pulseColor}
                        tunnelColor={tunnelProps.tunnelColor}
                        tunnelOpacity={0.05}
                        cableCount={14}
                        speed={0.04}
                        flowDirection="outward"
                        pulseSpeed={1.4}
                        pulseLength={0.32}
                        pulseBlend={1.4}
                        pulseWidth={0.9}
                        thickness={0.3}
                        rimWidth={0.16}
                        waviness={0.22}
                        sway={0.3}
                        size={1.05}
                        glow={1.0}
                        brightness={tunnelProps.brightness}
                        fadeNear={0.45}
                        fadeFar={2.2}
                        colorVariance
                        grain
                        grainIntensity={0.04}
                        opacity={0.92}
                        mouseInteraction
                        mouseStrength={0.05}
                    />
                </div>
                <div className="hero-aperture-vignette pointer-events-none absolute inset-0 rounded-full" aria-hidden="true" />
            </div>
            <div
                className="pointer-events-none absolute inset-0 rounded-full border border-[color:var(--landing-hairline)]"
                aria-hidden="true"
            />
        </div>
    );
}

function BentoProof() {
    return (
        <div className="grid grid-flow-dense grid-cols-1 gap-3 md:auto-rows-[13rem] md:grid-cols-12">
            <article className="group relative overflow-hidden rounded-[1.25rem] border border-[color:var(--landing-hairline)] bg-[color:var(--landing-panel)] p-6 text-[color:var(--landing-ink)] md:col-span-7 md:row-span-2">
                <div
                    className="pointer-events-none absolute inset-0 opacity-80"
                    style={{
                        background:
                            "radial-gradient(circle at 18% 20%, color-mix(in srgb, var(--landing-accent) 22%, transparent), transparent 42%), linear-gradient(160deg, color-mix(in srgb, var(--landing-secondary) 10%, transparent), transparent 55%)",
                    }}
                    aria-hidden="true"
                />
                <div className="relative z-10 flex h-full flex-col justify-between">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="max-w-sm text-2xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-3xl">
                                Make the model fit the work.
                            </p>
                            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[color:var(--landing-ink-dim)]">
                                Change providers, keep the thread, and stay close to every decision.
                            </p>
                        </div>
                        <ArrowUpRight
                            className="shrink-0 text-[color:var(--landing-ink-dim)] transition-transform duration-700 group-hover:translate-x-1 group-hover:-translate-y-1"
                            size={22}
                        />
                    </div>
                    <div className="mt-12">
                        <svg className="mb-3 h-10 w-full" viewBox="0 0 320 40" preserveAspectRatio="none" aria-hidden="true">
                            <path
                                d="M0 20 C24 20 32 6 48 6 C64 6 72 34 88 34 C104 34 112 14 128 14 C144 14 152 26 168 26 C184 26 192 10 208 10 C224 10 232 30 248 30 C264 30 272 20 288 20 C296 20 308 20 320 20"
                                fill="none"
                                stroke="var(--landing-accent)"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="grid grid-cols-3 gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--landing-ink-dim)]">
                            {["OpenAI", "Anthropic", "Local"].map((item) => (
                                <div key={item} className="border-t border-[color:var(--landing-hairline)] pt-2">
                                    {item}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </article>

            <article className="group rounded-[1.25rem] border border-[color:var(--landing-hairline)] bg-[color:var(--landing-ground)] p-6 text-[color:var(--landing-ink)] md:col-span-5">
                <Code size={22} weight="bold" className="text-[color:var(--landing-ink-dim)]" />
                <p className="mt-8 text-xl font-semibold tracking-[-0.03em]">Artifacts that stay attached.</p>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-[color:var(--landing-ink-dim)]">
                    Turn a thought into code, a file, or a working surface without breaking the thread.
                </p>
                <div className="mt-5 flex items-center gap-2 font-mono text-[10px] text-[color:var(--landing-ink-dim)]">
                    <span className="text-[color:var(--landing-accent)]">$</span> open next move
                    <ArrowRight
                        className="ml-auto text-[color:var(--landing-ink-dim)] transition-transform duration-500 group-hover:translate-x-1"
                        size={14}
                    />
                </div>
            </article>

            <article className="group relative overflow-hidden rounded-[1.25rem] border border-[color:var(--landing-accent)]/50 bg-[color:var(--landing-accent)] p-6 text-[color:var(--landing-accent-ink)] md:col-span-5">
                <div className="relative z-10">
                    <LockKey size={22} weight="bold" />
                    <p className="mt-8 text-xl font-semibold tracking-[-0.03em]">Private by posture.</p>
                    <p className="mt-2 max-w-sm text-sm leading-relaxed text-[color:var(--landing-accent-ink)]/70">
                        BYOK, local-first storage, and direct connections make the boundary visible.
                    </p>
                    <div className="mt-5 flex items-center gap-2 font-mono text-[10px] text-[color:var(--landing-accent-ink)]/70">
                        <Check size={13} weight="bold" /> your workspace, your rules
                    </div>
                </div>
                <div className="pointer-events-none absolute -bottom-14 -right-10 size-44 rounded-full border border-[color:var(--landing-accent-ink)]/15 transition-transform duration-700 group-hover:scale-110" />
            </article>
        </div>
    );
}

function ChannelAccordion() {
    const [active, setActive] = useState(0);

    return (
        <div className="flex flex-col gap-3 md:flex-row">
            {ACCORDION_ITEMS.map((item, index) => {
                const Icon = item.icon;
                const isActive = active === index;
                return (
                    <button
                        key={item.title}
                        type="button"
                        onClick={() => setActive(index)}
                        aria-expanded={isActive}
                        className={cn(
                            "group relative min-h-28 overflow-hidden rounded-[1.25rem] border p-5 text-left transition-[flex,background-color,border-color] duration-500 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)]",
                            isActive
                                ? "flex-[2] border-[color:var(--landing-ink)] bg-[color:var(--landing-ground)] text-[color:var(--landing-ink)]"
                                : "flex-1 border-[color:var(--landing-hairline)] bg-[color:var(--landing-panel)] text-[color:var(--landing-ink)] hover:border-[color:var(--landing-ink-dim)]/50",
                        )}
                    >
                        <div className="flex items-center justify-between">
                            <Icon
                                size={20}
                                weight="bold"
                                className={isActive ? "text-[color:var(--landing-accent)]" : "text-[color:var(--landing-ink-dim)]"}
                            />
                            <ArrowRight
                                className={cn(
                                    "transition-transform duration-500",
                                    isActive
                                        ? "translate-x-1 text-[color:var(--landing-accent)]"
                                        : "text-[color:var(--landing-ink-dim)] group-hover:translate-x-1",
                                )}
                                size={14}
                            />
                        </div>
                        <div className="mt-8 min-w-[12rem]">
                            <div className="text-sm font-semibold tracking-[-0.02em]">{item.title}</div>
                            <p
                                className={cn(
                                    "mt-2 max-w-sm text-sm leading-relaxed",
                                    isActive ? "text-[color:var(--landing-ink-dim)]" : "text-[color:var(--landing-ink-dim)]/80",
                                )}
                            >
                                {item.body}
                            </p>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

function RadialConvergence() {
    const [active, setActive] = useState<string | null>(null);
    const size = 640;
    const cx = size / 2;
    const cy = size / 2;
    const radius = 250;

    return (
        <div data-anim-gate="radial" className="relative">
            <div className="relative mx-auto hidden aspect-square w-full max-w-[40rem] md:block">
                <svg
                    viewBox={`0 0 ${size} ${size}`}
                    className="absolute inset-0 h-full w-full"
                    aria-hidden="true"
                >
                    {PROVIDER_NETWORK.map((provider, index) => {
                        const angle = (index / PROVIDER_NETWORK.length) * Math.PI * 2 - Math.PI / 2;
                        const x = cx + Math.cos(angle) * radius;
                        const y = cy + Math.sin(angle) * radius;
                        const lit = active === provider.id;
                        return (
                            <line
                                key={provider.id}
                                className="radial-line"
                                pathLength={1}
                                x1={cx}
                                y1={cy}
                                x2={x}
                                y2={y}
                                stroke={lit ? "var(--landing-accent)" : "var(--landing-secondary)"}
                                strokeOpacity={lit ? 0.9 : 0.28}
                                strokeWidth={lit ? 1.6 : 1}
                                strokeDasharray="1"
                                strokeDashoffset="1"
                            />
                        );
                    })}
                    <circle
                        cx={cx}
                        cy={cy}
                        r={42}
                        fill="var(--landing-panel)"
                        stroke="var(--landing-hairline)"
                        strokeWidth="1"
                    />
                </svg>

                <div className="absolute left-1/2 top-1/2 z-10 flex size-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[color:var(--landing-accent)]/50 bg-white p-3 shadow-[0_12px_40px_-20px_rgba(168,85,247,0.8)]">
                    <img src="/ai-diy.png" alt="ai.diy" className="size-full object-contain" />
                </div>

                {PROVIDER_NETWORK.map((provider, index) => {
                    const angle = (index / PROVIDER_NETWORK.length) * Math.PI * 2 - Math.PI / 2;
                    const x = 50 + Math.cos(angle) * 39;
                    const y = 50 + Math.sin(angle) * 39;
                    return (
                        <button
                            key={provider.id}
                            type="button"
                            aria-label={provider.label}
                            onMouseEnter={() => setActive(provider.id)}
                            onMouseLeave={() => setActive(null)}
                            onFocus={() => setActive(provider.id)}
                            onBlur={() => setActive(null)}
                            className="absolute z-10 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[color:var(--landing-hairline)] bg-[color:var(--landing-panel)] transition-[border-color,transform] duration-300 hover:scale-110 hover:border-[color:var(--landing-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)]"
                            style={{ left: `${x}%`, top: `${y}%` }}
                        >
                            <span className="flex size-7 items-center justify-center rounded-full bg-white/95">
                                <ModelLogo provider={provider.id} size={16} />
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="grid grid-cols-2 gap-2 md:hidden">
                {PROVIDER_NETWORK.map((provider) => (
                    <div
                        key={provider.id}
                        className="flex items-center gap-2 rounded-[0.75rem] border border-[color:var(--landing-hairline)] bg-[color:var(--landing-panel)] px-2.5 py-2"
                    >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/95">
                            <ModelLogo provider={provider.id} size={17} />
                        </span>
                        <span className="truncate text-[10px] font-medium text-[color:var(--landing-ink-dim)]">
                            {provider.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function LandingPage() {
    const page = useRef<HTMLDivElement>(null);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        let disposed = false;
        let cleanup = () => {};

        void import("../lib/landing-animations.client")
            .then((m) => m.initLandingAnimations(page.current))
            .then((dispose) => {
                if (disposed) {
                    dispose();
                } else {
                    cleanup = dispose;
                }
            });

        return () => {
            disposed = true;
            cleanup();
        };
    }, []);

    return (
        <div
            ref={page}
            className="landing-page w-full overflow-x-hidden bg-[color:var(--landing-ground)] font-[family-name:var(--landing-body)] text-[color:var(--landing-ink)]"
        >
            <div
                dangerouslySetInnerHTML={{
                    __html: `<!--
DIRECTION CONTRACT (seed threshold-01; form: the-threshold)
THESIS: The workspace is a doorway you own; the page refuses the generic glass AI hero by framing LightTunnel as a measured aperture into local-first control.
OWN-WORLD: near-black ultraviolet ground, circular LightTunnel aperture, Bricolage Grotesque display, Hanken Grotesk body, Fragment Mono readouts, soft 20px panels, full-pill controls.
STORY: A self-hoster sees models converge through an aperture they control, reads the scope, and opens the workspace.
FIRST VIEWPORT: thin top-bar nav; left claim and CTAs; right circular LightTunnel aperture with hairline bezel; quiet provider marks strip below.
FORM: The Threshold architectural portal; seed threshold-01.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md.
-->`,
                }}
            />
            <style>{`
                .landing-page {
                    --landing-ground: #0b0814;
                    --landing-panel: rgba(20,14,38,0.72);
                    --landing-ink: #f6f3ff;
                    --landing-ink-dim: rgba(228,218,255,0.66);
                    --landing-hairline: rgba(178,138,255,0.20);
                    --landing-accent: #a855f7;
                    --landing-accent-ink: #fff7ff;
                    --landing-secondary: #7c5cff;
                    --landing-display: "Bricolage Grotesque", "Hanken Grotesk", system-ui, sans-serif;
                    --landing-body: "Hanken Grotesk", system-ui, sans-serif;
                    --landing-mono: "Fragment Mono", "SF Mono", monospace;
                }
                .dark .landing-page {
                    --landing-ground: #0b0814;
                    --landing-panel: rgba(20,14,38,0.72);
                    --landing-ink: #f6f3ff;
                    --landing-ink-dim: rgba(228,218,255,0.66);
                    --landing-hairline: rgba(178,138,255,0.20);
                    --landing-accent: #a855f7;
                    --landing-accent-ink: #fff7ff;
                    --landing-secondary: #7c5cff;
                }
                :root:not(.dark) .landing-page {
                    --landing-ground: #f4f1fb;
                    --landing-panel: rgba(255,254,255,0.82);
                    --landing-ink: #1a1030;
                    --landing-ink-dim: rgba(52,34,96,0.7);
                    --landing-hairline: rgba(124,77,237,0.22);
                    --landing-accent: #7c3aed;
                    --landing-accent-ink: #fffaff;
                    --landing-secondary: #6d28d9;
                }
                .landing-page h1, .landing-page h2, .landing-page h3, .landing-page .landing-display {
                    font-family: var(--landing-display);
                    font-variation-settings: "opsz" 72;
                }
                .landing-page .font-mono {
                    font-family: var(--landing-mono);
                }
                .landing-section-lazy {
                    content-visibility: auto;
                    contain-intrinsic-size: auto 480px;
                }
                .light-tunnel-fallback {
                    background:
                        radial-gradient(circle at 50% 50%, rgba(168,85,247,0.22), transparent 28%),
                        radial-gradient(circle at 50% 50%, rgba(124,92,255,0.12), transparent 58%);
                }
                .landing-nav {
                    position: sticky;
                    top: 0;
                    z-index: 30;
                    height: 4.25rem;
                    border-bottom: 1px solid var(--landing-hairline);
                    background: color-mix(in srgb, var(--landing-ground) 88%, transparent);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                }
                .hero-tunnel-layer {
                    opacity: 0.92;
                    transform: translateZ(0);
                }
                .hero-aperture-vignette {
                    background: radial-gradient(circle at 50% 50%, transparent 42%, color-mix(in srgb, var(--landing-ground) 72%, transparent) 100%);
                }
                .radial-line {
                    stroke-dasharray: 1;
                    stroke-dashoffset: 1;
                    pathLength: 1;
                    transition: stroke-opacity 300ms ease, stroke-width 300ms ease;
                }
                .landing-anim-active .radial-line {
                    animation: radial-draw 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                @keyframes radial-draw {
                    to { stroke-dashoffset: 0; }
                }
                .aperture-pulse {
                    width: 0.45rem;
                    height: 0.45rem;
                    border-radius: 999px;
                    background: var(--landing-accent);
                    box-shadow: 0 0 16px 4px color-mix(in srgb, var(--landing-accent) 45%, transparent);
                    opacity: 0.55;
                    animation-play-state: paused;
                }
                .landing-anim-active .aperture-pulse {
                    animation: aperture-pulse 2.4s ease-in-out infinite;
                }
                @keyframes aperture-pulse {
                    0%, 100% { opacity: 0.35; transform: scale(0.85); }
                    50% { opacity: 0.9; transform: scale(1); }
                }
                .landing-tab-hidden .aperture-pulse,
                .landing-tab-hidden .radial-line {
                    animation-play-state: paused !important;
                }
                @media (prefers-reduced-motion: reduce) {
                    .aperture-pulse, .radial-line {
                        animation: none !important;
                    }
                    .radial-line {
                        stroke-dashoffset: 0;
                    }
                }
                @media (prefers-reduced-transparency: reduce) {
                    .landing-nav {
                        backdrop-filter: none;
                        -webkit-backdrop-filter: none;
                        background: var(--landing-ground);
                    }
                }
            `}</style>

            <nav className="landing-nav">
                <div className="mx-auto flex h-full w-full max-w-[90rem] items-center justify-between px-5 sm:px-8 lg:px-12">
                    <Link to="/" className="flex items-center gap-2.5 text-sm font-semibold tracking-[-0.02em]">
                        <img src="/ai-diy.png" alt="ai.diy" className="size-7 rounded-lg object-cover" />
                        ai.diy
                    </Link>
                    <div className="hidden items-center gap-7 text-xs text-[color:var(--landing-ink-dim)] md:flex">
                        <a href="#demo" className="transition-colors hover:text-[color:var(--landing-ink)]">
                            Demo
                        </a>
                        <a href="#deploy" className="transition-colors hover:text-[color:var(--landing-ink)]">
                            Deploy
                        </a>
                        <a
                            href="https://github.com/Cubinghackerz/ai.diy"
                            target="_blank"
                            rel="noreferrer"
                            className="transition-colors hover:text-[color:var(--landing-ink)]"
                        >
                            GitHub
                        </a>
                    </div>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <button
                            type="button"
                            className="inline-flex size-9 items-center justify-center rounded-full border border-[color:var(--landing-hairline)] text-[color:var(--landing-ink-dim)] md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)]"
                            aria-label={menuOpen ? "Close menu" : "Open menu"}
                            aria-expanded={menuOpen}
                            onClick={() => setMenuOpen((open) => !open)}
                        >
                            {menuOpen ? <X size={16} weight="bold" /> : <List size={16} weight="bold" />}
                        </button>
                        <Link
                            to="/workspace"
                            className="group inline-flex items-center gap-2 rounded-full bg-[color:var(--landing-accent)] px-4 py-2.5 text-xs font-semibold text-[color:var(--landing-accent-ink)] transition-transform duration-300 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)]"
                        >
                            Open workspace
                            <ArrowUpRight
                                className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                                size={14}
                            />
                        </Link>
                    </div>
                </div>
                {menuOpen ? (
                    <div className="border-t border-[color:var(--landing-hairline)] bg-[color:var(--landing-ground)] px-5 py-4 md:hidden">
                        <div className="flex flex-col gap-3 text-sm text-[color:var(--landing-ink-dim)]">
                            <a href="#demo" onClick={() => setMenuOpen(false)} className="hover:text-[color:var(--landing-ink)]">
                                Demo
                            </a>
                            <a href="#deploy" onClick={() => setMenuOpen(false)} className="hover:text-[color:var(--landing-ink)]">
                                Deploy
                            </a>
                            <a
                                href="https://github.com/Cubinghackerz/ai.diy"
                                target="_blank"
                                rel="noreferrer"
                                className="hover:text-[color:var(--landing-ink)]"
                            >
                                GitHub
                            </a>
                        </div>
                    </div>
                ) : null}
            </nav>

            <main>
                <section
                    data-anim-gate="hero"
                    className="relative isolate mx-auto grid min-h-[min(100dvh,56rem)] w-full max-w-[90rem] items-center gap-12 overflow-visible px-5 pb-16 pt-10 sm:px-8 md:pb-20 md:pt-14 lg:grid-cols-[5fr_7fr] lg:gap-16 lg:px-12"
                >
                    <div data-landing-reveal className="relative z-10 overflow-visible">
                        <p className="landing-display max-w-xl overflow-visible text-[clamp(2.4rem,5.4vw,4.6rem)] font-semibold leading-[1.08] tracking-[-0.04em]">
                            ai.diy
                            <span className="mt-3 block text-[0.72em] font-semibold leading-[1.12] tracking-[-0.03em] text-[color:var(--landing-ink)]">
                                The open-source AI workspace you own.
                            </span>
                        </p>
                        <p className="mt-8 max-w-lg text-base leading-relaxed text-[color:var(--landing-ink-dim)] sm:text-lg">
                            Local-first, bring-your-own-key chat with tools, skills, and browser-owned history. No server-side LLM credentials.
                        </p>
                        <div className="mt-9 flex flex-wrap items-center gap-3">
                            <a
                                href="#demo"
                                className="group inline-flex items-center gap-2 rounded-full bg-[color:var(--landing-accent)] px-5 py-3 text-sm font-semibold text-[color:var(--landing-accent-ink)] transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)]"
                            >
                                Demo
                                <ArrowRight className="transition-transform duration-300 group-hover:translate-x-1" size={16} />
                            </a>
                            <a
                                href="#deploy"
                                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--landing-hairline)] px-5 py-3 text-sm font-semibold text-[color:var(--landing-ink-dim)] transition-colors hover:border-[color:var(--landing-ink-dim)]/60 hover:text-[color:var(--landing-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)]"
                            >
                                Deploy
                            </a>
                            <a
                                href="https://github.com/Cubinghackerz/ai.diy"
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--landing-hairline)] px-5 py-3 text-sm font-semibold text-[color:var(--landing-ink-dim)] transition-colors hover:border-[color:var(--landing-ink-dim)]/60 hover:text-[color:var(--landing-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)]"
                            >
                                GitHub
                            </a>
                        </div>
                    </div>
                    <div data-landing-reveal className="relative z-10">
                        <ApertureHero />
                    </div>
                </section>

                <section id="demo" className="landing-section-lazy mx-auto w-full max-w-[90rem] px-5 py-24 sm:px-8 md:py-32 lg:px-12">
                    <div data-landing-reveal className="mb-8 max-w-2xl">
                        <p className="landing-display text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-5xl">
                            See the workspace.
                        </p>
                        <p className="mt-4 text-base leading-relaxed text-[color:var(--landing-ink-dim)]">
                            Streaming reasoning, multi-model chat, and deep analysis in one local-first surface.
                        </p>
                    </div>
                    <div
                        data-landing-reveal
                        className="overflow-hidden rounded-[1.25rem] border border-[color:var(--landing-hairline)] bg-[color:var(--landing-panel)] shadow-[0_24px_80px_-48px_rgba(11,5,34,0.85)]"
                    >
                        <img
                            src="/workspace-demo.gif"
                            alt="ai.diy workspace demo: streaming chat, reasoning, and Canvas artifacts"
                            className="block h-auto w-full"
                            width={1786}
                            height={1080}
                            loading="lazy"
                            decoding="async"
                        />
                    </div>
                    <div className="mt-6 flex flex-wrap gap-3">
                        <Link
                            to="/workspace"
                            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--landing-ink)] px-5 py-3 text-sm font-semibold text-[color:var(--landing-ground)] transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)]"
                        >
                            Open workspace
                            <ArrowRight size={16} />
                        </Link>
                    </div>
                </section>

                <section
                    id="deploy"
                    className="landing-section-lazy border-y border-[color:var(--landing-hairline)] px-5 py-24 sm:px-8 md:py-32 lg:px-12"
                >
                    <div data-landing-reveal className="mx-auto flex w-full max-w-[48rem] flex-col items-center text-center">
                        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--landing-ink-dim)]">
                            Deploy
                        </p>
                        <p className="landing-display mt-4 text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-5xl">
                            Deploy in one command.
                        </p>
                        <p className="mt-5 max-w-lg text-base leading-relaxed text-[color:var(--landing-ink-dim)]">
                            Node, Docker Compose, or a Vercel preview. Keys stay in the browser.
                        </p>
                        <pre className="mt-10 w-full overflow-x-auto rounded-[1.25rem] border border-[color:var(--landing-hairline)] bg-[color:var(--landing-panel)] p-5 text-left font-mono text-xs leading-relaxed text-[color:var(--landing-ink)] sm:text-sm">
{`npm install
npm run build && npm start

# or
docker compose up --build`}
                        </pre>
                        <a
                            href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FCubinghackerz%2Fai.diy&project-name=ai-diy-preview"
                            target="_blank"
                            rel="noreferrer"
                            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[color:var(--landing-ink)] px-5 py-3 text-sm font-semibold text-[color:var(--landing-ground)] transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)]"
                        >
                            Deploy to Vercel
                            <ArrowUpRight size={16} />
                        </a>
                    </div>
                </section>

                <section id="proof" className="landing-section-lazy mx-auto w-full max-w-[90rem] px-5 py-24 sm:px-8 md:py-40 lg:px-12">
                    <div data-landing-reveal className="mb-10 max-w-2xl">
                        <p className="landing-display text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-5xl">
                            The interface should disappear. The thinking should not.
                        </p>
                    </div>
                    <BentoProof />
                </section>

                <section
                    id="motion"
                    data-anim-gate="motion"
                    className="border-y border-[color:var(--landing-hairline)] px-5 py-24 sm:px-8 md:py-40 lg:px-12"
                >
                    <div className="mx-auto grid w-full max-w-[90rem] gap-14 xl:grid-cols-[minmax(0,0.65fr)_minmax(0,1.35fr)] xl:gap-24">
                        <div data-landing-reveal className="max-w-md xl:sticky xl:top-24 xl:self-start">
                            <p className="landing-display text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-5xl">
                                A workspace with a pulse, not a performance.
                            </p>
                            <p className="mt-6 text-base leading-relaxed text-[color:var(--landing-ink-dim)]">
                                Open a thread, bring your context, and let the useful parts stay close. The details are quiet until you need them.
                            </p>
                        </div>
                        <div data-stack className="space-y-3">
                            {[
                                {
                                    icon: Command,
                                    title: "Start anywhere",
                                    body: "A blank thread, a project, a file, or a question. The workspace gives each one somewhere to go.",
                                    tone: "bg-[color:var(--landing-ground)] text-[color:var(--landing-ink)] border border-[color:var(--landing-hairline)]",
                                    pulse: true,
                                },
                                {
                                    icon: Lightning,
                                    title: "Switch without starting over",
                                    body: "Move across models and providers while the conversation keeps its shape.",
                                    tone: "bg-[color:var(--landing-accent)] text-[color:var(--landing-accent-ink)]",
                                    pulse: false,
                                },
                                {
                                    icon: Code,
                                    title: "Leave with something real",
                                    body: "Artifacts, exports, memories, and backups make the output useful after the answer ends.",
                                    tone: "bg-[color:var(--landing-panel)] text-[color:var(--landing-ink)] border border-[color:var(--landing-hairline)]",
                                    pulse: true,
                                },
                            ].map((card) => {
                                const Icon = card.icon;
                                return (
                                    <article
                                        key={card.title}
                                        data-stack-card
                                        className={cn("min-h-48 rounded-[1.25rem] p-6 sm:min-h-56 sm:p-8", card.tone)}
                                    >
                                        <div className="flex items-start justify-between">
                                            <Icon size={23} weight="bold" />
                                            {card.pulse ? <span className="aperture-pulse" aria-hidden="true" /> : null}
                                        </div>
                                        <div className="mt-12 flex items-end justify-between gap-5">
                                            <div>
                                                <h3 className="text-2xl font-semibold tracking-[-0.03em]">{card.title}</h3>
                                                <p
                                                    className={cn(
                                                        "mt-2 max-w-md text-sm leading-relaxed",
                                                        card.tone.includes("landing-accent-ink")
                                                            ? "text-[color:var(--landing-accent-ink)]/70"
                                                            : "text-[color:var(--landing-ink-dim)]",
                                                    )}
                                                >
                                                    {card.body}
                                                </p>
                                            </div>
                                            <ArrowUpRight className="shrink-0 text-[color:var(--landing-ink-dim)]" size={20} />
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </div>
                </section>

                <section className="landing-section-lazy mx-auto w-full max-w-[90rem] px-5 py-24 sm:px-8 md:py-40 lg:px-12">
                    <div data-landing-reveal className="mb-10 max-w-2xl">
                        <p className="landing-display text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-5xl">
                            The setup is yours to shape.
                        </p>
                    </div>
                    <ChannelAccordion />
                </section>

                <section id="providers" className="landing-section-lazy mx-auto w-full max-w-[90rem] px-5 pb-24 sm:px-8 md:pb-40 lg:px-12">
                    <div data-landing-reveal className="mb-10 max-w-2xl">
                        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--landing-ink-dim)]">
                            Providers
                        </p>
                        <p className="landing-display mt-4 text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-5xl">
                            Bring every model into one line of thought.
                        </p>
                        <p className="mt-5 max-w-xl text-base leading-relaxed text-[color:var(--landing-ink-dim)]">
                            Connect the providers you already use, including local models, then move between them without rebuilding the conversation.
                        </p>
                    </div>
                    <RadialConvergence />
                </section>

                <section
                    id="search"
                    className="landing-section-lazy border-y border-[color:var(--landing-hairline)] px-5 py-24 sm:px-8 md:py-32 lg:px-12"
                >
                    <div data-landing-reveal className="mx-auto grid w-full max-w-[90rem] gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
                        <div>
                            <p className="landing-display max-w-xl text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-5xl">
                                Web search is free from the start.
                            </p>
                            <p className="mt-5 max-w-lg text-base leading-relaxed text-[color:var(--landing-ink-dim)]">
                                ai.diy bundles free hosted web search and page fetch through the MCPs of Firecrawl and Parallel. No search API key is required to begin.
                            </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <article className="group rounded-[1.25rem] border border-[color:var(--landing-hairline)] bg-[color:var(--landing-panel)] p-5 transition-[border-color,transform] duration-500 hover:-translate-y-1 hover:border-[color:var(--landing-ink-dim)]/50">
                                <picture className="block h-10 w-full max-w-[12rem] rounded-lg bg-white p-2 dark:hidden">
                                    <img src="/firecrawl-dark.png" alt="Firecrawl" className="h-full w-full object-contain object-left" />
                                </picture>
                                <picture className="hidden h-10 w-full max-w-[12rem] rounded-lg bg-[#171717] p-2 dark:block">
                                    <img src="/firecrawl-light.png" alt="Firecrawl" className="h-full w-full object-contain object-left" />
                                </picture>
                                <p className="mt-5 text-sm font-semibold">Search and fetch without setup.</p>
                                <p className="mt-2 text-xs leading-relaxed text-[color:var(--landing-ink-dim)]">
                                    Bundled keyless MCP for live web research and page extraction.
                                </p>
                            </article>
                            <article className="group rounded-[1.25rem] border border-[color:var(--landing-hairline)] bg-[color:var(--landing-panel)] p-5 transition-[border-color,transform] duration-500 hover:-translate-y-1 hover:border-[color:var(--landing-ink-dim)]/50">
                                <picture className="block h-10 w-full max-w-[12rem] rounded-lg bg-white p-2 dark:hidden">
                                    <img src="/parallel-dark.png" alt="Parallel" className="h-full w-full object-contain object-left" />
                                </picture>
                                <picture className="hidden h-10 w-full max-w-[12rem] rounded-lg bg-[#171717] p-2 dark:block">
                                    <img src="/parallel-light.png" alt="Parallel" className="h-full w-full object-contain object-left" />
                                </picture>
                                <p className="mt-5 text-sm font-semibold">Advanced search, included.</p>
                                <p className="mt-2 text-xs leading-relaxed text-[color:var(--landing-ink-dim)]">
                                    Bundled MCP search with citations and bounded result counts.
                                </p>
                            </article>
                        </div>
                    </div>
                </section>

                <section id="connect" className="landing-section-lazy mx-auto w-full max-w-[90rem] px-5 py-24 sm:px-8 md:py-40 lg:px-12">
                    <div
                        data-landing-reveal
                        className="relative overflow-hidden rounded-[1.25rem] border border-[color:var(--landing-hairline)] bg-[color:var(--landing-ground)] p-7 text-[color:var(--landing-ink)] sm:p-12 md:p-16"
                    >
                        <div
                            className="pointer-events-none absolute inset-0"
                            style={{
                                background:
                                    "radial-gradient(circle at 70% 40%, color-mix(in srgb, var(--landing-accent) 18%, transparent), transparent 42%)",
                            }}
                            aria-hidden="true"
                        />
                        <div className="relative grid gap-12 lg:grid-cols-[1fr_auto] lg:items-end">
                            <div>
                                <p className="landing-display max-w-4xl text-[clamp(2.8rem,6vw,6rem)] font-semibold leading-[0.95] tracking-[-0.04em]">
                                    Bring the next good question.
                                </p>
                                <p className="mt-7 max-w-xl text-base leading-relaxed text-[color:var(--landing-ink-dim)]">
                                    Open the real workspace when you are ready. Your chats, providers, tools, and files are waiting on the other side.
                                </p>
                            </div>
                            <Link
                                to="/workspace"
                                className="group inline-flex w-fit items-center gap-2 rounded-full bg-[color:var(--landing-accent)] px-5 py-3 text-sm font-semibold text-[color:var(--landing-accent-ink)] transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)]"
                            >
                                Open ai.diy
                                <ArrowUpRight
                                    className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                                    size={16}
                                />
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="mx-auto flex w-full max-w-[90rem] flex-col gap-5 border-t border-[color:var(--landing-hairline)] px-5 py-7 text-xs text-[color:var(--landing-ink-dim)] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
                <span className="font-semibold tracking-[-0.02em] text-[color:var(--landing-ink)]">ai.diy</span>
                <span>Open tools for useful thinking.</span>
                <Link
                    to="/workspace"
                    className="inline-flex items-center gap-1 font-semibold text-[color:var(--landing-ink)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)]"
                >
                    Enter workspace <ArrowRight size={13} />
                </Link>
            </footer>
        </div>
    );
}

export default LandingPage;
