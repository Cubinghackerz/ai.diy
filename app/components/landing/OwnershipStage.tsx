import {
    HardDrives,
    Key,
    Lightning,
    PlugsConnected,
} from "@phosphor-icons/react";
import { BlueprintFrame, StatusPill } from "./BlueprintFrame";
import { Reveal } from "./DoubleBezel";
import { FEATURED_PROVIDER_MARKS } from "./constants";
import { cn } from "~/lib/utils";

const CALLOUTS = [
    {
        icon: Key,
        title: "Keys stay on device",
        body: "Provider credentials never need to live in server env. Relayed per request only.",
    },
    {
        icon: HardDrives,
        title: "Browser is the database",
        body: "Threads, Canvas, memory, knowledge, and usage events persist in IndexedDB.",
    },
    {
        icon: PlugsConnected,
        title: "Any model mid-thread",
        body: "Seventeen cloud and local providers. Switch without losing context.",
    },
] as const;

const FLOATING = [
    {
        className: "left-0 top-[10%]",
        pill: { tone: "live" as const, pulse: true, label: "Keys local" },
        body: "No LLM secrets in server env.",
    },
    {
        className: "right-0 top-[24%]",
        pill: { tone: "neutral" as const, pulse: false, label: "17 providers" },
        body: "Cloud + Ollama + custom OpenAI-compatible.",
    },
] as const;

export function OwnershipStage() {
    return (
        <section
            id="features"
            className="relative mx-auto max-w-6xl scroll-mt-28 px-5 py-20 sm:px-8 sm:py-28"
            data-anim-gate="ownership-stage"
        >
            <Reveal>
                <div className="text-center">
                    <h2 className="text-4xl font-medium tracking-[-0.04em] text-white sm:text-5xl">
                        Domain: Device
                    </h2>
                    <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-zinc-300">
                        One workspace for thinking — close to your keys, close to your data,
                        free of vendor lock-in.
                    </p>
                </div>
            </Reveal>

            <Reveal delayMs={50} className="mt-14">
                <div className="relative mx-auto max-w-4xl">
                    <div
                        className="landing-constellation relative mx-auto aspect-square w-full max-w-lg"
                        aria-hidden
                    >
                        <div className="absolute inset-[6%] rounded-full border border-white/[0.12]" />
                        <div className="absolute inset-[16%] rounded-full border border-dashed border-white/[0.16]" />
                        <div className="absolute inset-[28%] rounded-full border border-white/[0.1]" />
                        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.12),transparent_55%)]" />

                        {FEATURED_PROVIDER_MARKS.map((logo, i) => {
                            const angle = (i / FEATURED_PROVIDER_MARKS.length) * Math.PI * 2 - Math.PI / 2;
                            const r = 40;
                            const x = 50 + Math.cos(angle) * r;
                            const y = 50 + Math.sin(angle) * r;
                            return (
                                <div
                                    key={logo.id}
                                    className="landing-orbit-node absolute flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-[#17171c] shadow-[0_12px_40px_-14px_rgba(0,0,0,0.9)]"
                                    style={{ left: `${x}%`, top: `${y}%` }}
                                    title={logo.label}
                                >
                                    <img
                                        src={logo.src}
                                        alt=""
                                        width={28}
                                        height={28}
                                        className="size-7 object-contain"
                                        loading="lazy"
                                    />
                                </div>
                            );
                        })}

                        <div className="absolute left-1/2 top-1/2 flex size-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-xl border border-white/20 bg-white text-black shadow-[0_24px_70px_-22px_rgba(255,255,255,0.45)]">
                            <Lightning weight="fill" className="size-6" />
                            <span className="mt-1.5 font-mono text-[10px] font-medium tracking-wide">
                                ai.diy
                            </span>
                        </div>
                    </div>

                    {FLOATING.map((item) => (
                        <div
                            key={item.pill.label}
                            className={cn(
                                "pointer-events-none absolute hidden w-52 lg:block",
                                item.className,
                            )}
                        >
                            <div className="pointer-events-auto rounded-xl border border-dashed border-white/25 bg-black/60 px-4 py-3.5">
                                <StatusPill tone={item.pill.tone} pulse={item.pill.pulse}>
                                    {item.pill.label}
                                </StatusPill>
                                <p className="mt-2.5 text-[12px] leading-snug text-zinc-300">
                                    {item.body}
                                </p>
                            </div>
                        </div>
                    ))}

                    <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:hidden">
                        {FLOATING.map((item) => (
                            <div
                                key={item.pill.label}
                                className="rounded-xl border border-dashed border-white/25 bg-black/40 px-4 py-3.5"
                            >
                                <StatusPill tone={item.pill.tone} pulse={item.pill.pulse}>
                                    {item.pill.label}
                                </StatusPill>
                                <p className="mt-2.5 text-[12px] leading-snug text-zinc-300">
                                    {item.body}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </Reveal>

            <Reveal delayMs={80} className="mt-16">
                <BlueprintFrame className="rounded-xl" pad={false} label="OWNERSHIP SURFACE">
                    <div className="grid divide-y divide-white/[0.08] md:grid-cols-3 md:divide-x md:divide-y-0">
                        {CALLOUTS.map((item) => {
                            const Icon = item.icon;
                            return (
                                <div
                                    key={item.title}
                                    className="min-h-[11rem] p-7 transition-colors duration-200 hover:bg-white/[0.03] sm:p-8"
                                >
                                    <Icon weight="light" className="size-6 text-zinc-300" />
                                    <h3 className="mt-5 text-[16px] font-medium tracking-tight text-white">
                                        {item.title}
                                    </h3>
                                    <p className="mt-2.5 text-[14px] leading-relaxed text-zinc-400">
                                        {item.body}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </BlueprintFrame>
            </Reveal>
        </section>
    );
}
