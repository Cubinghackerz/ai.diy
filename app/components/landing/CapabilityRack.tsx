import { useState } from "react";
import {
    HardDrives,
    PlugsConnected,
    TerminalWindow,
} from "@phosphor-icons/react";
import { BlueprintFrame, StatusPill } from "./BlueprintFrame";
import { Reveal } from "./DoubleBezel";
import { EASE_OUT } from "./motion";
import { cn } from "~/lib/utils";

const TABS = [
    {
        id: "tools" as const,
        label: "Tools",
        icon: PlugsConnected,
        title: "Search, skills, MCP, subagents.",
        body: "DuckDuckGo plus Firecrawl and Parallel MCP ship keyless. URL fetch, calculator, browser Python, on-device knowledge RAG, memory, remote MCP, slash skills, approved subagents, and experimental website presets.",
        chips: ["Keyless search", "Website presets", "Agent Mode"],
    },
    {
        id: "storage" as const,
        label: "Storage",
        icon: HardDrives,
        title: "Your browser is the database.",
        body: "Chats, Canvas artifacts, memory, knowledge chunks, usage events, and preview sessions live in IndexedDB. Settings and keys stay in localStorage. Optional client-side backup to S3, WebDAV, or Google Drive.",
        chips: ["IndexedDB", "No vendor vector DB", "Export anytime"],
    },
    {
        id: "deploy" as const,
        label: "Deploy",
        icon: TerminalWindow,
        title: "Node or Docker. No LLM env vars.",
        body: "Self-host on a standard Node server or Docker Compose. The relay never needs provider credentials. Optional RATE_LIMIT_RPM for public exposure. MIT licensed.",
        chips: ["npm start", "docker compose", "MIT"],
    },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function CapabilityRack() {
    const [tab, setTab] = useState<TabId>("tools");
    const active = TABS.find((t) => t.id === tab) ?? TABS[0];
    const Icon = active.icon;

    return (
        <section
            id="capabilities"
            className="mx-auto max-w-6xl scroll-mt-28 px-5 py-20 sm:px-8 sm:py-24"
            data-anim-gate="capabilities"
        >
            <Reveal>
                <h2 className="max-w-[18ch] text-3xl font-medium tracking-[-0.035em] text-white sm:text-4xl">
                    Tools and storage for a self-hosted AI workspace.
                </h2>
                <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-zinc-300">
                    Dense capability without a wall of feature cards — open a lane and inspect the mechanism.
                </p>
            </Reveal>

            <Reveal delayMs={40} className="mt-10">
                <BlueprintFrame label="CAPABILITY RACK" className="rounded-xl" pad={false}>
                    <div className="flex min-h-[24rem] flex-col md:flex-row">
                        <div
                            role="tablist"
                            aria-label="Capability lanes"
                            className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/[0.08] p-3 md:w-56 md:flex-col md:border-b-0 md:border-r md:overflow-visible"
                        >
                            {TABS.map((t) => {
                                const TabIcon = t.icon;
                                const selected = t.id === tab;
                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={selected}
                                        id={`cap-tab-${t.id}`}
                                        aria-controls={`cap-panel-${t.id}`}
                                        onClick={() => setTab(t.id)}
                                        className={cn(
                                            "inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[14px] transition-[background-color,color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 active:scale-[0.98]",
                                            selected
                                                ? "bg-white/[0.1] text-white"
                                                : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100",
                                        )}
                                        style={{ transitionTimingFunction: EASE_OUT }}
                                    >
                                        <TabIcon weight="light" className="size-5 shrink-0" />
                                        {t.label}
                                    </button>
                                );
                            })}
                        </div>

                        <div
                            role="tabpanel"
                            id={`cap-panel-${active.id}`}
                            aria-labelledby={`cap-tab-${active.id}`}
                            className="min-w-0 flex-1 p-6 sm:p-8"
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <StatusPill tone="live" pulse>
                                    Active lane
                                </StatusPill>
                                {active.chips.map((chip) => (
                                    <StatusPill key={chip}>{chip}</StatusPill>
                                ))}
                            </div>

                            <div className="mt-6 flex items-start gap-4">
                                <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04]">
                                    <Icon weight="light" className="size-5 text-zinc-300" />
                                </span>
                                <div className="min-w-0">
                                    <h3 className="text-xl font-medium tracking-[-0.03em] text-white sm:text-2xl">
                                        {active.title}
                                    </h3>
                                    <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-zinc-300">
                                        {active.body}
                                    </p>
                                </div>
                            </div>

                            {active.id === "tools" ? (
                                <div className="mt-8 grid gap-2 sm:grid-cols-3">
                                    {[
                                        { k: "Search", v: "DuckDuckGo · Firecrawl · Parallel" },
                                        { k: "Runtime", v: "Browser Pyodide · Web Speech" },
                                        { k: "Agents", v: "Skills · Subagents · MCP" },
                                    ].map((row) => (
                                        <div
                                            key={row.k}
                                            className="rounded-lg border border-white/[0.08] bg-black/40 px-3.5 py-3"
                                        >
                                            <p className="font-mono text-[10px] tracking-wide text-zinc-500">
                                                {row.k}
                                            </p>
                                            <p className="mt-1.5 text-[12px] leading-snug text-zinc-300">
                                                {row.v}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : null}

                            {active.id === "storage" ? (
                                <pre className="mt-8 overflow-x-auto rounded-lg border border-white/[0.08] bg-[#0e0e11] p-4 font-mono text-[11px] leading-relaxed text-zinc-400 sm:text-[12px]">
                                    <code>
                                        {`browser/
  localStorage  → settings, provider keys
  IndexedDB     → threads, canvas, memory,
                  knowledge, usage ledger
server/
  /api/*        → relay only · no LLM secrets`}
                                    </code>
                                </pre>
                            ) : null}

                            {active.id === "deploy" ? (
                                <pre className="mt-8 overflow-x-auto rounded-lg border border-white/[0.08] bg-[#0e0e11] p-4 font-mono text-[12px] leading-relaxed text-zinc-400">
                                    <code>
                                        <span className="text-zinc-500">$ </span>
                                        npm run build && npm start
                                        {"\n"}
                                        <span className="text-zinc-500">$ </span>
                                        docker compose up --build
                                    </code>
                                </pre>
                            ) : null}
                        </div>
                    </div>
                </BlueprintFrame>
            </Reveal>
        </section>
    );
}
