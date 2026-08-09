import { useState } from "react";
import { Check, CopySimple } from "@phosphor-icons/react";
import { DEPLOY_TABS, type DeployTabId } from "./constants";
import { DoubleBezel, Reveal } from "./DoubleBezel";
import { useCopy } from "./hooks";
import { EASE_OUT } from "./motion";
import { cn } from "~/lib/utils";

export function DeployTerminal() {
    const [tab, setTab] = useState<DeployTabId>("npm");
    const active = DEPLOY_TABS.find((t) => t.id === tab) ?? DEPLOY_TABS[0];
    const { copied, copy } = useCopy(active.command);

    return (
        <section
            id="deploy"
            className="mx-auto max-w-6xl scroll-mt-28 px-5 pb-28 sm:px-8"
            data-anim-gate="deploy"
        >
            <Reveal>
                <h2 className="text-2xl font-medium tracking-tight text-white sm:text-3xl">
                    Deploy in one command
                </h2>
                <p className="mt-2 text-[14px] text-zinc-500">
                    Node production build, Docker Compose, or a Vercel preview.
                </p>
            </Reveal>

            <Reveal delayMs={40} className="mt-8">
                <DoubleBezel
                    outerRadius="rounded-[1.5rem]"
                    innerRadius="rounded-[calc(1.5rem-0.375rem)]"
                    padding="p-1.5"
                >
                    <div className="flex items-center gap-1 border-b border-white/[0.06] bg-black/40 px-2 pt-1.5">
                        {DEPLOY_TABS.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setTab(t.id)}
                                className={cn(
                                    "min-h-10 rounded-t-lg px-3 py-2 font-mono text-[11px] transition-[color,background-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                                    tab === t.id
                                        ? "bg-[#0A0A0A] text-zinc-100"
                                        : "text-zinc-600 hover:text-zinc-400",
                                )}
                                style={{ transitionTimingFunction: EASE_OUT }}
                            >
                                {t.label}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => void copy()}
                            className="ml-auto mb-1 mr-1 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/[0.08] px-3 py-1.5 font-mono text-[11px] text-zinc-400 transition-[border-color,color,transform] duration-200 hover:border-white/20 hover:text-zinc-200 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                            style={{ transitionTimingFunction: EASE_OUT }}
                            aria-label={copied ? "Copied" : "Copy command"}
                        >
                            {copied ? (
                                <Check weight="bold" className="size-3.5" />
                            ) : (
                                <CopySimple weight="light" className="size-3.5" />
                            )}
                            {copied ? "Copied" : "Copy"}
                        </button>
                    </div>
                    <pre className="overflow-x-auto bg-[#0A0A0A] p-5 font-mono text-[12px] leading-relaxed text-zinc-400 sm:text-[13px]">
                        <code>
                            <span className="text-zinc-600">$ </span>
                            {active.command}
                        </code>
                    </pre>
                </DoubleBezel>
            </Reveal>
        </section>
    );
}
