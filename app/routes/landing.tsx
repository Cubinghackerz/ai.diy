import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useSettings } from "~/lib/providers/SettingsProvider";
import type { ProviderId } from "~/lib/types";
import { ModelLogo } from "~/components/ui/ModelLogo";
import { ArrowRight, ArrowUpRight, Code, Command, Lightning, Lock, Moon, Sun } from "@phosphor-icons/react";

const CONFIG_ITEMS = [
    {
        title: "Your keys, your call",
        body: "Bring provider credentials you control. They stay in this browser and connect directly to the model endpoint you choose.",
        icon: Lock,
    },
    {
        title: "A workspace that remembers",
        body: "Chats, projects, artifacts, and local memory stay close to the work instead of disappearing into a disposable tab.",
        icon: Command,
    },
    {
        title: "Tools when they matter",
        body: "Search, MCP connectors, code, files, and model capabilities meet in one calm surface, ready when the task needs them.",
        icon: Lightning,
    },
];

const WORKSPACE_STEPS = [
    { icon: Command, title: "Start anywhere", body: "A blank thread, a project, a file, or a question. The workspace gives each one somewhere to go." },
    { icon: Lightning, title: "Switch without starting over", body: "Move across models and providers while the conversation keeps its shape." },
    { icon: Code, title: "Leave with something real", body: "Artifacts, exports, memories, and backups make the output useful after the answer ends." },
];

const PROVIDER_MARQUEE: Array<{ id: ProviderId; label: string }> = [
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
            className="inline-flex size-9 items-center justify-center rounded-full border border-[color:var(--landing-hairline)] text-[color:var(--landing-ink)] transition-[background-color,color,transform] duration-300 hover:scale-105 hover:bg-[color:var(--landing-ink)] hover:text-[color:var(--landing-paper)] focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)]"
        >
            {dark ? (
                <Sun size={16} weight="bold" />
            ) : (
                <Moon size={16} weight="bold" />
            )}
        </button>
    );
}

function HeroDiagram() {
    return (
        <div data-hero-diagram className="group relative overflow-hidden rounded-[1.6rem] border border-[color:var(--landing-hairline)] bg-[color:var(--landing-panel)] p-6 text-[color:var(--landing-panel-ink)] shadow-[0_18px_55px_-35px_var(--landing-shadow)] sm:p-8">
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-[color:var(--landing-accent)]/25 blur-[90px] transition-transform duration-1000" />
            <div className="relative z-10 flex flex-col items-center gap-10">
                <p className="text-sm font-medium tracking-[-0.01em] text-[color:var(--landing-panel-dim)]">
                    One workspace. Every useful model.
                </p>

                <div className="relative flex items-center justify-center">
                    <svg viewBox="0 0 560 380" className="h-auto w-[min(100%,560px)]" data-diagram-svg>
                        <defs>
                            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                                <path d="M0 0L10 5L0 10Z" fill="var(--diagram-ink)" />
                            </marker>
                        </defs>

                        <path d="M142 182 L226 190" stroke="var(--diagram-ink)" strokeWidth="1.5" markerEnd="url(#arrow)" data-line data-order="1" />
                        <path d="M334 160 L445 125" stroke="var(--diagram-ink)" strokeWidth="1.5" markerEnd="url(#arrow)" data-line data-order="2" />
                        <path d="M334 220 L445 270" stroke="var(--diagram-ink)" strokeWidth="1.5" markerEnd="url(#arrow)" data-line data-order="3" />

                        <g data-node>
                            <rect x="42" y="150" width="100" height="64" rx="10" fill="var(--diagram-soft)" stroke="var(--diagram-ink)" strokeWidth="1.5" />
                            <circle cx="64" cy="174" r="9" fill="var(--diagram-ink)" />
                            <line x1="84" y1="171" x2="121" y2="171" stroke="var(--diagram-ink)" strokeWidth="3" strokeLinecap="round" />
                            <line x1="84" y1="186" x2="111" y2="186" stroke="var(--diagram-ink)" strokeWidth="3" strokeLinecap="round" />
                            <text x="92" y="246" textAnchor="middle" fill="var(--diagram-ink)" fontSize="11" fontFamily="var(--landing-sans)">Your context</text>
                        </g>

                        <g data-node>
                            <circle cx="310" cy="190" r="54" fill="var(--diagram-ink)" />
                            <text x="310" y="196" textAnchor="middle" fill="var(--diagram-soft)" fontSize="17" fontWeight="700" fontFamily="var(--landing-sans)">
                                ai.diy
                            </text>
                        </g>

                        <g data-node>
                            <circle cx="470" cy="150" r="22" fill="var(--diagram-soft)" stroke="var(--diagram-ink)" strokeWidth="1.5" />
                            <text x="470" y="155" textAnchor="middle" fill="var(--diagram-ink)" fontSize="10" fontWeight="700" fontFamily="var(--landing-sans)">
                                AI
                            </text>
                            <text x="470" y="196" textAnchor="middle" fill="var(--diagram-ink)" fontSize="11" fontFamily="var(--landing-sans)" opacity="0.8">
                                OpenAI
                            </text>
                        </g>

                        <g data-node>
                            <circle cx="470" cy="300" r="22" fill="var(--diagram-soft)" stroke="var(--diagram-ink)" strokeWidth="1.5" />
                            <text x="470" y="305" textAnchor="middle" fill="var(--diagram-ink)" fontSize="10" fontWeight="700" fontFamily="var(--landing-sans)">
                                LM
                            </text>
                            <text x="470" y="348" textAnchor="middle" fill="var(--diagram-ink)" fontSize="11" fontFamily="var(--landing-sans)" opacity="0.8">
                                Ollama
                            </text>
                        </g>
                    </svg>
                </div>

                <div className="flex w-full items-center justify-between border-t border-[color:var(--landing-panel-hairline)] pt-4 text-xs text-[color:var(--landing-panel-dim)]">
                    <span>Your context</span>
                    <ArrowRight size={14} />
                    <span>ai.diy workspace</span>
                    <ArrowRight size={14} />
                    <span>Any model or local endpoint</span>
                </div>
            </div>
        </div>
    );
}

function ProviderMarquee() {
    const row = [...PROVIDER_MARQUEE, ...PROVIDER_MARQUEE];
    return (
        <div aria-hidden="true" className="relative overflow-hidden" style={{ maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)" }}>
            <div className="landing-marquee flex w-max items-center gap-8 py-4">
                {row.map((p, index) => (
                    <span key={`${p.id}-${index}`} className="flex shrink-0 items-center gap-2 text-sm text-[color:var(--landing-ink-dim)]">
                        <span className="flex size-6 items-center justify-center rounded-md bg-[color:var(--landing-ink)]/5">
                            <ModelLogo provider={p.id} size={14} />
                        </span>
                        {p.label}
                    </span>
                ))}
            </div>
        </div>
    );
}

function ProofSection() {
    return (
        <section id="proof" className="mx-auto w-full max-w-[90rem] px-5 py-24 sm:px-8 md:py-32 lg:px-12">
            <h2 data-reveal-text className="max-w-3xl text-balance text-3xl font-medium leading-[1.08] tracking-[-0.03em] sm:text-5xl">
                The interface should disappear. The thinking should not.
            </h2>

            <div className="mt-16 grid gap-x-16 gap-y-12 lg:grid-cols-[1.05fr_0.95fr]">
                <div data-reveal-text className="max-w-xl">
                    <div className="flex items-start gap-4">
                        <ArrowUpRight size={26} weight="bold" className="mt-1 shrink-0 text-[color:var(--landing-accent)]" />
                        <div>
                            <h3 className="text-2xl font-medium tracking-[-0.02em]">Make the model fit the work.</h3>
                            <p className="mt-3 text-base leading-relaxed text-[color:var(--landing-ink-dim)]">
                                Change providers, keep the thread, and stay close to every decision.
                            </p>
                        </div>
                    </div>
                    <div className="mt-8 flex items-center gap-2 border-t border-[var(--landing-hairline)] pt-4 font-[family-name:var(--landing-mono)] text-xs text-[color:var(--landing-ink-dim)]">
                        <span className="text-[color:var(--landing-accent)]">$</span> open next move
                    </div>
                </div>

                <div className="grid gap-8 md:grid-cols-2 md:gap-10">
                    <div data-reveal-text className="md:pt-10">
                        <Code size={26} weight="bold" className="text-[color:var(--landing-accent)]" />
                        <h3 className="mt-5 text-xl font-medium tracking-[-0.02em]">Artifacts that stay attached.</h3>
                        <p className="mt-2 text-sm leading-relaxed text-[color:var(--landing-ink-dim)]">Turn a thought into code, a file, or a working surface without breaking the thread.</p>
                    </div>
                    <div data-reveal-text className="md:pt-24">
                        <Lock size={26} weight="bold" className="text-[color:var(--landing-accent)]" />
                        <h3 className="mt-5 text-xl font-medium tracking-[-0.02em]">Private by posture.</h3>
                        <p className="mt-2 text-sm leading-relaxed text-[color:var(--landing-ink-dim)]">BYOK, local-first storage, and direct connections make the boundary visible.</p>
                    </div>
                </div>
            </div>
        </section>
    );
}

function WorkspaceSection() {
    return (
        <section id="motion" className="border-y border-[var(--landing-hairline)] bg-[color:var(--landing-surface)] px-5 py-24 sm:px-8 md:py-32 lg:px-12">
            <div className="mx-auto w-full max-w-[90rem]">
                <div className="grid gap-10 xl:grid-cols-[0.9fr_1.1fr] xl:items-start xl:gap-20">
                    <div data-reveal-text className="xl:sticky xl:top-24">
                        <h2 className="max-w-md text-3xl font-medium leading-[1.08] tracking-[-0.03em] sm:text-4xl">
                            A workspace with a pulse, not a performance.
                        </h2>
                        <p className="mt-6 max-w-md text-base leading-relaxed text-[color:var(--landing-ink-dim)]">
                            Open a thread, bring your context, and let the useful parts stay close. The details are quiet until you need them.
                        </p>
                    </div>

                    <div className="space-y-3" data-stack>
                        {WORKSPACE_STEPS.map((step) => {
                            const Icon = step.icon;
                            return (
                                <article key={step.title} data-stack-card className="group rounded-2xl border border-[var(--landing-hairline)] bg-[color:var(--landing-paper)] p-6 sm:p-7">
                                    <div className="flex items-start gap-5">
                                        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[color:var(--landing-ink)] text-[color:var(--landing-paper)]">
                                            <Icon size={20} weight="bold" />
                                        </span>
                                        <div>
                                            <h3 className="text-xl font-medium tracking-[-0.02em]">{step.title}</h3>
                                            <p className="mt-2 text-sm leading-relaxed text-[color:var(--landing-ink-dim)]">{step.body}</p>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
}

function ConfigSection() {
    return (
        <section className="mx-auto w-full max-w-[90rem] px-5 py-24 sm:px-8 md:py-32 lg:px-12">
            <h2 data-reveal-text className="max-w-2xl text-balance text-3xl font-medium leading-[1.08] tracking-[-0.03em] sm:text-5xl">
                The setup is yours to shape.
            </h2>

            <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-[var(--landing-hairline)] bg-[var(--landing-hairline)] md:grid-cols-3">
                {CONFIG_ITEMS.map((item) => (
                    <div key={item.title} data-reveal-text className="group flex flex-col bg-[color:var(--landing-paper)] p-6 sm:p-8">
                        <span className="flex size-10 items-center justify-center rounded-lg border border-[var(--landing-hairline)] bg-[color:var(--landing-surface)]">
                            <item.icon size={18} weight="bold" className="text-[color:var(--landing-accent)]" />
                        </span>
                        <h3 className="mt-6 text-lg font-medium tracking-[-0.02em]">{item.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-[color:var(--landing-ink-dim)]">{item.body}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}

function ProvidersSection() {
    return (
        <section id="providers" className="mx-auto w-full max-w-[90rem] px-5 pb-24 pt-4 sm:px-8 lg:px-12">
            <div className="mx-auto max-w-2xl text-center">
                <h2 data-reveal-text className="text-balance text-3xl font-medium leading-[1.08] tracking-[-0.03em] sm:text-4xl">
                    Bring every model into one line of thought.
                </h2>
                <p data-reveal-text className="mt-5 text-base leading-relaxed text-[color:var(--landing-ink-dim)]">
                    Connect the providers you already use, including local models, then move between them on the same thread.
                </p>
            </div>
            <div data-reveal-text className="mt-12">
                <ProviderMarquee />
            </div>
        </section>
    );
}

function SearchSection() {
    return (
        <section id="search" className="border-y border-[var(--landing-hairline)] bg-[color:var(--landing-surface)] px-5 py-24 sm:px-8 md:py-32 lg:px-12">
            <div className="mx-auto grid w-full max-w-[90rem] gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                <div>
                    <h2 data-reveal-text className="max-w-xl text-balance text-3xl font-medium leading-[1.08] tracking-[-0.03em] sm:text-5xl">
                        Web search is free from the start.
                    </h2>
                    <p data-reveal-text className="mt-5 max-w-lg text-base leading-relaxed text-[color:var(--landing-ink-dim)]">
                        ai.diy bundles free hosted web search and page fetch through the MCPs of Firecrawl and Parallel. No search API key is required to begin.
                    </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                    <article data-reveal-text className="group rounded-2xl border border-[var(--landing-hairline)] bg-[color:var(--landing-paper)] p-6 transition-transform duration-300 hover:-translate-y-1">
                        <div className="flex h-12 w-full max-w-[13rem] items-center rounded-lg bg-white p-2 dark:bg-[#171717]">
                            <picture className="block dark:hidden">
                                <img src="/firecrawl-dark.png" alt="Firecrawl" className="h-full max-h-8 w-full object-contain object-left" />
                            </picture>
                            <picture className="hidden dark:block">
                                <img src="/firecrawl-light.png" alt="Firecrawl" className="h-full max-h-8 w-full object-contain object-left" />
                            </picture>
                        </div>
                        <h3 className="mt-5 text-sm font-semibold">Search and fetch without setup.</h3>
                        <p className="mt-2 text-xs leading-relaxed text-[color:var(--landing-ink-dim)]">Bundled keyless MCP for live web research and page extraction.</p>
                    </article>
                    <article data-reveal-text className="group rounded-2xl border border-[var(--landing-hairline)] bg-[color:var(--landing-paper)] p-6 transition-transform duration-300 hover:-translate-y-1">
                        <div className="flex h-12 w-full max-w-[13rem] items-center rounded-lg bg-white p-2 dark:bg-[#171717]">
                            <picture className="block dark:hidden">
                                <img src="/parallel-dark.png" alt="Parallel" className="h-full max-h-8 w-full object-contain object-left" />
                            </picture>
                            <picture className="hidden dark:block">
                                <img src="/parallel-light.png" alt="Parallel" className="h-full max-h-8 w-full object-contain object-left" />
                            </picture>
                        </div>
                        <h3 className="mt-5 text-sm font-semibold">Advanced search, included.</h3>
                        <p className="mt-2 text-xs leading-relaxed text-[color:var(--landing-ink-dim)]">Bundled MCP search with citations and bounded result counts.</p>
                    </article>
                </div>
            </div>
        </section>
    );
}

function CloseSection() {
    return (
        <section id="connect" className="mx-auto w-full max-w-[90rem] px-5 py-24 sm:px-8 md:py-32 lg:px-12">
            <div data-reveal-text className="relative overflow-hidden rounded-[1.6rem] bg-[color:var(--landing-ink)] p-8 text-[color:var(--landing-paper)] sm:p-14 md:p-20">
                <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-16 size-80 rounded-full bg-[color:var(--landing-accent)] opacity-30 blur-[100px]" />
                <div className="relative z-10 flex flex-col items-start gap-10 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                        <h2 className="text-balance text-[clamp(2rem,5vw,4rem)] font-medium leading-[1.02] tracking-[-0.03em]">
                            Bring the next good question.
                        </h2>
                        <p className="mt-6 max-w-xl text-base leading-relaxed text-[color:var(--landing-paper)]/70">
                            Open the real workspace when you are ready. Your chats, providers, tools, and files are waiting on the other side.
                        </p>
                    </div>
                    <Link
                        to="/workspace"
                        className="group inline-flex w-fit items-center gap-2 rounded-full bg-[color:var(--landing-accent)] px-6 py-3.5 text-sm font-semibold text-[color:var(--landing-ink)] transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[color:var(--landing-paper)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--landing-ink)]"
                    >
                        Open ai.diy
                        <ArrowUpRight className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" size={16} />
                    </Link>
                </div>
            </div>
        </section>
    );
}

function LandingPage() {
    const page = useRef<HTMLDivElement>(null);

    useEffect(() => {
        void import("../lib/landing-animations.client").then((m) => m.initLandingAnimations(page.current));
    }, []);

    return (
        <div ref={page} className="landing-page relative w-full overflow-x-hidden bg-[color:var(--landing-paper)] text-[color:var(--landing-ink)]">
            <div aria-hidden="true" dangerouslySetInnerHTML={{ __html: "<!--LANDING-CONTRACT: editorial technical-modernist landing for devs-self-hosters · THESIS: one calm workspace surface where local-first privacy and real work meet; it refuses the AI-hero default of dark-mesh-plus-gradient · OWN-WORLD: neutral paper ground, near-black ink, one committed sky-blue accent with clean one-line connections; hairline discipline instead of card borders; author-drawn diagram-in-progress; mono only for code/data · STORY: visitor understands the local-first workspace at a glance, believes privacy is posture not claim, and opens the workspace · FIRST VIEWPORT: editorial headline left with smooth blur-mask reveal, diagram-of-mechanism right, primary action left · FORM: committed replacement world, seed 7b063ac5 replaced; FORM-ID editorial-modernist · FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md-->" }} />
            <style>{`
                .landing-page {
                    --landing-paper: #f4f4f2;
                    --landing-surface: #ececea;
                    --landing-ink: #111110;
                    --landing-ink-dim: rgba(17, 17, 16, 0.72);
                    --landing-hairline: rgba(17, 17, 16, 0.18);
                    --landing-accent: #0879b5;
                    --landing-panel: #e7edf2;
                    --landing-panel-ink: #111110;
                    --landing-panel-dim: rgba(17, 17, 16, 0.64);
                    --landing-panel-hairline: rgba(17, 17, 16, 0.14);
                    --landing-shadow: rgba(31, 52, 70, 0.24);
                    --landing-mono: "Space Mono", ui-monospace, monospace;
                    --landing-sans: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
                    --diagram-ink: #111110;
                    --diagram-soft: #ffffff;
                    font-family: var(--landing-sans);
                    scroll-behavior: smooth;
                }
                .dark .landing-page {
                    --landing-paper: #101012;
                    --landing-surface: #151518;
                    --landing-ink: #f0f0ee;
                    --landing-ink-dim: rgba(240, 240, 238, 0.72);
                    --landing-hairline: rgba(240, 240, 238, 0.18);
                    --landing-accent: #5bb4e8;
                    --landing-panel: #0c0c0e;
                    --landing-panel-ink: #f0f0ee;
                    --landing-panel-dim: rgba(240, 240, 238, 0.68);
                    --landing-panel-hairline: rgba(240, 240, 238, 0.16);
                    --landing-shadow: rgba(0, 0, 0, 0.45);
                    --diagram-ink: #f0f0ee;
                    --diagram-soft: #101012;
                }
                .landing-page ::selection {
                    background-color: var(--landing-accent);
                    color: #ffffff;
                }
                .dark .landing-page ::selection {
                    color: #101012;
                }
                @media (prefers-reduced-motion: reduce) {
                    .landing-page { scroll-behavior: auto; }
                    .landing-marquee { animation: none; }
                    [data-reveal-text], [data-stack-card] { opacity: 1 !important; transform: none !important; filter: none !important; }
                }
                .landing-marquee {
                    animation: landing-marquee 36s linear infinite;
                }
                @keyframes landing-marquee {
                    from { transform: translateX(0); }
                    to { transform: translateX(-50%); }
                }
            `}</style>

            <nav className="mx-auto flex h-16 w-full max-w-[90rem] items-center justify-between px-5 sm:px-8 lg:px-12">
                <Link to="/" aria-label="ai.diy home" className="flex items-center">
                    <img src="/ai-diy.png" alt="ai.diy" className="h-8 w-24 object-contain" />
                </Link>
                <div className="hidden items-center gap-8 text-sm font-medium text-[color:var(--landing-ink-dim)] md:flex">
                    <a href="#proof" className="transition-colors hover:text-[color:var(--landing-ink)]">Why it works</a>
                    <a href="#motion" className="transition-colors hover:text-[color:var(--landing-ink)]">Inside the workspace</a>
                    <a href="#connect" className="transition-colors hover:text-[color:var(--landing-ink)]">Connect</a>
                </div>
                <div className="flex items-center gap-2.5">
                    <ThemeToggle />
                    <Link to="/workspace" className="hidden text-sm font-semibold text-[color:var(--landing-ink)] transition-colors hover:text-[color:var(--landing-accent)] sm:inline-flex">
                        Workspace
                    </Link>
                </div>
            </nav>

            <main>
                <section className="mx-auto grid w-full max-w-[90rem] items-center gap-12 px-5 pb-20 pt-16 sm:px-8 md:pb-28 md:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-12">
                    <div>
                        <h1 data-reveal-text className="max-w-xl text-balance text-[clamp(2.6rem,5.5vw,5rem)] font-medium leading-[1.02] tracking-[-0.035em]">
                            Think clearly.<br />Build openly.
                        </h1>
                        <p data-reveal-text className="mt-8 max-w-md text-[17px] leading-relaxed text-[color:var(--landing-ink-dim)]">
                            A local-first AI workspace for people who want the model to meet the moment, not the other way around.
                        </p>
                        <div data-reveal-text className="mt-9 flex flex-wrap items-center gap-3">
                            <Link
                                to="/workspace"
                                className="group inline-flex items-center gap-2 rounded-full bg-[color:var(--landing-ink)] px-6 py-3.5 text-sm font-semibold text-[color:var(--landing-paper)] transition-transform duration-300 hover:scale-[1.03] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--landing-paper)]"
                            >
                                Start in the workspace
                                <ArrowRight className="transition-transform duration-300 group-hover:translate-x-1" size={16} />
                            </Link>
                            <a href="#search" className="inline-flex items-center gap-2 rounded-full border border-[var(--landing-hairline)] px-6 py-3.5 text-sm font-semibold transition-colors hover:border-[color:var(--landing-ink)]/50">
                                Explore free search
                            </a>
                        </div>
                    </div>

                    <HeroDiagram />
                </section>

                <ProofSection />
                <WorkspaceSection />
                <ConfigSection />
                <ProvidersSection />
                <SearchSection />
                <CloseSection />
            </main>

            <footer className="mx-auto flex w-full max-w-[90rem] flex-col gap-4 border-t border-[var(--landing-hairline)] px-5 py-8 text-[13px] text-[color:var(--landing-ink-dim)] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
                <span className="font-semibold tracking-[-0.02em] text-[color:var(--landing-ink)]">ai.diy</span>
                <span>Open tools for useful thinking.</span>
                <Link to="/workspace" className="inline-flex items-center gap-1.5 font-semibold text-[color:var(--landing-ink)] hover:underline">
                    Enter workspace <ArrowRight size={13} />
                </Link>
            </footer>
        </div>
    );
}

export default LandingPage;
