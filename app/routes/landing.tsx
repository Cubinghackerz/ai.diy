import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { cn } from "~/lib/utils";
import { useSettings } from "~/lib/providers/SettingsProvider";
import type { ProviderId } from "~/lib/types";
import { ModelLogo } from "~/components/ui/ModelLogo";
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
            className="inline-flex size-9 items-center justify-center rounded-full border border-black/15 text-[color:var(--landing-ink)] transition-[background-color,color,transform] duration-300 hover:scale-105 hover:bg-[color:var(--landing-ink)] hover:text-[color:var(--landing-paper)] focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)] dark:border-white/20"
        >
            {dark ? <Sun size={16} weight="bold" /> : <Moon size={16} weight="bold" />}
        </button>
    );
}

function BentoProof() {
    return (
        <div className="grid grid-flow-dense grid-cols-1 gap-3 md:auto-rows-[13rem] md:grid-cols-12">
            <article className="group relative overflow-hidden rounded-[1.4rem] border border-black/10 bg-[color:var(--landing-ink)] p-6 text-[color:var(--landing-paper)] md:col-span-7 md:row-span-2 dark:border-white/10">
                <div className="relative z-10 flex h-full flex-col justify-between">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="max-w-sm text-2xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-3xl">
                                Make the model fit the work.
                            </p>
                            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[color:var(--landing-paper)]/65">
                                Change providers, keep the thread, and stay close to every decision.
                            </p>
                        </div>
                        <ArrowUpRight className="shrink-0 transition-transform duration-700 group-hover:translate-x-1 group-hover:-translate-y-1" size={22} />
                    </div>
                    <div className="mt-12 grid grid-cols-3 gap-2 text-[10px] text-[color:var(--landing-paper)]/70">
                        {["OpenAI", "Anthropic", "Local"].map((item, index) => (
                            <div key={item} className="border-t border-[color:var(--landing-paper)]/20 pt-2">
                                <span className="flex items-center gap-1.5">
                                    <span className={cn("size-1.5 rounded-full", index === 2 ? "bg-[color:var(--landing-accent)]" : "bg-[color:var(--landing-paper)]/45")} />
                                    {item}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="pointer-events-none absolute -bottom-16 -right-12 size-56 rounded-full border border-[color:var(--landing-paper)]/15 transition-transform duration-700 group-hover:scale-110" />
                <div className="pointer-events-none absolute -bottom-8 -right-4 size-32 rounded-full border border-[color:var(--landing-accent)]/50 transition-transform duration-700 group-hover:scale-125" />
            </article>

            <article className="group rounded-[1.4rem] border border-black/10 bg-[color:var(--landing-paper)] p-6 text-[color:var(--landing-ink)] shadow-[0_14px_45px_-35px_rgba(0,0,0,0.6)] md:col-span-5 dark:border-white/10 dark:shadow-none">
                <Code size={22} weight="bold" />
                <p className="mt-8 text-xl font-semibold tracking-[-0.035em]">Artifacts that stay attached.</p>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-black/50 dark:text-white/50">Turn a thought into code, a file, or a working surface without breaking the thread.</p>
                <div className="mt-5 flex items-center gap-2 font-mono text-[10px] text-black/45 dark:text-white/45">
                    <span className="text-[color:var(--landing-accent-ink)]">$</span> open next move
                    <ArrowRight className="ml-auto transition-transform duration-500 group-hover:translate-x-1" size={14} />
                </div>
            </article>

            <article className="group rounded-[1.4rem] border border-black/10 bg-[color:var(--landing-accent)] p-6 text-[#111111] md:col-span-5">
                <LockKey size={22} weight="bold" />
                <p className="mt-8 text-xl font-semibold tracking-[-0.035em]">Private by posture.</p>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#111111]/65">BYOK, local-first storage, and direct connections make the boundary visible.</p>
                <div className="mt-5 flex items-center gap-2 font-mono text-[10px] text-[#111111]/60">
                    <Check size={13} weight="bold" /> your workspace, your rules
                </div>
            </article>
        </div>
    );
}

function AccordionProof() {
    const [active, setActive] = useState(0);

    return (
        <div className="flex flex-col gap-2 md:flex-row">
            {ACCORDION_ITEMS.map((item, index) => {
                const Icon = item.icon;
                const isActive = active === index;
                return (
                    <button
                        key={item.title}
                        type="button"
                        onClick={() => setActive(index)}
                        className={cn(
                            "group min-h-28 overflow-hidden rounded-[1.2rem] border p-5 text-left transition-[flex,background-color,border-color] duration-500 ease-out focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)]",
                            isActive
                                ? "flex-[2] border-[color:var(--landing-ink)] bg-[color:var(--landing-ink)] text-[color:var(--landing-paper)] dark:border-white/30"
                                : "flex-1 border-black/10 bg-[color:var(--landing-paper)] text-[color:var(--landing-ink)] hover:border-black/25 dark:border-white/10 dark:hover:border-white/25",
                        )}
                    >
                        <Icon size={20} weight="bold" />
                        <div className="mt-8 min-w-[12rem]">
                            <div className="flex items-center gap-2 text-sm font-semibold tracking-[-0.02em]">
                                {item.title}
                                <ArrowRight className="transition-transform duration-500 group-hover:translate-x-1" size={14} />
                            </div>
                            <p className={cn("mt-2 max-w-sm text-sm leading-relaxed", isActive ? "text-[color:var(--landing-paper)]/65" : "text-black/50 dark:text-white/50")}>{item.body}</p>
                        </div>
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

function ProviderNetwork() {
    return (
        <div className="relative overflow-hidden rounded-[1.6rem] border border-black/10 bg-[#0d0e10] p-5 text-white sm:p-8 dark:border-white/10">
            <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden="true">
                <svg viewBox="0 0 1000 520" className="h-full w-full" preserveAspectRatio="none">
                    <path d="M110 260H405" stroke="rgba(255,255,255,.22)" strokeWidth="1.5" />
                    {PROVIDER_NETWORK.map((provider, index) => {
                        const y = 42 + index * 27;
                        const bend = 500 + (index % 3) * 34;
                        return (
                            <path
                                key={provider.id}
                                d={`M455 260 C${bend} 260 ${bend} ${y} 850 ${y}`}
                                fill="none"
                                stroke={index % 5 === 0 ? "rgba(215,255,79,.68)" : "rgba(255,255,255,.18)"}
                                strokeWidth={index % 5 === 0 ? "1.6" : "1"}
                                strokeDasharray={index % 4 === 0 ? "5 8" : undefined}
                                className="provider-network-line"
                            />
                        );
                    })}
                </svg>
            </div>
            <div className="relative hidden min-h-[31rem] md:block">
                <div className="absolute left-[4%] top-1/2 flex -translate-y-1/2 items-center gap-3">
                    <div className="flex size-14 items-center justify-center rounded-full border border-white/25 bg-[#101114] shadow-[0_0_0_8px_rgba(255,255,255,.03)]">
                        <Lightning size={21} weight="fill" className="text-[#d7ff4f]" />
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">your context</span>
                </div>
                <div className="absolute left-[41%] top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
                    <div className="flex size-20 items-center justify-center rounded-full border border-white/30 bg-white p-4 shadow-[0_0_0_10px_rgba(255,255,255,.04)] transition-transform duration-700 hover:scale-110">
                        <img src="/ai-diy.png" alt="ai.diy" className="size-full object-contain" />
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/60">ai.diy workspace</span>
                </div>
                <div className="absolute right-[2%] top-4 grid w-[35%] grid-cols-2 gap-2">
                    {PROVIDER_NETWORK.map((provider) => (
                        <div key={provider.id} className="group flex items-center gap-2 rounded-xl border border-white/15 bg-[#121316] px-2.5 py-2 transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-[#d7ff4f]/70">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/95">
                                <ModelLogo provider={provider.id} size={17} />
                            </span>
                            <span className="truncate text-[10px] font-medium text-white/75 group-hover:text-white">{provider.label}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2 md:hidden">
                {PROVIDER_NETWORK.map((provider) => (
                    <div key={provider.id} className="flex items-center gap-2 rounded-xl border border-white/15 bg-[#121316] px-2.5 py-2">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/95">
                            <ModelLogo provider={provider.id} size={17} />
                        </span>
                        <span className="truncate text-[10px] font-medium text-white/75">{provider.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function LandingPage() {
    const page = useRef<HTMLDivElement>(null);

    useEffect(() => {
        void import("../lib/landing-animations.client").then((m) =>
            m.initLandingAnimations(page.current),
        );
    }, []);

    return (
        <div ref={page} className="landing-page w-full overflow-x-hidden bg-[color:var(--landing-paper)] text-[color:var(--landing-ink)]">
            <style>{`
                .landing-page {
                    --landing-paper: #f3f3ee;
                    --landing-ink: #111111;
                    --landing-accent: #d7ff4f;
                    --landing-accent-ink: #6f8300;
                }
                .dark .landing-page {
                    --landing-paper: #111111;
                    --landing-ink: #f4f4ee;
                    --landing-accent: #d7ff4f;
                    --landing-accent-ink: #d7ff4f;
                }
            `}</style>
            <nav className="mx-auto flex w-full max-w-[90rem] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
                <Link to="/" className="flex items-center gap-2 text-sm font-semibold tracking-[-0.04em]">
                    <img src="/ai-diy.png" alt="ai.diy" className="size-7 rounded-lg object-cover" />
                    ai.diy
                </Link>
                <div className="hidden items-center gap-7 text-xs text-black/55 md:flex dark:text-white/55">
                    <a href="#proof" className="transition-colors hover:text-[color:var(--landing-ink)]">Why it works</a>
                    <a href="#motion" className="transition-colors hover:text-[color:var(--landing-ink)]">Inside the workspace</a>
                    <a href="#connect" className="transition-colors hover:text-[color:var(--landing-ink)]">Connect</a>
                </div>
                <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <Link
                        to="/workspace"
                        className="group inline-flex items-center gap-2 rounded-full bg-[color:var(--landing-ink)] px-4 py-2.5 text-xs font-semibold text-[color:var(--landing-paper)] transition-transform duration-300 hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)]"
                    >
                        Open workspace
                        <ArrowUpRight className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" size={14} />
                    </Link>
                </div>
            </nav>

            <main>
                <section className="mx-auto grid w-full max-w-[90rem] gap-12 px-5 pb-24 pt-16 sm:px-8 md:pb-36 md:pt-28 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16 lg:px-12">
                    <div data-landing-reveal>
                        <p className="max-w-xl text-[clamp(3rem,6vw,6.2rem)] font-semibold leading-[0.92] tracking-[-0.065em]">
                            Think clearly.
                            <br />
                            Build openly.
                        </p>
                        <p className="mt-8 max-w-lg text-base leading-relaxed text-black/55 dark:text-white/55 sm:text-lg">
                            A local-first AI workspace for people who want the model to meet the moment, not the other way around.
                        </p>
                        <div className="mt-9 flex flex-wrap items-center gap-3">
                            <Link
                                to="/workspace"
                                className="group inline-flex items-center gap-2 rounded-full bg-[color:var(--landing-ink)] px-5 py-3 text-sm font-semibold text-[color:var(--landing-paper)] transition-transform duration-300 hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)]"
                            >
                                Start in the workspace
                                <ArrowRight className="transition-transform duration-300 group-hover:translate-x-1" size={16} />
                            </Link>
                            <a href="#search" className="inline-flex items-center gap-2 rounded-full border border-black/15 px-5 py-3 text-sm font-semibold transition-colors hover:border-black/40 dark:border-white/20 dark:hover:border-white/50">
                                Explore free search
                            </a>
                        </div>
                    </div>
                    <div data-landing-reveal className="relative flex min-h-[24rem] items-center justify-center overflow-hidden rounded-[1.8rem] border border-black/10 bg-[color:var(--landing-ink)] p-8 dark:border-white/10 sm:min-h-[30rem]">
                        <div className="absolute inset-8 rounded-[1.4rem] border border-[color:var(--landing-paper)]/15" />
                        <div className="absolute inset-16 rounded-[1.1rem] border border-[color:var(--landing-accent)]/40" />
                        <div className="relative z-10 flex flex-col items-center text-center">
                            <div className="flex size-44 items-center justify-center rounded-[2rem] bg-white p-5 shadow-[0_30px_70px_-35px_rgba(0,0,0,0.9)] transition-transform duration-700 hover:rotate-2 hover:scale-105 sm:size-56 sm:p-7">
                                <img src="/ai-diy.png" alt="ai.diy logo" className="size-full object-contain" />
                            </div>
                            <p className="mt-7 font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--landing-paper)]/60">One workspace. Every useful model.</p>
                        </div>
                    </div>
                </section>

                <section id="proof" className="mx-auto w-full max-w-[90rem] px-5 py-24 sm:px-8 md:py-40 lg:px-12">
                    <div data-landing-reveal className="mb-10 max-w-2xl">
                        <p className="text-3xl font-semibold leading-tight tracking-[-0.05em] sm:text-5xl">The interface should disappear. The thinking should not.</p>
                    </div>
                    <BentoProof />
                </section>

                <section id="motion" className="border-y border-black/10 bg-[color:var(--landing-paper)] px-5 py-24 sm:px-8 md:py-40 lg:px-12 dark:border-white/10">
                    <div className="mx-auto grid w-full max-w-[90rem] gap-14 xl:grid-cols-[minmax(0,0.65fr)_minmax(0,1.35fr)] xl:gap-24">
                        <div data-landing-reveal className="max-w-md xl:sticky xl:top-20 xl:self-start">
                            <p className="text-3xl font-semibold leading-tight tracking-[-0.05em] sm:text-5xl">A workspace with a pulse, not a performance.</p>
                            <p className="mt-6 text-base leading-relaxed text-black/55 dark:text-white/55">Open a thread, bring your context, and let the useful parts stay close. The details are quiet until you need them.</p>
                        </div>
                        <div data-stack className="space-y-3">
                            {[
                                { icon: Command, title: "Start anywhere", body: "A blank thread, a project, a file, or a question. The workspace gives each one somewhere to go.", tone: "bg-[color:var(--landing-ink)] text-[color:var(--landing-paper)]" },
                                { icon: Lightning, title: "Switch without starting over", body: "Move across models and providers while the conversation keeps its shape.", tone: "bg-[color:var(--landing-accent)] text-[#111111]" },
                                { icon: Code, title: "Leave with something real", body: "Artifacts, exports, memories, and backups make the output useful after the answer ends.", tone: "bg-[color:var(--landing-paper)] text-[color:var(--landing-ink)] border border-black/10 dark:border-white/10" },
                            ].map((card) => {
                                const Icon = card.icon;
                                return (
                                    <article key={card.title} data-stack-card className={cn("min-h-48 rounded-[1.4rem] p-6 sm:min-h-56 sm:p-8", card.tone)}>
                                        <Icon size={23} weight="bold" />
                                        <div className="mt-12 flex items-end justify-between gap-5">
                                            <div>
                                                <h3 className="text-2xl font-semibold tracking-[-0.045em]">{card.title}</h3>
                                                <p className={cn("mt-2 max-w-md text-sm leading-relaxed", card.tone.includes("text-[#111111]") ? "text-[#111111]/65" : "text-[color:var(--landing-paper)]/65")}>{card.body}</p>
                                            </div>
                                            <ArrowUpRight className="shrink-0" size={20} />
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </div>
                </section>

                <section className="mx-auto w-full max-w-[90rem] px-5 py-24 sm:px-8 md:py-40 lg:px-12">
                    <div data-landing-reveal className="mb-10 max-w-2xl">
                        <p className="text-3xl font-semibold leading-tight tracking-[-0.05em] sm:text-5xl">The setup is yours to shape.</p>
                    </div>
                    <AccordionProof />
                </section>

                <section id="providers" className="mx-auto w-full max-w-[90rem] px-5 pb-24 sm:px-8 md:pb-40 lg:px-12">
                    <div data-landing-reveal className="mb-10 max-w-2xl">
                        <p className="text-3xl font-semibold leading-tight tracking-[-0.05em] sm:text-5xl">Bring every model into one line of thought.</p>
                        <p className="mt-5 max-w-xl text-base leading-relaxed text-black/55 dark:text-white/55">Connect the providers you already use, including local models, then move between them without rebuilding the conversation.</p>
                    </div>
                    <ProviderNetwork />
                </section>

                <section id="search" className="border-y border-black/10 bg-[color:var(--landing-paper)] px-5 py-24 sm:px-8 md:py-32 lg:px-12 dark:border-white/10">
                    <div data-landing-reveal className="mx-auto grid w-full max-w-[90rem] gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
                        <div>
                            <p className="max-w-xl text-3xl font-semibold leading-tight tracking-[-0.05em] sm:text-5xl">Web search is free from the start.</p>
                            <p className="mt-5 max-w-lg text-base leading-relaxed text-black/55 dark:text-white/55">ai.diy bundles free hosted web search and page fetch through the MCPs of Firecrawl and Parallel. No search API key is required to begin.</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <article className="group rounded-[1.35rem] border border-black/10 bg-[color:var(--landing-paper)] p-5 transition-[border-color,transform] duration-500 hover:-translate-y-1 hover:border-black/30 dark:border-white/10 dark:hover:border-white/30">
                                <picture className="block h-12 w-full max-w-[13rem] rounded-lg bg-white p-2 dark:hidden">
                                    <img src="/firecrawl-dark.png" alt="Firecrawl" className="h-full w-full object-contain object-left" />
                                </picture>
                                <picture className="hidden h-12 w-full max-w-[13rem] rounded-lg bg-[#171717] p-2 dark:block">
                                    <img src="/firecrawl-light.png" alt="Firecrawl" className="h-full w-full object-contain object-left" />
                                </picture>
                                <p className="mt-5 text-sm font-semibold">Search and fetch without setup.</p>
                                <p className="mt-2 text-xs leading-relaxed text-black/50 dark:text-white/50">Bundled keyless MCP for live web research and page extraction.</p>
                            </article>
                            <article className="group rounded-[1.35rem] border border-black/10 bg-[color:var(--landing-paper)] p-5 transition-[border-color,transform] duration-500 hover:-translate-y-1 hover:border-black/30 dark:border-white/10 dark:hover:border-white/30">
                                <picture className="block h-12 w-full max-w-[13rem] rounded-lg bg-white p-2 dark:hidden">
                                    <img src="/parallel-dark.png" alt="Parallel" className="h-full w-full object-contain object-left" />
                                </picture>
                                <picture className="hidden h-12 w-full max-w-[13rem] rounded-lg bg-[#171717] p-2 dark:block">
                                    <img src="/parallel-light.png" alt="Parallel" className="h-full w-full object-contain object-left" />
                                </picture>
                                <p className="mt-5 text-sm font-semibold">Advanced search, included.</p>
                                <p className="mt-2 text-xs leading-relaxed text-black/50 dark:text-white/50">Bundled MCP search with citations and bounded result counts.</p>
                            </article>
                        </div>
                    </div>
                </section>

                <section id="connect" className="mx-auto w-full max-w-[90rem] px-5 py-24 sm:px-8 md:py-40 lg:px-12">
                    <div data-landing-reveal className="rounded-[1.6rem] bg-[color:var(--landing-ink)] p-7 text-[color:var(--landing-paper)] sm:p-12 md:p-16">
                        <div className="grid gap-12 lg:grid-cols-[1fr_auto] lg:items-end">
                            <div>
                                <p className="max-w-4xl text-[clamp(2.8rem,6vw,6rem)] font-semibold leading-[0.94] tracking-[-0.065em]">Bring the next good question.</p>
                                <p className="mt-7 max-w-xl text-base leading-relaxed text-[color:var(--landing-paper)]/65">Open the real workspace when you are ready. Your chats, providers, tools, and files are waiting on the other side.</p>
                            </div>
                            <Link to="/workspace" className="group inline-flex w-fit items-center gap-2 rounded-full bg-[color:var(--landing-accent)] px-5 py-3 text-sm font-semibold text-[#111111] transition-transform duration-300 hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)]">
                                Open ai.diy
                                <ArrowUpRight className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" size={16} />
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="mx-auto flex w-full max-w-[90rem] flex-col gap-5 border-t border-black/10 px-5 py-7 text-xs text-black/45 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12 dark:border-white/10 dark:text-white/45">
                <span className="font-semibold tracking-[-0.03em] text-[color:var(--landing-ink)]">ai.diy</span>
                <span>Open tools for useful thinking.</span>
                <Link to="/workspace" className="inline-flex items-center gap-1 font-semibold text-[color:var(--landing-ink)] hover:underline">
                    Enter workspace <ArrowRight size={13} />
                </Link>
            </footer>
        </div>
    );
}

export default LandingPage;
