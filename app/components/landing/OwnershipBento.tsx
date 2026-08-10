import { useRef, type PointerEvent, type ReactNode } from "react";
import {
    HardDrives,
    Key,
    MagnifyingGlass,
    ArrowsLeftRight,
    Stack,
} from "@phosphor-icons/react";
import { BlueprintFrame, StatusPill } from "./BlueprintFrame";
import { Reveal } from "./DoubleBezel";
import { PROVIDER_LOGOS } from "./constants";
import { EASE_OUT } from "./motion";
import { cn } from "~/lib/utils";

function LitShell({
    children,
    className,
    span,
}: {
    children: ReactNode;
    className?: string;
    span?: string;
}) {
    const ref = useRef<HTMLElement>(null);
    const onMove = (e: PointerEvent) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${((e.clientX - rect.left) / rect.width) * 100}%`);
        el.style.setProperty("--my", `${((e.clientY - rect.top) / rect.height) * 100}%`);
    };

    return (
        <article
            ref={ref}
            onPointerMove={onMove}
            className={cn(
                "group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0A0A0A] p-5 transition-[border-color] duration-200 sm:p-6",
                "before:pointer-events-none before:absolute before:inset-0 before:opacity-0 before:transition-opacity before:duration-200 before:content-[''] group-hover:before:opacity-100",
                "before:bg-[radial-gradient(420px_circle_at_var(--mx,50%)_var(--my,50%),rgba(255,255,255,0.055),transparent_55%)]",
                span,
                className,
            )}
            style={{ transitionTimingFunction: EASE_OUT }}
        >
            {children}
        </article>
    );
}

function TrustDiagram() {
    return (
        <div className="relative mt-6 grid gap-2 font-mono text-[10px] sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-3 text-left">
                <p className="flex items-center gap-1.5 text-emerald-400/90">
                    <Key weight="light" className="size-3.5" />
                    Browser
                </p>
                <p className="mt-2 leading-relaxed text-zinc-400">
                    keys · threads · canvas · memory · knowledge
                </p>
            </div>
            <div className="hidden px-1 text-zinc-600 sm:block" aria-hidden>
                →
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-black/40 px-3 py-3 text-left">
                <p className="flex items-center gap-1.5 text-zinc-400">
                    <HardDrives weight="light" className="size-3.5" />
                    Node relay
                </p>
                <p className="mt-2 leading-relaxed text-zinc-500">
                    no LLM secrets in env · per-request proxy only
                </p>
            </div>
        </div>
    );
}

export function OwnershipBento() {
    return (
        <section
            id="features"
            className="mx-auto max-w-6xl scroll-mt-28 px-5 py-20 sm:px-8 sm:py-24"
            data-anim-gate="features"
        >
            <Reveal>
                <h2 className="max-w-[16ch] text-3xl font-medium tracking-[-0.035em] text-white sm:text-4xl">
                    Built for ownership, not lock-in.
                </h2>
                <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-zinc-500 sm:text-[15px]">
                    Privacy as posture, search on day one, mid-thread model freedom, and artifacts that stay attached to the work.
                </p>
            </Reveal>

            <Reveal delayMs={40} className="mt-10">
                <BlueprintFrame label="OWNERSHIP GRID" className="rounded-[1.75rem]" pad={false}>
                    <div className="grid grid-cols-1 gap-2 bg-[#050505]/80 p-2 md:grid-cols-12">
                        <LitShell span="md:col-span-7 md:row-span-2">
                            <div className="relative flex flex-wrap items-center gap-2">
                                <StatusPill tone="live" pulse>
                                    Trust boundary
                                </StatusPill>
                                <StatusPill>Zero server LLM keys</StatusPill>
                            </div>
                            <h3 className="relative mt-5 text-lg font-medium tracking-[-0.03em] text-white sm:text-xl">
                                Private by posture
                            </h3>
                            <p className="relative mt-2 max-w-md text-[13px] leading-relaxed text-zinc-500 sm:text-[14px]">
                                Keys live in browser storage. Chats and artifacts live in IndexedDB. The server relays — it does not hold provider credentials.
                            </p>
                            <TrustDiagram />
                        </LitShell>

                        <LitShell span="md:col-span-5">
                            <MagnifyingGlass weight="light" className="relative size-5 text-zinc-500" />
                            <h3 className="relative mt-4 text-[15px] font-medium tracking-tight text-white">
                                Web search out of the box
                            </h3>
                            <p className="relative mt-2 text-[13px] leading-relaxed text-zinc-500">
                                Firecrawl and Parallel MCP ship keyless so research works on day one.
                            </p>
                            <div className="relative mt-4 flex items-center gap-3">
                                <img
                                    src="/landing-logos/firecrawl.png"
                                    alt="Firecrawl"
                                    width={72}
                                    height={20}
                                    className="h-5 w-auto object-contain opacity-80"
                                    loading="lazy"
                                />
                                <img
                                    src="/landing-logos/parallel.png"
                                    alt="Parallel"
                                    width={72}
                                    height={20}
                                    className="h-5 w-auto object-contain opacity-80"
                                    loading="lazy"
                                />
                            </div>
                        </LitShell>

                        <LitShell span="md:col-span-5">
                            <ArrowsLeftRight weight="light" className="relative size-5 text-zinc-500" />
                            <h3 className="relative mt-4 text-[15px] font-medium tracking-tight text-white">
                                Switch mid-thread
                            </h3>
                            <p className="relative mt-2 text-[13px] leading-relaxed text-zinc-500">
                                Change provider or model on the same conversation — context stays put.
                            </p>
                            <div className="relative mt-4 flex flex-wrap gap-1.5">
                                {PROVIDER_LOGOS.slice(0, 5).map((logo) => (
                                    <span
                                        key={logo.id}
                                        className="inline-flex size-8 items-center justify-center rounded-lg border border-white/[0.06] bg-black/40"
                                        title={logo.label}
                                    >
                                        <img
                                            src={logo.src}
                                            alt=""
                                            width={16}
                                            height={16}
                                            className="size-4 object-contain"
                                            loading="lazy"
                                        />
                                    </span>
                                ))}
                                <span className="inline-flex h-8 items-center rounded-lg border border-white/[0.06] bg-black/40 px-2 font-mono text-[10px] text-zinc-500">
                                    +12
                                </span>
                            </div>
                        </LitShell>

                        <LitShell span="md:col-span-12">
                            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                                <div className="min-w-0 max-w-xl">
                                    <div className="flex items-center gap-2">
                                        <Stack weight="light" className="size-5 text-zinc-500" />
                                        <StatusPill>Canvas</StatusPill>
                                    </div>
                                    <h3 className="mt-4 text-[15px] font-medium tracking-tight text-white sm:text-base">
                                        Artifacts that stay attached
                                    </h3>
                                    <p className="mt-2 text-[13px] leading-relaxed text-zinc-500 sm:text-[14px]">
                                        Code, HTML previews, images, and Python binaries open beside the thread and persist with the chat — not lost in a disposable tab.
                                    </p>
                                </div>
                                <div
                                    aria-hidden
                                    className="w-full max-w-xs shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-black/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                                >
                                    <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-3 py-2">
                                        <span className="size-1.5 rounded-full bg-zinc-700" />
                                        <span className="size-1.5 rounded-full bg-zinc-700" />
                                        <span className="ml-2 font-mono text-[9px] text-zinc-600">
                                            canvas · chart.png
                                        </span>
                                    </div>
                                    <div className="grid h-20 grid-cols-6 items-end gap-1 px-3 py-3">
                                        {[40, 65, 45, 80, 55, 70].map((h, i) => (
                                            <div
                                                key={i}
                                                className="rounded-sm bg-white/15"
                                                style={{ height: `${h}%` }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </LitShell>
                    </div>
                </BlueprintFrame>
            </Reveal>
        </section>
    );
}
