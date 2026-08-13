import { useState } from "react";
import { Check, CopySimple } from "@phosphor-icons/react";
import { DEPLOY_TABS, VERCEL_DEPLOY_URL, type DeployTabId } from "./constants";
import { DoubleBezel, Reveal } from "./DoubleBezel";
import { useCopy } from "./hooks";
import { LandingCta } from "./LandingCta";
import { EASE_OUT } from "./motion";
import { cn } from "~/lib/utils";

export function DeployTerminal() {
    const [tab, setTab] = useState<DeployTabId>("npm");
    const active = DEPLOY_TABS.find((t) => t.id === tab) ?? DEPLOY_TABS[0];
    const { copied, copy } = useCopy(active.command);

    return (
        <section
            id="deploy"
            className="mx-auto max-w-6xl scroll-mt-28 px-5 pb-20 sm:px-8 sm:pb-24"
            data-anim-gate="deploy"
        >
            <Reveal>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 className="text-3xl font-medium tracking-[-0.035em] text-white sm:text-4xl">
                            Deploy in one command
                        </h2>
                        <p className="mt-3 text-[15px] leading-relaxed text-zinc-300">
                            Node production build, Docker Compose, or a Vercel preview.
                        </p>
                    </div>
                    <LandingCta href={VERCEL_DEPLOY_URL} external size="compact">
                        Deploy to Vercel
                    </LandingCta>
                </div>
            </Reveal>

            <Reveal delayMs={40} className="mt-8">
                <DoubleBezel
                    outerRadius="rounded-xl"
                    innerRadius="rounded-[10px]"
                    padding="p-1.5"
                >
                    <div className="flex items-center gap-1 border-b border-white/[0.08] bg-[#0e0e11] px-2 pt-1.5">
                        {DEPLOY_TABS.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setTab(t.id)}
                                className={cn(
                                    "min-h-10 rounded-t-lg px-3 py-2 font-mono text-[11px] transition-[color,background-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                                    tab === t.id
                                        ? "bg-[#0A0A0A] text-zinc-100"
                                        : "text-zinc-500 hover:text-zinc-300",
                                )}
                                style={{ transitionTimingFunction: EASE_OUT }}
                            >
                                {t.label}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => void copy()}
                            className="ml-auto mb-1 mr-1 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-white/[0.1] px-3 py-1.5 font-mono text-[11px] text-zinc-400 transition-[border-color,color,transform] duration-200 hover:border-white/20 hover:text-zinc-200 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
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
                    <pre className="overflow-x-auto bg-[#0A0A0A] p-5 font-mono text-[12px] leading-relaxed text-zinc-300 sm:text-[13px]">
                        <code>
                            <span className="text-zinc-500">$ </span>
                            {active.command}
                        </code>
                    </pre>
                </DoubleBezel>
            </Reveal>
        </section>
    );
}
