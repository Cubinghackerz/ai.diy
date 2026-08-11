/**
 * THESIS: Ownership is an inspectable system, not a privacy slogan; refuse the generic AI glow-card stack.
 * OWN-WORLD: Void-black technical substrate, Inter architecture, keycap frames, and rationed flux signals.
 * STORY: Bring keys, see the browser-first trust boundary, inspect the workspace, then open or self-host it.
 * FIRST VIEWPORT: Floating instrument nav above a 72px headline, cinematic flux field, and working prompt launcher.
 * FORM: Midnight Flux command-center blueprint, brief-pinned replacement world, seed MIDNIGHT-FLUX-2026.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
 */
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router";
import {
    ArrowRight,
    ArrowUpRight,
    Brain,
    Check,
    ClipboardText,
    CloudArrowUp,
    Code,
    Database,
    GithubLogo,
    HardDrives,
    Key,
    Lightning,
    List,
    MagnifyingGlass,
    Play,
    PlugsConnected,
    ShieldCheck,
    Sparkle,
    X,
} from "@phosphor-icons/react";
import {
    DEPLOY_TABS,
    DOCS_URL,
    GITHUB_URL,
    PROVIDER_LOGOS,
    TWITTER_URL,
    VERCEL_DEPLOY_URL,
    type DeployTabId,
} from "./constants";
import { formatStars, useCopy, useGithubStars } from "./hooks";

const PROMPTS = [
    "Compare three models",
    "Research with sources",
    "Build a Canvas artifact",
] as const;

const NAV_LINKS = [
    { href: "#workspace", label: "Workspace" },
    { href: "#architecture", label: "Local-first" },
    { href: "#capabilities", label: "Capabilities" },
    { href: "#deploy", label: "Deploy" },
] as const;

const CAPABILITIES = [
    {
        icon: MagnifyingGlass,
        title: "Research that can act",
        copy: "Keyless search, URL fetch, remote MCP, slash skills, and approved subagents stay in the same thread.",
        meta: "DuckDuckGo / Firecrawl / Parallel",
    },
    {
        icon: Code,
        title: "Artifacts, not attachments",
        copy: "Run Python in-browser with Pyodide. Keep generated images, binaries, text, and HTML previews with the conversation.",
        meta: "Canvas / Pyodide / IndexedDB",
    },
    {
        icon: Brain,
        title: "Private context",
        copy: "Memory and on-device knowledge search use browser storage and WASM embeddings, without a vendor vector database.",
        meta: "Local RAG / HNSW / WASM",
    },
] as const;

function BrandMark() {
    return (
        <span className="mf-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 22 22" fill="none">
                <path d="M3 6.5 11 2l8 4.5v9L11 20l-8-4.5v-9Z" />
                <path d="m3.5 6.8 7.5 4.3 7.5-4.3M11 11.2V20" />
            </svg>
        </span>
    );
}

function FluxButton({ compact = false }: { compact?: boolean }) {
    return (
        <Link to="/workspace" className={compact ? "mf-button mf-button--compact" : "mf-button"}>
            <span>{compact ? "Open" : "Open workspace"}</span>
            <ArrowUpRight weight="bold" aria-hidden="true" />
        </Link>
    );
}

function Navigation() {
    const [open, setOpen] = useState(false);
    const menuId = useId();

    return (
        <header className="mf-nav-wrap">
            <nav className="mf-nav" aria-label="Primary navigation">
                <Link to="/" className="mf-brand" aria-label="ai.diy home">
                    <BrandMark />
                    <span>ai.diy</span>
                </Link>

                <div className="mf-nav-links">
                    {NAV_LINKS.map((link) => (
                        <a key={link.href} href={link.href}>
                            {link.label}
                        </a>
                    ))}
                    <a href={DOCS_URL} target="_blank" rel="noreferrer">
                        Docs
                    </a>
                </div>

                <div className="mf-nav-actions">
                    <a
                        className="mf-icon-button mf-nav-github"
                        href={GITHUB_URL}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="View ai.diy on GitHub"
                    >
                        <GithubLogo weight="regular" />
                    </a>
                    <FluxButton compact />
                    <button
                        type="button"
                        className="mf-icon-button mf-menu-button"
                        aria-expanded={open}
                        aria-controls={menuId}
                        aria-label={open ? "Close navigation" : "Open navigation"}
                        onClick={() => setOpen((value) => !value)}
                    >
                        {open ? <X weight="regular" /> : <List weight="regular" />}
                    </button>
                </div>
            </nav>

            <div id={menuId} className="mf-mobile-menu" data-open={open || undefined} hidden={!open}>
                {NAV_LINKS.map((link) => (
                    <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
                        {link.label}
                        <ArrowRight aria-hidden="true" />
                    </a>
                ))}
                <a href={DOCS_URL} target="_blank" rel="noreferrer">
                    Documentation
                    <ArrowUpRight aria-hidden="true" />
                </a>
            </div>
        </header>
    );
}

function Hero() {
    const [prompt, setPrompt] = useState("");
    const navigate = useNavigate();
    const stars = useGithubStars();

    return (
        <section className="mf-hero" aria-labelledby="midnight-title">
            <div className="mf-flux-field" aria-hidden="true">
                <span className="mf-flux mf-flux--orange" />
                <span className="mf-flux mf-flux--iris" />
                <span className="mf-flux mf-flux--cyan" />
                <span className="mf-flux-cut" />
            </div>

            <div className="mf-hero-content">
                <h1 id="midnight-title">Bring your own keys.</h1>
                <p className="mf-hero-copy">
                    One local-first AI workspace for cloud and local models. Your chats, tools,
                    knowledge, and artifacts live in your browser. Your server stores no LLM
                    credentials.
                </p>

                <form
                    className="mf-prompt"
                    onSubmit={(event) => {
                        event.preventDefault();
                        const value = prompt.trim();
                        navigate(value ? `/workspace?prompt=${encodeURIComponent(value)}` : "/workspace");
                    }}
                >
                    <label htmlFor="hero-prompt" className="mf-sr-only">
                        What do you want to work on?
                    </label>
                    <Sparkle weight="regular" aria-hidden="true" />
                    <input
                        id="hero-prompt"
                        value={prompt}
                        onChange={(event) => setPrompt(event.target.value)}
                        placeholder="What do you want to work on?"
                        autoComplete="off"
                    />
                    <button type="submit" aria-label="Open workspace">
                        <ArrowUpRight weight="bold" />
                    </button>
                </form>

                <div className="mf-suggestions" aria-label="Prompt suggestions">
                    {PROMPTS.map((suggestion) => (
                        <button key={suggestion} type="button" onClick={() => setPrompt(suggestion)}>
                            {suggestion}
                        </button>
                    ))}
                </div>

                <div className="mf-meta-strip" aria-label="Product details">
                    <span>LOCAL-FIRST</span>
                    <i aria-hidden="true">|</i>
                    <span>17 PROVIDERS</span>
                    <i aria-hidden="true">|</i>
                    <span>MIT LICENSE</span>
                    <i aria-hidden="true">|</i>
                    <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                        {stars == null ? "GITHUB" : `${formatStars(stars)} STARS`}
                    </a>
                </div>
            </div>

            <a className="mf-hero-scroll" href="#workspace">
                <span>Inspect the system</span>
                <span className="mf-scroll-line" aria-hidden="true" />
            </a>
        </section>
    );
}

function WorkspaceArtifact() {
    return (
        <section id="workspace" className="mf-section mf-workspace" aria-labelledby="workspace-title">
            <div className="mf-section-heading">
                <h2 id="workspace-title">Every provider. One continuous thread.</h2>
                <p>
                    Switch providers mid-conversation without moving the work. Search, reason,
                    generate, run tools, and collect the output in Canvas.
                </p>
            </div>

            <div className="mf-product-frame">
                <div className="mf-frame-bar">
                    <div className="mf-window-controls" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                    </div>
                    <span>ai.diy / workspace</span>
                    <span className="mf-frame-status">
                        <i aria-hidden="true" /> local session
                    </span>
                </div>
                <div className="mf-product-layout">
                    <aside className="mf-mock-sidebar" aria-label="Workspace preview navigation">
                        <BrandMark />
                        <span className="mf-mock-line mf-mock-line--strong" />
                        <span className="mf-mock-line" />
                        <span className="mf-mock-line" />
                        <span className="mf-mock-line mf-mock-line--short" />
                        <div className="mf-mock-spacer" />
                        <span className="mf-mock-line" />
                    </aside>

                    <div className="mf-thread-preview">
                        <div className="mf-thread-topline">
                            <span>Research session</span>
                            <span>Claude 4.5 Sonnet</span>
                        </div>
                        <div className="mf-thread-body">
                            <div className="mf-user-message">
                                Compare local-first RAG architectures, then diagram the tradeoffs.
                            </div>
                            <div className="mf-tool-row">
                                <MagnifyingGlass weight="regular" />
                                <div>
                                    <strong>Web research</strong>
                                    <span>8 sources inspected</span>
                                </div>
                                <Check weight="bold" />
                            </div>
                            <div className="mf-response-lines" aria-hidden="true">
                                <span />
                                <span />
                                <span />
                                <span />
                            </div>
                            <div className="mf-composer-preview">
                                <span>Continue the thread...</span>
                                <ArrowUpRight weight="bold" />
                            </div>
                        </div>
                    </div>

                    <aside className="mf-canvas-preview">
                        <div className="mf-canvas-heading">
                            <span>Canvas</span>
                            <span>live artifact</span>
                        </div>
                        <div className="mf-diagram">
                            <span className="mf-diagram-node mf-diagram-node--active">Browser</span>
                            <span className="mf-diagram-link" aria-hidden="true" />
                            <span className="mf-diagram-node">WASM</span>
                            <span className="mf-diagram-link" aria-hidden="true" />
                            <span className="mf-diagram-node">Index</span>
                        </div>
                        <div className="mf-canvas-code">
                            <span>artifact.rag-map</span>
                            <span>saved with thread</span>
                        </div>
                    </aside>
                </div>
                <div className="mf-demo-link">
                    <Play weight="fill" aria-hidden="true" />
                    <a href="/AI-DIY_DEMO.mp4" target="_blank" rel="noreferrer">
                        Watch the real workspace demo
                    </a>
                    <span>02:12</span>
                </div>
            </div>

            <div className="mf-provider-rail" aria-label="Featured model providers">
                <span className="mf-provider-label">BRING THE PROVIDERS YOU USE</span>
                <div>
                    {PROVIDER_LOGOS.map((provider) => (
                        <span key={provider.id} className="mf-provider-mark" title={provider.label}>
                            <img src={provider.src} alt={provider.label} width={28} height={28} loading="lazy" />
                        </span>
                    ))}
                </div>
            </div>
        </section>
    );
}

function Architecture() {
    return (
        <section
            id="architecture"
            className="mf-section mf-architecture"
            aria-labelledby="architecture-title"
        >
            <div className="mf-section-heading mf-section-heading--split">
                <h2 id="architecture-title">The trust boundary is visible.</h2>
                <p>
                    Keys live in browser settings and travel through your configured relay only
                    for each request. Chats, memory, knowledge, and artifacts stay in browser
                    storage.
                </p>
            </div>

            <div className="mf-architecture-frame">
                <div className="mf-arch-column mf-arch-column--browser">
                    <div className="mf-arch-label">
                        <HardDrives weight="regular" />
                        <span>Your browser</span>
                    </div>
                    <h3>The stateful side</h3>
                    <ul>
                        <li><Database weight="regular" /> IndexedDB: threads, Canvas, memory</li>
                        <li><Key weight="regular" /> localStorage: settings and provider keys</li>
                        <li><Brain weight="regular" /> WASM: embeddings and local knowledge</li>
                    </ul>
                    <span className="mf-status-tag">PERSISTS LOCALLY</span>
                </div>

                <div className="mf-relay-column">
                    <span className="mf-relay-flow mf-relay-flow--left" aria-hidden="true" />
                    <div className="mf-relay-core">
                        <ShieldCheck weight="regular" />
                        <span>Node relay</span>
                        <strong>NO STORED KEYS</strong>
                    </div>
                    <span className="mf-relay-flow mf-relay-flow--right" aria-hidden="true" />
                    <p>Credentials are proxied in transit. Your host can observe request traffic.</p>
                </div>

                <div className="mf-arch-column mf-arch-column--providers">
                    <div className="mf-arch-label">
                        <PlugsConnected weight="regular" />
                        <span>Your providers</span>
                    </div>
                    <h3>The replaceable side</h3>
                    <div className="mf-provider-stack">
                        <span>Cloud APIs</span>
                        <span>Ollama / LM Studio</span>
                        <span>Custom compatible</span>
                    </div>
                    <span className="mf-status-tag mf-status-tag--flux">SWAP MID-THREAD</span>
                </div>
            </div>

            <p className="mf-security-note">
                Settings are not encrypted at rest today. Private-network URLs and redirects are
                rejected; server rate limits are available for public deployments.
            </p>
        </section>
    );
}

function CapabilityGallery() {
    return (
        <section
            id="capabilities"
            className="mf-section mf-capabilities"
            aria-labelledby="capabilities-title"
        >
            <div className="mf-section-heading">
                <h2 id="capabilities-title">A command center, not another chat wrapper.</h2>
                <p>
                    The useful parts of an AI workflow sit together, with technical detail where
                    you need it and no account wall between you and your models.
                </p>
            </div>

            <div className="mf-capability-grid">
                <article className="mf-capability-main">
                    <div className="mf-capability-title">
                        <Lightning weight="regular" />
                        <div>
                            <h3>Tools move through one thread</h3>
                            <p>Inspect every call, result, artifact, and handoff.</p>
                        </div>
                    </div>
                    <div className="mf-trace">
                        <div className="mf-trace-row">
                            <span>01</span>
                            <MagnifyingGlass weight="regular" />
                            <strong>research.search</strong>
                            <em>8 results</em>
                        </div>
                        <div className="mf-trace-row mf-trace-row--selected">
                            <span>02</span>
                            <Code weight="regular" />
                            <strong>python.execute</strong>
                            <em>chart.png</em>
                        </div>
                        <div className="mf-trace-row">
                            <span>03</span>
                            <CloudArrowUp weight="regular" />
                            <strong>canvas.persist</strong>
                            <em>IndexedDB</em>
                        </div>
                    </div>
                    <span className="mf-synthetic-label">ILLUSTRATIVE WORKFLOW</span>
                </article>

                <article className="mf-model-switcher">
                    <div>
                        <Brain weight="regular" />
                        <span>Model routing</span>
                    </div>
                    <h3>Change the engine. Keep the work.</h3>
                    <div className="mf-model-list">
                        <span className="mf-model-active">Anthropic <Check weight="bold" /></span>
                        <span>OpenAI</span>
                        <span>Gemini</span>
                        <span>Local Ollama</span>
                    </div>
                </article>

                <div className="mf-capability-list">
                    {CAPABILITIES.map((capability) => {
                        const Icon = capability.icon;
                        return (
                            <article key={capability.title}>
                                <Icon weight="regular" />
                                <div>
                                    <h3>{capability.title}</h3>
                                    <p>{capability.copy}</p>
                                    <span>{capability.meta}</span>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

function Deploy() {
    const [tab, setTab] = useState<DeployTabId>("npm");
    const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const active = DEPLOY_TABS.find((candidate) => candidate.id === tab) ?? DEPLOY_TABS[0];
    const { copied, copy, copyError } = useCopy(active.command);

    const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        let next = index;
        if (event.key === "ArrowLeft") next = (index - 1 + DEPLOY_TABS.length) % DEPLOY_TABS.length;
        if (event.key === "ArrowRight") next = (index + 1) % DEPLOY_TABS.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = DEPLOY_TABS.length - 1;
        setTab(DEPLOY_TABS[next].id);
        tabRefs.current[next]?.focus();
    };

    return (
        <section id="deploy" className="mf-section mf-deploy" aria-labelledby="deploy-title">
            <div className="mf-deploy-copy">
                <h2 id="deploy-title">Your infrastructure. One deliberate command.</h2>
                <p>
                    Run the production build on Node, use Docker Compose, or open a Vercel preview.
                    The relay needs no provider credentials in its environment.
                </p>
                <div className="mf-deploy-actions">
                    <FluxButton />
                    <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="mf-text-link">
                        Read the source <ArrowUpRight weight="bold" />
                    </a>
                </div>
            </div>

            <div className="mf-terminal">
                <div className="mf-terminal-tabs" role="tablist" aria-label="Deployment commands">
                    {DEPLOY_TABS.map((candidate, index) => (
                        <button
                            key={candidate.id}
                            ref={(element) => {
                                tabRefs.current[index] = element;
                            }}
                            id={`mf-deploy-tab-${candidate.id}`}
                            type="button"
                            role="tab"
                            aria-selected={candidate.id === tab}
                            aria-controls="mf-deploy-panel"
                            tabIndex={candidate.id === tab ? 0 : -1}
                            onClick={() => setTab(candidate.id)}
                            onKeyDown={(event) => onTabKeyDown(event, index)}
                        >
                            {candidate.label}
                        </button>
                    ))}
                    <button
                        type="button"
                        className="mf-copy-button"
                        onClick={() => void copy()}
                        aria-label={copied ? "Command copied" : "Copy command"}
                    >
                        {copied ? <Check weight="bold" /> : <ClipboardText weight="regular" />}
                        <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                </div>
                <pre
                    id="mf-deploy-panel"
                    role="tabpanel"
                    aria-labelledby={`mf-deploy-tab-${active.id}`}
                >
                    <code>
                        <span>$</span> {active.command}
                    </code>
                </pre>
                <div className="mf-terminal-foot">
                    <span>NODE 20+</span>
                    <span>{active.id === "vercel" ? "PREVIEW DEPLOY" : "SELF-HOSTED"}</span>
                </div>
                <p className="mf-sr-only" aria-live="polite">
                    {copied ? "Deployment command copied." : copyError ? "Unable to copy the command." : ""}
                </p>
            </div>
        </section>
    );
}

function Closing() {
    return (
        <section className="mf-closing" aria-labelledby="closing-title">
            <div className="mf-closing-flux" aria-hidden="true" />
            <div>
                <h2 id="closing-title">The keys are yours. So is the workspace.</h2>
                <p>Open the app, connect a provider, and keep the rest under your control.</p>
            </div>
            <FluxButton />
        </section>
    );
}

function Footer() {
    return (
        <footer className="mf-footer">
            <div className="mf-footer-brand">
                <BrandMark />
                <div>
                    <strong>ai.diy</strong>
                    <span>Open tools for useful thinking.</span>
                </div>
            </div>
            <div className="mf-footer-links">
                <a href={DOCS_URL} target="_blank" rel="noreferrer">Docs</a>
                <a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>
                <a href={TWITTER_URL} target="_blank" rel="noreferrer">X</a>
                <Link to="/privacy">Privacy</Link>
                <Link to="/terms">Terms</Link>
            </div>
            <div className="mf-footer-meta">
                <span>MIT LICENSE</span>
                <span>LOCAL-FIRST</span>
                <span>2026</span>
            </div>
        </footer>
    );
}

export function MidnightLanding() {
    return (
        <div className="mf-page" data-design-seed="MIDNIGHT-FLUX-2026">
            <a className="mf-skip-link" href="#main-content">Skip to content</a>
            <Navigation />
            <main id="main-content">
                <Hero />
                <WorkspaceArtifact />
                <Architecture />
                <CapabilityGallery />
                <Deploy />
                <Closing />
            </main>
            <Footer />
        </div>
    );
}
