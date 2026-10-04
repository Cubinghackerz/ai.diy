import { SectionLabel } from "./SectionLabel";
import { useState } from "react";
import { Code, FilePy, HardDrives, PlugsConnected } from "@phosphor-icons/react";
import { Reveal } from "./DoubleBezel";
import { MaskedHeading } from "./MaskedHeading";
import { EASE_OUT } from "./motion";
import { StatusPill } from "./StatusPill";
import { cn } from "~/lib/utils";

const TABS = [
    {
        id: "tools" as const,
        label: "Tools",
        icon: PlugsConnected,
        title: "Search, skills, MCP, subagents.",
        body: "DuckDuckGo plus Firecrawl and Parallel MCP ship keyless. URL fetch, calculator, browser Python, on-device knowledge RAG, memory, remote MCP, slash skills, approved subagents, and experimental website presets. Enabled tools have their own service boundaries.",
        chips: ["Keyless search", "Website presets", "Agent Mode"],
    },
    {
        id: "canvas" as const,
        label: "Canvas",
        icon: Code,
        title: "Files beside the thread.",
        body: "Canvas holds text, HTML previews, images, and Python binaries with the chat. Very large binaries may skip IndexedDB and stay downloadable in-session.",
        chips: ["HTML preview", "Images", "Saved with the thread"],
    },
    {
        id: "python" as const,
        label: "Python",
        icon: FilePy,
        title: "Pyodide in the tab.",
        body: "Browser Python runs in the tab. Generated charts and files land in Canvas and persist in IndexedDB with the chat.",
        chips: ["Pyodide", "Canvas capture", "No server runtime"],
    },
    {
        id: "storage" as const,
        label: "Storage",
        icon: HardDrives,
        title: "Optional backup, still client-side.",
        body: "The Local Data Plane above is the storage map. Optional backup to S3, WebDAV, or Google Drive stays client-side and off until you enable it.",
        chips: ["S3", "WebDAV", "Google Drive"],
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
            className="mx-auto max-w-6xl scroll-mt-28 px-5 py-20 sm:px-8 sm:py-28"
            data-anim-gate="capabilities"
        >
            <SectionLabel index="05">Capabilities</SectionLabel>
            <MaskedHeading className="max-w-[18ch] text-3xl font-medium tracking-[-0.035em] text-white sm:text-4xl">
                Create files, presentations, and code with your own models.
            </MaskedHeading>

            <Reveal delayMs={40} className="mt-12">
                <div className="rounded-[2px] border border-white/[0.1] bg-[#0a0a0a]">
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
                                            "inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-[2px] px-3 py-2.5 text-left text-[14px] transition-[background-color,color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 active:scale-[0.98]",
                                            selected
                                                ? "bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(61,255,176,0.25)]"
                                                : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100",
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
                            key={active.id}
                            role="tabpanel"
                            id={`cap-panel-${active.id}`}
                            aria-labelledby={`cap-tab-${active.id}`}
                            className="min-w-0 flex-1 animate-slide-up p-6 sm:p-8"
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
                                <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-[2px] border border-white/[0.1] bg-white/[0.04]">
                                    <Icon weight="light" className="size-5 text-zinc-300" />
                                </span>
                                <div className="min-w-0">
                                    <h3 className="text-xl font-medium tracking-[-0.03em] text-white sm:text-2xl">
                                        {active.title}
                                    </h3>
                                    <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
                                        {active.body}
                                    </p>
                                </div>
                            </div>

                            {active.id === "tools" ? (
                                <div className="mt-8 grid gap-2 sm:grid-cols-3">
                                    {[
                                        { k: "Search", v: "DuckDuckGo, Firecrawl, Parallel" },
                                        { k: "Runtime", v: "Browser Pyodide, Web Speech" },
                                        { k: "Agents", v: "Skills, Subagents, MCP" },
                                    ].map((row) => (
                                        <div
                                            key={row.k}
                                            className="rounded-[2px] border border-white/[0.08] bg-black px-3.5 py-3 transition-[border-color,background-color] duration-200 hover:border-white/[0.14] hover:bg-white/[0.02]"
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

                            {active.id === "canvas" ? (
                                <div className="mt-8 grid gap-2 sm:grid-cols-3">
                                    {[
                                        { k: "Text", v: "Notes and documents" },
                                        { k: "HTML", v: "Preview beside the thread" },
                                        { k: "Binaries", v: "Images and Python output" },
                                    ].map((row) => (
                                        <div
                                            key={row.k}
                                            className="rounded-[2px] border border-white/[0.08] bg-black px-3.5 py-3"
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
                        </div>
                    </div>
                </div>
            </Reveal>
        </section>
    );
}
