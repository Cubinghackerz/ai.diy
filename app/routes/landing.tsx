import { useEffect, useRef, useState } from "react";
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
    LockKey,
    Moon,
    PlugsConnected,
    Sun,
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

export const headers: HeadersFunction = () => ({
    // The landing route is static; cache SSR output at Vercel's edge instead
    // of spending a function invocation on every anonymous page request.
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
            className="inline-flex size-9 items-center justify-center rounded-full border border-[color:var(--landing-hairline)] text-[color:var(--landing-ink-dim)] transition-[background-color,color,transform] duration-300 hover:scale-105 hover:bg-[color:var(--landing-ink)] hover:text-[color:var(--landing-bench)] focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)]"
        >
            {dark ? <Sun size={16} weight="bold" /> : <Moon size={16} weight="bold" />}
        </button>
    );
}

function WorkspacePanel() {
    const capabilities = [
        {
            icon: LockKey,
            title: "Your keys, your call",
            body: "BYOK stays in the browser.",
        },
        {
            icon: Brain,
            title: "Switch models",
            body: "Keep the thread across providers.",
        },
        {
            icon: Code,
            title: "Leave with something real",
            body: "Artifacts, files, and exports stay attached.",
        },
        {
            icon: PlugsConnected,
            title: "Tools when they matter",
            body: "Search, MCP, Python, and more.",
        },
    ];

    return (
        <div data-anim-gate="workspace" className="hero-workspace-panel relative overflow-hidden rounded-[1.25rem] border border-[color:var(--landing-hairline)] bg-[color:var(--landing-panel)] shadow-[0_24px_80px_-40px_rgba(11,5,34,0.9)]">
            <div className="landing-graticule absolute inset-0 opacity-80" aria-hidden="true" />
            <div className="relative z-10 flex h-full min-h-[24rem] flex-col p-5 sm:min-h-[30rem] sm:p-6">
                <div className="flex items-center justify-between border-b border-[color:var(--landing-hairline)] pb-4 font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--landing-ink-dim)]">
                    <span className="flex items-center gap-2">
                        <img src="/ai-diy.png" alt="ai.diy" className="size-6 rounded-md object-cover" />
                        <span className="font-sans font-semibold normal-case tracking-[-0.02em] text-[color:var(--landing-ink)]">ai.diy</span>
                    </span>
                    <span className="flex items-center gap-2">
                        <span className="size-1.5 rounded-full bg-[color:var(--landing-accent)] shadow-[0_0_14px_3px_rgba(168,85,247,0.5)]" />
                        WORKSPACE READY
                    </span>
                </div>
                <div className="mt-6">
                    <p className="max-w-md text-2xl font-semibold leading-[1.05] tracking-[-0.03em] text-[color:var(--landing-ink)] sm:text-3xl">
                        One workspace. Every useful model.
                    </p>
                    <p className="mt-3 max-w-md text-sm leading-relaxed text-[color:var(--landing-ink-dim)]">
                        Bring provider keys, conversations, files, and tools into one local-first working surface.
                    </p>
                </div>
                <div className="mt-6 grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                    {capabilities.map((capability) => {
                        const Icon = capability.icon;
                        return (
                            <div key={capability.title} className="group rounded-xl border border-[color:var(--landing-hairline)] bg-[color:var(--landing-bench)]/55 p-3 transition-[border-color,background-color,transform] duration-300 hover:-translate-y-0.5 hover:border-[color:var(--landing-accent)]/60 hover:bg-[color:var(--landing-accent)]/10">
                                <Icon size={17} weight="bold" className="text-[color:var(--landing-accent)] transition-transform duration-300 group-hover:scale-110" />
                                <p className="mt-5 text-sm font-semibold tracking-[-0.02em] text-[color:var(--landing-ink)]">{capability.title}</p>
                                <p className="mt-1 text-xs leading-relaxed text-[color:var(--landing-ink-dim)]">{capability.body}</p>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[color:var(--landing-hairline)] pt-4 font-mono text-[9px] uppercase tracking-[0.14em] text-[color:var(--landing-ink-dim)]">
                    <span>17 providers</span>
                    <span>Browser-owned history</span>
                    <span>Self-hosted</span>
                </div>
                <div className="mt-4 flex items-center gap-2">
                    {(["openai", "anthropic", "ollama"] as ProviderId[]).map((provider) => (
                        <span key={provider} className="flex size-7 items-center justify-center rounded-lg bg-white/95 transition-transform duration-300 hover:-translate-y-1">
                            <ModelLogo provider={provider} size={16} />
                        </span>
                    ))}
                    <span className="ml-1 text-xs text-[color:var(--landing-ink-dim)]">and local models</span>
                </div>
            </div>
        </div>
    );
}

function BentoProof() {
    return (
        <div className="grid grid-flow-dense grid-cols-1 gap-3 md:auto-rows-[13rem] md:grid-cols-12">
            <article className="group relative overflow-hidden rounded-[1.25rem] border border-[color:var(--landing-hairline)] bg-[color:var(--landing-bench)] p-6 text-[color:var(--landing-ink)] md:col-span-7 md:row-span-2">
                <div className="landing-graticule-fine absolute inset-0 opacity-60" aria-hidden="true" />
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
                        <ArrowUpRight className="shrink-0 text-[color:var(--landing-ink-dim)] transition-transform duration-700 group-hover:translate-x-1 group-hover:-translate-y-1" size={22} />
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
                            {["OpenAI", "Anthropic", "Local"].map((item, index) => (
                                <div key={item} className="border-t border-[color:var(--landing-hairline)] pt-2">
                                    <span className="flex items-center gap-1.5">
                                        <span className={cn("size-1.5 rounded-full", index === 2 ? "bg-[color:var(--landing-accent)]" : "bg-[color:var(--landing-ink-dim)]/50")} />
                                        {item}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </article>

            <article className="group rounded-[1.25rem] border border-[color:var(--landing-hairline)] bg-[color:var(--landing-panel)] p-6 text-[color:var(--landing-ink)] shadow-[0_14px_45px_-35px_rgba(0,0,0,0.55)] md:col-span-5 dark:shadow-none">
                <div className="flex items-center justify-between">
                    <Code size={22} weight="bold" className="text-[color:var(--landing-ink-dim)]" />
                    <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[color:var(--landing-ink-dim)]/70">OUT · FILE</span>
                </div>
                <p className="mt-8 text-xl font-semibold tracking-[-0.03em]">Artifacts that stay attached.</p>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-[color:var(--landing-ink-dim)]">Turn a thought into code, a file, or a working surface without breaking the thread.</p>
                <div className="mt-5 flex items-center gap-2 font-mono text-[10px] text-[color:var(--landing-ink-dim)]">
                    <span className="text-[color:var(--landing-accent)]">$</span> open next move
                    <ArrowRight className="ml-auto text-[color:var(--landing-ink-dim)] transition-transform duration-500 group-hover:translate-x-1" size={14} />
                </div>
            </article>

            <article className="group relative overflow-hidden rounded-[1.25rem] border border-[color:var(--landing-accent)]/60 bg-[color:var(--landing-accent)] p-6 text-[color:var(--landing-accent-ink)] md:col-span-5">
                <div className="relative z-10">
                    <div className="flex items-center justify-between">
                        <LockKey size={22} weight="bold" />
                        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[color:var(--landing-accent-ink)]/70">SEC · LOCAL</span>
                    </div>
                    <p className="mt-8 text-xl font-semibold tracking-[-0.03em]">Private by posture.</p>
                    <p className="mt-2 max-w-sm text-sm leading-relaxed text-[color:var(--landing-accent-ink)]/70">BYOK, local-first storage, and direct connections make the boundary visible.</p>
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
                        className={cn(
                            "group relative min-h-28 overflow-hidden rounded-[1.15rem] border p-5 text-left transition-[flex,background-color,border-color] duration-500 ease-out focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)]",
                            isActive
                                ? "flex-[2] border-[color:var(--landing-ink)] bg-[color:var(--landing-bench)] text-[color:var(--landing-ink)]"
                                : "flex-1 border-[color:var(--landing-hairline)] bg-[color:var(--landing-panel)] text-[color:var(--landing-ink)] hover:border-[color:var(--landing-ink-dim)]/50",
                        )}
                    >
                        <div className="flex items-center justify-between">
                            <Icon size={20} weight="bold" className={isActive ? "text-[color:var(--landing-accent)]" : "text-[color:var(--landing-ink-dim)]"} />
                            <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-[color:var(--landing-ink-dim)]/70">
                                <span className={cn("size-1.5 rounded-full transition-colors duration-300", isActive ? "bg-[color:var(--landing-accent)] shadow-[0_0_12px_3px_rgba(168,85,247,0.45)]" : "bg-[color:var(--landing-ink-dim)]/40")} />
                                CH{String(index + 1).padStart(2, "0")}
                            </span>
                        </div>
                        <div className="mt-8 min-w-[12rem]">
                            <div className="flex items-center gap-2 text-sm font-semibold tracking-[-0.02em]">
                                {item.title}
                                <ArrowRight className={cn("transition-transform duration-500", isActive ? "translate-x-1 text-[color:var(--landing-accent)]" : "text-[color:var(--landing-ink-dim)] group-hover:translate-x-1")} size={14} />
                            </div>
                            <p className={cn("mt-2 max-w-sm text-sm leading-relaxed", isActive ? "text-[color:var(--landing-ink-dim)]" : "text-[color:var(--landing-ink-dim)]/80")}>{item.body}</p>
                        </div>
                        {isActive ? <div className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-[color:var(--landing-accent)] shadow-[0_0_12px_3px_rgba(168,85,247,0.4)]" /> : null}
                    </button>
                );
            })}
        </div>
    );
}

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

function Patchbay() {
    return (
        <div data-anim-gate="patchbay" className="relative overflow-hidden rounded-[1.35rem] border border-[color:var(--landing-hairline)] bg-[color:var(--landing-bench)] p-5 text-white sm:p-8">
            <div className="landing-graticule absolute inset-0 opacity-50" aria-hidden="true" />
            <div className="pointer-events-none absolute inset-0 opacity-90" aria-hidden="true">
                <svg viewBox="0 0 1000 520" className="h-full w-full" preserveAspectRatio="none">
                    <path d="M110 260H405" stroke="rgba(244,241,231,.22)" strokeWidth="1.5" />
                    {PROVIDER_NETWORK.map((provider, index) => {
                        const y = 42 + index * 27;
                        const bend = 500 + (index % 3) * 34;
                        const isHot = index % 5 === 0;
                        return (
                            <path
                                key={provider.id}
                                d={`M455 260 C${bend} 260 ${bend} ${y} 850 ${y}`}
                                fill="none"
                                stroke={isHot ? "rgba(168,85,247,.86)" : "rgba(244,241,231,.16)"}
                                strokeWidth={isHot ? "1.6" : "1"}
                                strokeDasharray={isHot ? "3 9" : undefined}
                                className={cn("patchbay-line", isHot && "patchbay-line-hot")}
                            />
                        );
                    })}
                </svg>
            </div>
            <div className="relative hidden min-h-[31rem] md:block">
                <div className="absolute left-[4%] top-1/2 flex -translate-y-1/2 items-center gap-3">
                    <div className="flex size-14 items-center justify-center rounded-full border border-white/25 bg-[color:var(--landing-panel)] shadow-[0_0_0_8px_rgba(168,85,247,.08)]">
                        <Lightning size={21} weight="fill" className="text-[color:var(--landing-accent)]" />
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">your context</span>
                </div>
                <div className="absolute left-[41%] top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
                    <div className="patchbay-hub relative flex size-20 items-center justify-center rounded-full border border-[color:var(--landing-accent)]/60 bg-white p-4 shadow-[0_0_0_10px_rgba(168,85,247,.08)]">
                        <img src="/ai-diy.png" alt="ai.diy" className="size-full object-contain" />
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/60">ai.diy workspace</span>
                </div>
                <div className="absolute right-[2%] top-4 grid w-[35%] grid-cols-2 gap-2">
                    {PROVIDER_NETWORK.map((provider, index) => (
                        <div key={provider.id} className="group flex items-center gap-2 rounded-xl border border-white/12 bg-[color:var(--landing-panel)] px-2.5 py-2 transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-[color:var(--landing-accent)]/70">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/95">
                                <ModelLogo provider={provider.id} size={17} />
                            </span>
                            <span className="truncate text-[10px] font-medium text-white/75 group-hover:text-white">{provider.label}</span>
                            <span className={cn("ml-auto size-1.5 shrink-0 rounded-full", index % 4 === 0 ? "bg-[color:var(--landing-accent)]" : "bg-white/25")} />
                        </div>
                    ))}
                </div>
            </div>
            <div className="relative grid grid-cols-2 gap-2 md:hidden">
                {PROVIDER_NETWORK.map((provider, index) => (
                    <div key={provider.id} className="flex items-center gap-2 rounded-xl border border-white/12 bg-[color:var(--landing-panel)] px-2.5 py-2">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/95">
                            <ModelLogo provider={provider.id} size={17} />
                        </span>
                        <span className="truncate text-[10px] font-medium text-white/75">{provider.label}</span>
                        <span className={cn("ml-auto size-1.5 shrink-0 rounded-full", index % 4 === 0 ? "bg-[color:var(--landing-accent)]" : "bg-white/25")} />
                    </div>
                ))}
            </div>
        </div>
    );
}

function LandingPage() {
    const page = useRef<HTMLDivElement>(null);

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
        <div ref={page} className="landing-page w-full overflow-x-hidden bg-[color:var(--landing-bench)] text-[color:var(--landing-ink)]">
            <div dangerouslySetInnerHTML={{ __html: `<!--
DIRECTION CONTRACT (seed 720c420b; form: ultraviolet-signal-field)
THESIS: The workspace is a controlled signal field, not a cloud commodity; the page refuses the generic glass AI hero.
OWN-WORLD: midnight indigo ground, ultraviolet fiber cables, electric-blue pulses, translucent console panels, graticules, and Archivo plus JetBrains Mono.
STORY: A self-hoster sees models converge through a field they control, then reads the scope and opens the workspace.
FIRST VIEWPORT: a full-bleed LightTunnel field sits behind the unchanged claim and CTAs; a readable workspace panel floats above it with keys, models, tools, artifacts, and provider marks.
FORM: existing Signal Bench direction expanded into a LightTunnel-led ultraviolet signal field; seed 720c420b retained.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md.
-->` }} />
            <style>{`
                .landing-page {
                    --landing-bench: #080613;
                    --landing-panel: rgba(17,12,39,0.76);
                    --landing-ink: #f7f4ff;
                    --landing-ink-dim: rgba(230,222,255,0.68);
                    --landing-hairline: rgba(185,145,255,0.22);
                    --landing-accent: #a855f7;
                    --landing-accent-ink: #fff8ff;
                    --landing-amber: #4cc9f0;
                    --landing-gridline: rgba(184,146,255,0.11);
                    --landing-display: "Archivo", "DM Sans", system-ui, sans-serif;
                }
                .dark .landing-page {
                    --landing-bench: #080613;
                    --landing-panel: rgba(17,12,39,0.76);
                    --landing-ink: #f7f4ff;
                    --landing-ink-dim: rgba(230,222,255,0.68);
                    --landing-hairline: rgba(185,145,255,0.22);
                    --landing-accent: #a855f7;
                    --landing-accent-ink: #fff8ff;
                    --landing-amber: #4cc9f0;
                    --landing-gridline: rgba(184,146,255,0.11);
                    --landing-display: "Archivo", "DM Sans", system-ui, sans-serif;
                }
                :root:not(.dark) .landing-page {
                    --landing-bench: #eee9ff;
                    --landing-panel: rgba(255,253,255,0.8);
                    --landing-ink: #19112f;
                    --landing-ink-dim: rgba(48,34,86,0.7);
                    --landing-hairline: rgba(93,56,164,0.22);
                    --landing-accent: #7c3aed;
                    --landing-accent-ink: #fffaff;
                    --landing-amber: #0891b2;
                    --landing-gridline: rgba(93,56,164,0.11);
                    --landing-display: "Archivo", "DM Sans", system-ui, sans-serif;
                }
                .landing-page h1, .landing-page h2, .landing-page h3 {
                    font-family: var(--landing-display);
                }
                .landing-graticule {
                    background-image:
                        linear-gradient(to right, var(--landing-gridline) 1px, transparent 1px),
                        linear-gradient(to bottom, var(--landing-gridline) 1px, transparent 1px);
                    background-size: 10% 100%, 100% 10%;
                }
                .landing-graticule-fine {
                    background-image:
                        linear-gradient(to right, var(--landing-gridline) 1px, transparent 1px),
                        linear-gradient(to bottom, var(--landing-gridline) 1px, transparent 1px);
                    background-size: 5% 100%, 100% 5%;
                }
                .landing-section-lazy {
                    content-visibility: auto;
                    contain-intrinsic-size: auto 720px;
                }
                .light-tunnel-fallback {
                    background:
                        radial-gradient(circle at 52% 48%, rgba(168,85,247,0.2), transparent 24%),
                        radial-gradient(circle at 52% 48%, rgba(76,201,240,0.12), transparent 58%);
                }
                .landing-nav {
                    position: relative;
                    z-index: 20;
                    margin-top: 1rem;
                    border: 1px solid var(--landing-hairline);
                    border-radius: 999px;
                    background: color-mix(in srgb, var(--landing-panel) 74%, transparent);
                    backdrop-filter: blur(18px) saturate(140%);
                    -webkit-backdrop-filter: blur(18px) saturate(140%);
                    box-shadow: 0 18px 60px -36px rgba(31, 10, 72, 0.8);
                }
                .landing-hero {
                    margin-top: 1rem;
                    background: radial-gradient(circle at 50% 45%, rgba(82,39,255,0.12), transparent 54%), var(--landing-bench);
                    box-shadow: 0 28px 90px -48px rgba(82,39,255,0.72);
                }
                .hero-tunnel-layer {
                    opacity: 0.82;
                    transform: translateZ(0);
                }
                .hero-vignette {
                    background:
                        radial-gradient(circle at 52% 48%, transparent 0, rgba(8,6,19,0.08) 42%, rgba(8,6,19,0.82) 100%),
                        linear-gradient(90deg, rgba(8,6,19,0.84) 0%, rgba(8,6,19,0.38) 46%, rgba(8,6,19,0.18) 100%);
                }
                .hero-grid {
                    background-image:
                        linear-gradient(to right, rgba(185,145,255,0.08) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(185,145,255,0.08) 1px, transparent 1px);
                    background-size: 12.5% 100%, 100% 20%;
                    mask-image: radial-gradient(circle at 52% 48%, black, transparent 72%);
                    opacity: 0.5;
                }
                .hero-orbit {
                    border: 1px solid rgba(168,85,247,0.26);
                    border-radius: 999px;
                    opacity: 0.65;
                    transform: rotate(-16deg);
                    animation-play-state: paused;
                }
                .landing-anim-active .hero-orbit {
                    animation: hero-orbit 16s linear infinite;
                    animation-play-state: running;
                }
                .hero-orbit-a {
                    width: 52rem;
                    height: 18rem;
                    right: -12rem;
                    top: 5rem;
                }
                .hero-orbit-b {
                    width: 34rem;
                    height: 12rem;
                    right: 10rem;
                    bottom: 2rem;
                    border-color: rgba(76,201,240,0.22);
                    transform: rotate(22deg);
                    animation-direction: reverse !important;
                    animation-duration: 22s !important;
                }
                @keyframes hero-orbit {
                    from { transform: rotate(-16deg) translate3d(0,0,0); }
                    to { transform: rotate(344deg) translate3d(0,0,0); }
                }
                .hero-signal-dot {
                    width: 0.45rem;
                    height: 0.45rem;
                    border-radius: 999px;
                    background: var(--landing-accent);
                    box-shadow: 0 0 20px 5px color-mix(in srgb, var(--landing-accent) 54%, transparent);
                    opacity: 0;
                    transform: scale(0.7);
                }
                .landing-anim-active .hero-signal-dot {
                    animation: hero-signal-dot 2.8s ease-in-out infinite;
                }
                .hero-signal-dot-a { right: 42%; top: 24%; animation-delay: 0.3s !important; }
                .hero-signal-dot-b { right: 14%; bottom: 21%; animation-delay: 1.1s !important; background: var(--landing-amber); }
                @keyframes hero-signal-dot {
                    0%, 100% { opacity: 0; transform: scale(0.7); }
                    35%, 65% { opacity: 0.8; transform: scale(1); }
                }
                .hero-workspace-panel {
                    backdrop-filter: blur(12px) saturate(130%);
                    -webkit-backdrop-filter: blur(12px) saturate(130%);
                    transition: border-color 500ms ease, transform 500ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 500ms ease;
                }
                .hero-workspace-panel:hover {
                    border-color: color-mix(in srgb, var(--landing-accent) 48%, var(--landing-hairline));
                    transform: translateY(-4px);
                    box-shadow: 0 32px 100px -54px rgba(168,85,247,0.95);
                }
                .landing-vu,
                .patchbay-line-hot {
                    animation-play-state: paused;
                }
                .landing-anim-active .landing-vu,
                .landing-anim-active .patchbay-line-hot {
                    animation-play-state: running;
                }
                .landing-tab-hidden .landing-vu,
                .landing-tab-hidden .patchbay-hub::after,
                .landing-tab-hidden .patchbay-line-hot {
                    animation-play-state: paused !important;
                }
                .landing-vu {
                    animation: landing-vu 1.15s ease-in-out infinite alternate;
                    animation-play-state: paused;
                }
                @keyframes landing-vu {
                    from { opacity: 0.45; transform: scaleY(0.55); transform-origin: bottom; }
                    to { opacity: 1; transform: scaleY(1); transform-origin: bottom; }
                }
                .patchbay-hub {
                    isolation: isolate;
                }
                .patchbay-hub::after {
                    content: "";
                    position: absolute;
                    inset: -8px;
                    z-index: -1;
                    border: 1px solid color-mix(in srgb, var(--landing-accent) 72%, transparent);
                    border-radius: 999px;
                    opacity: 0;
                    transform: scale(0.84);
                    animation-play-state: paused;
                }
                .landing-anim-active .patchbay-hub::after {
                    animation: landing-hub-ring 3.2s ease-out infinite;
                }
                @keyframes landing-hub-ring {
                    0% { opacity: 0; transform: scale(0.84); }
                    28% { opacity: 0.4; }
                    100% { opacity: 0; transform: scale(1.3); }
                }
                .patchbay-line-hot {
                    animation: landing-dash 1.4s linear infinite;
                    animation-play-state: paused;
                }
                .landing-anim-active .landing-vu,
                .landing-anim-active .patchbay-line-hot {
                    animation-play-state: running;
                }
                @keyframes landing-dash {
                    to { stroke-dashoffset: -24; }
                }
                @media (prefers-reduced-motion: reduce) {
                    .landing-vu, .patchbay-hub::after, .patchbay-line-hot, .hero-orbit, .hero-signal-dot {
                        animation: none !important;
                        transform: none !important;
                        opacity: 0.5;
                    }
                    .hero-workspace-panel { transition: none; }
                }
            `}</style>
            <nav className="landing-nav mx-auto flex w-[calc(100%-2rem)] max-w-[90rem] items-center justify-between px-4 py-3 sm:w-[calc(100%-4rem)] sm:px-6 lg:w-[calc(100%-6rem)]">
                <Link to="/" className="flex items-center gap-2.5 text-sm font-semibold tracking-[-0.02em]">
                    <img src="/ai-diy.png" alt="ai.diy" className="size-7 rounded-lg object-cover" />
                    ai.diy
                </Link>
                <div className="hidden items-center gap-7 text-xs text-[color:var(--landing-ink-dim)] md:flex">
                    <a href="#demo" className="transition-colors hover:text-[color:var(--landing-ink)]">Demo</a>
                    <a href="#deploy" className="transition-colors hover:text-[color:var(--landing-ink)]">Deploy</a>
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
                    <Link
                        to="/workspace"
                        className="group inline-flex items-center gap-2 rounded-full bg-[color:var(--landing-ink)] px-4 py-2.5 text-xs font-semibold text-[color:var(--landing-bench)] transition-transform duration-300 hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)]"
                    >
                        Open workspace
                        <ArrowUpRight className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" size={14} />
                    </Link>
                </div>
            </nav>

            <main>
                <section data-anim-gate="hero" className="landing-hero relative isolate mx-auto grid min-h-[min(760px,calc(100dvh-5rem))] w-full max-w-[90rem] gap-12 overflow-hidden rounded-[1.5rem] border border-[color:var(--landing-hairline)] px-5 pb-16 pt-14 sm:px-8 md:pb-24 md:pt-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16 lg:px-12">
                    <div className="hero-tunnel-layer pointer-events-none absolute inset-0 z-0" aria-hidden="true">
                        <LightTunnel
                            cableColor="#a855f7"
                            pulseColor="#4cc9f0"
                            tunnelColor="#5227ff"
                            tunnelOpacity={0.02}
                            cableCount={18}
                            speed={0.055}
                            pulseSpeed={1.7}
                            pulseLength={0.27}
                            glow={0.95}
                            brightness={0.9}
                            mouseInteraction
                            mouseStrength={0.06}
                        />
                    </div>
                    <div className="hero-vignette pointer-events-none absolute inset-0 z-0" aria-hidden="true" />
                    <div className="hero-grid pointer-events-none absolute inset-0 z-0" aria-hidden="true" />
                    <div className="hero-orbit hero-orbit-a pointer-events-none absolute z-0" aria-hidden="true" />
                    <div className="hero-orbit hero-orbit-b pointer-events-none absolute z-0" aria-hidden="true" />
                    <div className="hero-signal-dot hero-signal-dot-a pointer-events-none absolute z-0" aria-hidden="true" />
                    <div className="hero-signal-dot hero-signal-dot-b pointer-events-none absolute z-0" aria-hidden="true" />
                    <div data-landing-reveal className="relative z-10">
                        <p className="max-w-xl text-[clamp(2.4rem,5.4vw,4.6rem)] font-semibold leading-[0.98] tracking-[-0.04em]">
                            ai.diy
                            <span className="mt-3 block text-[0.72em] font-semibold leading-[1.05] tracking-[-0.03em] text-[color:var(--landing-ink)]">
                                The open-source AI workspace you own.
                            </span>
                        </p>
                        <p className="mt-8 max-w-lg text-base leading-relaxed text-[color:var(--landing-ink-dim)] sm:text-lg">
                            Local-first, bring-your-own-key chat with tools, skills, and browser-owned history. No server-side LLM credentials.
                        </p>
                        <div className="mt-9 flex flex-wrap items-center gap-3">
                            <a
                                href="#demo"
                                className="group inline-flex items-center gap-2 rounded-full bg-[color:var(--landing-accent)] px-5 py-3 text-sm font-semibold text-[color:var(--landing-accent-ink)] transition-transform duration-300 hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)]"
                            >
                                Demo
                                <ArrowRight className="transition-transform duration-300 group-hover:translate-x-1" size={16} />
                            </a>
                            <a
                                href="#deploy"
                                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--landing-hairline)] px-5 py-3 text-sm font-semibold text-[color:var(--landing-ink-dim)] transition-colors hover:border-[color:var(--landing-ink-dim)]/60 hover:text-[color:var(--landing-ink)]"
                            >
                                Deploy
                            </a>
                            <a
                                href="https://github.com/Cubinghackerz/ai.diy"
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--landing-hairline)] px-5 py-3 text-sm font-semibold text-[color:var(--landing-ink-dim)] transition-colors hover:border-[color:var(--landing-ink-dim)]/60 hover:text-[color:var(--landing-ink)]"
                            >
                                GitHub
                            </a>
                        </div>
                    </div>
                    <div data-landing-reveal className="relative z-10">
                        <WorkspacePanel />
                    </div>
                </section>

                <section id="demo" className="landing-section-lazy mx-auto w-full max-w-[90rem] px-5 py-24 sm:px-8 md:py-32 lg:px-12">
                    <div data-landing-reveal className="mb-8 max-w-2xl">
                        <p className="text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-5xl">See the workspace.</p>
                        <p className="mt-4 text-base leading-relaxed text-[color:var(--landing-ink-dim)]">
                            Streaming chat, model switching, and tools in one local-first surface.
                        </p>
                    </div>
                    <div data-landing-reveal className="overflow-hidden rounded-[1.25rem] border border-[color:var(--landing-hairline)] bg-[color:var(--landing-panel)] shadow-[0_24px_80px_-48px_rgba(11,5,34,0.85)]">
                        <img
                            src="/workspace-demo.png"
                            alt="ai.diy workspace showing chat, model picker, and tools"
                            className="block h-auto w-full"
                            width={1600}
                            height={900}
                            loading="lazy"
                        />
                    </div>
                    <div className="mt-6 flex flex-wrap gap-3">
                        <Link
                            to="/workspace"
                            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--landing-ink)] px-5 py-3 text-sm font-semibold text-[color:var(--landing-bench)]"
                        >
                            Open workspace
                            <ArrowRight size={16} />
                        </Link>
                    </div>
                </section>

                <section id="deploy" className="landing-section-lazy border-y border-[color:var(--landing-hairline)] px-5 py-24 sm:px-8 md:py-32 lg:px-12">
                    <div data-landing-reveal className="mx-auto grid w-full max-w-[90rem] gap-10 lg:grid-cols-2 lg:items-center">
                        <div>
                            <p className="text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-5xl">Deploy in one command.</p>
                            <p className="mt-5 max-w-lg text-base leading-relaxed text-[color:var(--landing-ink-dim)]">
                                Node, Docker Compose, or a Vercel preview. Keys stay in the browser.
                            </p>
                        </div>
                        <pre className="overflow-x-auto rounded-[1.15rem] border border-[color:var(--landing-hairline)] bg-[color:var(--landing-panel)] p-5 font-mono text-xs leading-relaxed text-[color:var(--landing-ink)] sm:text-sm">
{`npm install
npm run build && npm start

# or
docker compose up --build`}
                        </pre>
                    </div>
                </section>

                <section id="proof" className="landing-section-lazy mx-auto w-full max-w-[90rem] px-5 py-24 sm:px-8 md:py-40 lg:px-12">
                    <div data-landing-reveal className="mb-10 max-w-2xl">
                        <p className="text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-5xl">The interface should disappear. The thinking should not.</p>
                    </div>
                    <BentoProof />
                </section>

                <section id="motion" data-anim-gate="motion" className="border-y border-[color:var(--landing-hairline)] px-5 py-24 sm:px-8 md:py-40 lg:px-12">
                    <div className="mx-auto grid w-full max-w-[90rem] gap-14 xl:grid-cols-[minmax(0,0.65fr)_minmax(0,1.35fr)] xl:gap-24">
                        <div data-landing-reveal className="max-w-md xl:sticky xl:top-20 xl:self-start">
                            <p className="text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-5xl">A workspace with a pulse, not a performance.</p>
                            <p className="mt-6 text-base leading-relaxed text-[color:var(--landing-ink-dim)]">Open a thread, bring your context, and let the useful parts stay close. The details are quiet until you need them.</p>
                        </div>
                        <div data-stack className="space-y-3">
                            {[
                                { icon: Command, title: "Start anywhere", body: "A blank thread, a project, a file, or a question. The workspace gives each one somewhere to go.", tone: "bg-[color:var(--landing-bench)] text-[color:var(--landing-ink)] border border-[color:var(--landing-hairline)]", led: true },
                                { icon: Lightning, title: "Switch without starting over", body: "Move across models and providers while the conversation keeps its shape.", tone: "bg-[color:var(--landing-accent)] text-[color:var(--landing-accent-ink)]", led: false },
                                { icon: Code, title: "Leave with something real", body: "Artifacts, exports, memories, and backups make the output useful after the answer ends.", tone: "bg-[color:var(--landing-panel)] text-[color:var(--landing-ink)] border border-[color:var(--landing-hairline)]", led: true },
                            ].map((card) => {
                                const Icon = card.icon;
                                return (
                                    <article key={card.title} data-stack-card className={cn("min-h-48 rounded-[1.25rem] p-6 sm:min-h-56 sm:p-8", card.tone)}>
                                        <div className="flex items-start justify-between">
                                            <Icon size={23} weight="bold" />
                                            {card.led ? (
                                                <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-[color:var(--landing-ink-dim)]/70">
                                                    <span className="landing-vu flex h-3.5 items-end gap-0.5" aria-hidden="true">
                                                        <span className="w-0.5 rounded-[1px] bg-[color:var(--landing-accent)]" style={{ height: "100%", animationDelay: "0ms" }} />
                                                        <span className="w-0.5 rounded-[1px] bg-[color:var(--landing-accent)]" style={{ height: "65%", animationDelay: "120ms" }} />
                                                        <span className="w-0.5 rounded-[1px] bg-[color:var(--landing-accent)]" style={{ height: "85%", animationDelay: "240ms" }} />
                                                    </span>
                                                    RUNNING
                                                </span>
                                            ) : (
                                                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[color:var(--landing-accent-ink)]/60">SWITCH</span>
                                            )}
                                        </div>
                                        <div className="mt-12 flex items-end justify-between gap-5">
                                            <div>
                                                <h3 className="text-2xl font-semibold tracking-[-0.03em]">{card.title}</h3>
                                                <p className={cn("mt-2 max-w-md text-sm leading-relaxed", card.tone.includes("landing-accent-ink") ? "text-[color:var(--landing-accent-ink)]/70" : "text-[color:var(--landing-ink-dim)]")}>{card.body}</p>
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
                        <p className="text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-5xl">The setup is yours to shape.</p>
                    </div>
                    <ChannelAccordion />
                </section>

                <section id="providers" className="landing-section-lazy mx-auto w-full max-w-[90rem] px-5 pb-24 sm:px-8 md:pb-40 lg:px-12">
                    <div data-landing-reveal className="mb-10 max-w-2xl">
                        <p className="text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-5xl">Bring every model into one line of thought.</p>
                        <p className="mt-5 max-w-xl text-base leading-relaxed text-[color:var(--landing-ink-dim)]">Connect the providers you already use, including local models, then move between them without rebuilding the conversation.</p>
                    </div>
                    <Patchbay />
                </section>

                <section id="search" className="landing-section-lazy border-y border-[color:var(--landing-hairline)] px-5 py-24 sm:px-8 md:py-32 lg:px-12">
                    <div data-landing-reveal className="mx-auto grid w-full max-w-[90rem] gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
                        <div>
                            <p className="max-w-xl text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-5xl">Web search is free from the start.</p>
                            <p className="mt-5 max-w-lg text-base leading-relaxed text-[color:var(--landing-ink-dim)]">ai.diy bundles free hosted web search and page fetch through the MCPs of Firecrawl and Parallel. No search API key is required to begin.</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <article className="group rounded-[1.15rem] border border-[color:var(--landing-hairline)] bg-[color:var(--landing-panel)] p-5 transition-[border-color,transform] duration-500 hover:-translate-y-1 hover:border-[color:var(--landing-ink-dim)]/50">
                                <div className="flex items-center justify-between">
                                    <picture className="block h-10 w-full max-w-[12rem] rounded-lg bg-white p-2 dark:hidden">
                                        <img src="/firecrawl-dark.png" alt="Firecrawl" className="h-full w-full object-contain object-left" />
                                    </picture>
                                    <picture className="hidden h-10 w-full max-w-[12rem] rounded-lg bg-[#171717] p-2 dark:block">
                                        <img src="/firecrawl-light.png" alt="Firecrawl" className="h-full w-full object-contain object-left" />
                                    </picture>
                                    <span className="size-1.5 shrink-0 rounded-full bg-[color:var(--landing-accent)] shadow-[0_0_12px_3px_rgba(168,85,247,0.4)]" />
                                </div>
                                <p className="mt-5 text-sm font-semibold">Search and fetch without setup.</p>
                                <p className="mt-2 text-xs leading-relaxed text-[color:var(--landing-ink-dim)]">Bundled keyless MCP for live web research and page extraction.</p>
                            </article>
                            <article className="group rounded-[1.15rem] border border-[color:var(--landing-hairline)] bg-[color:var(--landing-panel)] p-5 transition-[border-color,transform] duration-500 hover:-translate-y-1 hover:border-[color:var(--landing-ink-dim)]/50">
                                <div className="flex items-center justify-between">
                                    <picture className="block h-10 w-full max-w-[12rem] rounded-lg bg-white p-2 dark:hidden">
                                        <img src="/parallel-dark.png" alt="Parallel" className="h-full w-full object-contain object-left" />
                                    </picture>
                                    <picture className="hidden h-10 w-full max-w-[12rem] rounded-lg bg-[#171717] p-2 dark:block">
                                        <img src="/parallel-light.png" alt="Parallel" className="h-full w-full object-contain object-left" />
                                    </picture>
                                    <span className="size-1.5 shrink-0 rounded-full bg-[color:var(--landing-accent)] shadow-[0_0_12px_3px_rgba(168,85,247,0.4)]" />
                                </div>
                                <p className="mt-5 text-sm font-semibold">Advanced search, included.</p>
                                <p className="mt-2 text-xs leading-relaxed text-[color:var(--landing-ink-dim)]">Bundled MCP search with citations and bounded result counts.</p>
                            </article>
                        </div>
                    </div>
                </section>

                <section id="connect" className="landing-section-lazy mx-auto w-full max-w-[90rem] px-5 py-24 sm:px-8 md:py-40 lg:px-12">
                    <div data-landing-reveal className="relative overflow-hidden rounded-[1.35rem] border border-[color:var(--landing-hairline)] bg-[color:var(--landing-bench)] p-7 text-[color:var(--landing-ink)] sm:p-12 md:p-16">
                        <div className="landing-graticule absolute inset-0 opacity-60" aria-hidden="true" />
                        <div className="relative">
                            <div className="grid gap-12 lg:grid-cols-[1fr_auto] lg:items-end">
                                <div>
                                    <p className="max-w-4xl text-[clamp(2.8rem,6vw,6rem)] font-semibold leading-[0.95] tracking-[-0.04em]">Bring the next good question.</p>
                                    <p className="mt-7 max-w-xl text-base leading-relaxed text-[color:var(--landing-ink-dim)]">Open the real workspace when you are ready. Your chats, providers, tools, and files are waiting on the other side.</p>
                                </div>
                                <Link to="/workspace" className="group inline-flex w-fit items-center gap-2 rounded-full bg-[color:var(--landing-accent)] px-5 py-3 text-sm font-semibold text-[color:var(--landing-accent-ink)] transition-transform duration-300 hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)]">
                                    Open ai.diy
                                    <ArrowUpRight className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" size={16} />
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="mx-auto flex w-full max-w-[90rem] flex-col gap-5 border-t border-[color:var(--landing-hairline)] px-5 py-7 text-xs text-[color:var(--landing-ink-dim)] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
                <span className="font-semibold tracking-[-0.02em] text-[color:var(--landing-ink)]">ai.diy</span>
                <span>Open tools for useful thinking.</span>
                <Link to="/workspace" className="inline-flex items-center gap-1 font-semibold text-[color:var(--landing-ink)] hover:underline">
                    Enter workspace <ArrowRight size={13} />
                </Link>
            </footer>
        </div>
    );
}

export default LandingPage;
