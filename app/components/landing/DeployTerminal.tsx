import { useState } from "react";
import { Check, CopySimple } from "@phosphor-icons/react";
import { DEPLOY_TABS, VERCEL_DEPLOY_URL, type DeployTabId } from "./constants";
import { useCopy } from "./hooks";
import { LandingCta } from "./LandingCta";
import { Reveal } from "./Reveal";
import { SectionHeader } from "./SectionHeader";
import { cn } from "~/lib/utils";

export function DeployTerminal() {
    const [tab, setTab] = useState<DeployTabId>("npm");
    const active = DEPLOY_TABS.find((item) => item.id === tab) ?? DEPLOY_TABS[0];
    const { copied, copy } = useCopy(active.command);

    return (
        <section
            id="deploy"
            className="mx-auto max-w-6xl scroll-mt-14 px-6 py-24 sm:py-32"
            data-anim-gate="deploy"
        >
            <SectionHeader title="Self-host in one command.">
                A Node production build, Docker Compose, or a Vercel preview.
            </SectionHeader>

            <Reveal delayMs={40} className="mt-12">
                <div className="overflow-hidden rounded-[6px] border border-white/[0.1] bg-[#0a0a0a]">
                    <div
                        role="tablist"
                        aria-label="Deployment method"
                        className="flex items-center gap-1 border-b border-white/[0.08] px-2"
                    >
                        {DEPLOY_TABS.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                role="tab"
                                aria-selected={tab === item.id}
                                onClick={() => setTab(item.id)}
                                className={cn(
                                    "-mb-px h-11 border-b-2 px-3 font-mono text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/40",
                                    tab === item.id
                                        ? "border-white text-white"
                                        : "border-transparent text-zinc-400 hover:text-zinc-200",
                                )}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() => void copy()}
                        className="relative block w-full overflow-x-auto bg-black p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/40"
                    >
                        <span className="sr-only">{copied ? "Copied. " : "Copy command. "}</span>
                        <pre className="font-mono text-[13px] leading-relaxed text-zinc-300">
                            <code>
                                {active.command.split("\n").map((line, index) => (
                                    <span key={`${line}-${index}`} className="block">
                                        <span className="text-zinc-500">$ </span>
                                        {line}
                                    </span>
                                ))}
                            </code>
                        </pre>
                        <span className="absolute right-4 top-4 inline-flex h-8 items-center gap-1.5 rounded-[4px] border border-white/[0.12] bg-black/60 px-2.5 font-mono text-[11px] text-zinc-300">
                            {copied ? (
                                <Check weight="bold" className="size-3.5" />
                            ) : (
                                <CopySimple weight="light" className="size-3.5" />
                            )}
                            {copied ? "Copied" : "Copy"}
                        </span>
                    </button>
                    <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.08] px-3 py-3">
                        <LandingCta href={VERCEL_DEPLOY_URL} external size="compact">
                            Deploy to Vercel
                        </LandingCta>
                        <button
                            type="button"
                            onClick={() => setTab("docker")}
                            className="inline-flex h-9 items-center rounded-[6px] border border-white/[0.16] px-3.5 text-[13px] font-medium text-zinc-100 transition-colors hover:border-white/30 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                        >
                            Docker Compose
                        </button>
                    </div>
                </div>
            </Reveal>
        </section>
    );
}
