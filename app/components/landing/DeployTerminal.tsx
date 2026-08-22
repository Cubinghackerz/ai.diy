import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CopySimple } from "@phosphor-icons/react";
import { DEPLOY_TABS, VERCEL_DEPLOY_URL, type DeployTabId } from "./constants";
import { Reveal } from "./DoubleBezel";
import { useCopy } from "./hooks";
import { LandingCta } from "./LandingCta";
import { MaskedHeading } from "./MaskedHeading";
import { cn } from "~/lib/utils";

export function DeployTerminal() {
    const [tab, setTab] = useState<DeployTabId>("npm");
    const active = DEPLOY_TABS.find((t) => t.id === tab) ?? DEPLOY_TABS[0];
    const { copied, copy } = useCopy(active.command);
    const tabsRef = useRef<HTMLDivElement>(null);
    const pillRef = useRef<HTMLSpanElement>(null);
    const measuredRef = useRef(false);

    const placePill = useCallback(
        (animate: boolean) => {
            const bar = tabsRef.current;
            const pill = pillRef.current;
            if (!bar || !pill) return;
            const button = bar.querySelector<HTMLElement>(`[data-tab="${tab}"]`);
            if (!button) return;
            const previous = pill.style.transition;
            if (!animate) pill.style.transition = "none";
            pill.style.transform = `translateX(${button.offsetLeft}px)`;
            pill.style.width = `${button.offsetWidth}px`;
            if (!animate) {
                void pill.offsetWidth;
                pill.style.transition = previous;
            }
        },
        [tab],
    );

    useEffect(() => {
        if (!measuredRef.current) {
            placePill(false);
            measuredRef.current = true;
            return;
        }
        placePill(true);
    }, [placePill]);

    useEffect(() => {
        const onResize = () => placePill(false);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [placePill]);

    return (
        <section
            id="deploy"
            className="mx-auto max-w-6xl scroll-mt-28 px-5 pb-28 sm:px-8 sm:pb-36"
            data-anim-gate="deploy"
        >
            <Reveal>
                <div>
                    <MaskedHeading className="text-3xl font-medium tracking-[-0.035em] text-white sm:text-4xl">
                        Self-host in one command.
                    </MaskedHeading>
                    <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-zinc-400">
                        Node production build, Docker Compose, or a Vercel preview. Click
                        the terminal to copy.
                    </p>
                </div>
            </Reveal>

            <Reveal delayMs={40} className="mt-8">
                <div className="overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0a0a0a]">
                    <div
                        ref={tabsRef}
                        role="tablist"
                        aria-label="Deployment method"
                        className="t-tabs flex items-center gap-1 border-b border-white/[0.08] bg-[#0a0a0a] px-2 pt-1.5"
                    >
                        <span ref={pillRef} className="t-tabs-pill" aria-hidden />
                        {DEPLOY_TABS.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                role="tab"
                                data-tab={t.id}
                                aria-selected={tab === t.id}
                                onClick={() => setTab(t.id)}
                                className={cn(
                                    "t-tab min-h-10 rounded-t-lg px-3 py-2 font-mono text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                                )}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() => void copy()}
                        className="group relative block w-full overflow-x-auto bg-black p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/40"
                        aria-label={copied ? "Command copied" : "Copy command"}
                    >
                        <pre className="font-mono text-[12px] leading-relaxed text-zinc-300 sm:text-[13px]">
                            <code>
                                {active.command.split("\n").map((line, index) => (
                                    <span key={`${line}-${index}`} className="block">
                                        <span className="text-zinc-500">$ </span>
                                        {line}
                                    </span>
                                ))}
                                <span aria-hidden className="ml-1 inline-block h-[1.05em] w-[0.55em] translate-y-[0.22em] animate-pulse bg-[var(--landing-mint,#3DFFB0)] motion-reduce:animate-none" />
                            </code>
                        </pre>
                        <span className="absolute right-4 top-4 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/[0.12] bg-black/50 px-2.5 font-mono text-[11px] text-zinc-300">
                            <span
                                className="t-icon-swap"
                                data-state={copied ? "b" : "a"}
                                aria-hidden
                            >
                                <span className="t-icon" data-icon="a">
                                    <CopySimple weight="light" className="size-3.5" />
                                </span>
                                <span className="t-icon" data-icon="b">
                                    <Check weight="bold" className="size-3.5" />
                                </span>
                            </span>
                            {copied ? "Copied" : "Copy"}
                        </span>
                    </button>
                    <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.08] bg-[#0a0a0a] px-3 py-3">
                        <LandingCta href={VERCEL_DEPLOY_URL} external size="compact">
                            Deploy to Vercel
                        </LandingCta>
                        <button
                            type="button"
                            onClick={() => {
                                setTab("docker");
                            }}
                            className="inline-flex min-h-10 items-center rounded-full border border-white/25 bg-white/[0.08] px-4 text-[12px] font-medium text-zinc-100 transition-colors hover:border-white/45 hover:bg-white/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                        >
                            Docker Compose
                        </button>
                    </div>
                </div>
            </Reveal>
        </section>
    );
}
