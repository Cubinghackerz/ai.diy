import { HardDrives, Key, PlugsConnected } from "@phosphor-icons/react";
import { Reveal } from "./DoubleBezel";
import { SectionIndex } from "./SectionIndex";
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
                <SectionIndex index="02" label="TRUST BOUNDARY" />
                <div className="grid gap-8 md:grid-cols-[0.8fr_1.2fr] md:items-end">
                    <h2 className="max-w-[12ch] text-4xl font-medium tracking-[-0.04em] text-white sm:text-5xl">
                        Your keys never touch the server.
                    </h2>
                    <p className="max-w-xl text-[15px] leading-relaxed text-zinc-400 md:justify-self-end">
                        Provider credentials live in your browser&apos;s localStorage and are
                        relayed per request. Threads, Canvas, memory, and knowledge persist in
                        IndexedDB. The Node server stores nothing.
                    </p>
                </div>
            </Reveal>

            <Reveal delayMs={40} className="mt-12">
                <TrustBoundary />
            </Reveal>

            <Reveal delayMs={80} className="mt-10">
                <div className="grid gap-10 border-t border-white/[0.08] pt-10 md:grid-cols-3 md:gap-8">
                    {CALLOUTS.map((item) => {
                        const Icon = item.icon;
                        return (
                            <article key={item.title}>
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
            </Reveal>
        </section>
    );
}
