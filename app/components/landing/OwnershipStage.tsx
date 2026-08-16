import { HardDrives, Key, PlugsConnected } from "@phosphor-icons/react";
import { BlueprintFrame } from "./BlueprintFrame";
import { Reveal } from "./DoubleBezel";
import { TrustBoundary } from "./TrustBoundary";

const CALLOUTS = [
    {
        icon: Key,
        title: "Stored in the browser",
        body: "Provider credentials live in localStorage and are relayed per request. They are never configured as server secrets.",
    },
    {
        icon: HardDrives,
        title: "Browser is the database",
        body: "Threads, Canvas, memory, knowledge, usage events, and website projects persist in IndexedDB.",
    },
    {
        icon: PlugsConnected,
        title: "Any model mid-thread",
        body: "Seventeen cloud and local providers. Switch without moving the workspace or losing context.",
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
                <div className="grid gap-8 md:grid-cols-[0.8fr_1.2fr] md:items-end">
                    <h2 className="max-w-[10ch] text-4xl font-medium tracking-[-0.04em] text-white sm:text-5xl">
                        Domain: Device
                    </h2>
                    <p className="max-w-xl text-[15px] leading-relaxed text-zinc-300 md:justify-self-end">
                        One workspace for thinking: keys stored locally, requests
                        relayed only in transit, and provider choice detached from the
                        workspace that holds your context.
                    </p>
                </div>
            </Reveal>

            <Reveal delayMs={40} className="mt-12">
                <TrustBoundary />
            </Reveal>

            <Reveal delayMs={80} className="mt-10">
                <BlueprintFrame className="rounded-xl" pad={false} label="OWNERSHIP SURFACE">
                    <div className="grid divide-y divide-white/[0.08] md:grid-cols-3 md:divide-x md:divide-y-0">
                        {CALLOUTS.map((item) => {
                            const Icon = item.icon;
                            return (
                                <article
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
                                </article>
                            );
                        })}
                    </div>
                </BlueprintFrame>
            </Reveal>
        </section>
    );
}
