import { HardDrives, Key, PlugsConnected } from "@phosphor-icons/react";
import { MaskedHeading } from "./MaskedHeading";
import { TrustBoundary } from "./TrustBoundary";

const CALLOUTS = [
    {
        icon: Key,
        title: "Stored in the browser",
        body: "Provider credentials stay in browser storage and are relayed per request. They are not required as persistent server secrets.",
    },
    {
        icon: HardDrives,
        title: "Browser is the database",
        body: "Threads, Canvas, memory, knowledge, usage events, and website projects persist in IndexedDB.",
    },
    {
        icon: PlugsConnected,
        title: "Any model mid-thread",
        body: "20+ cloud and local providers. Switch without moving the workspace or losing context.",
    },
] as const;

export function OwnershipStage() {
    return (
        <section
            id="features"
            className="relative mx-auto max-w-6xl scroll-mt-28 px-5 py-20 sm:px-8 sm:py-28"
            data-anim-gate="ownership-stage"
        >
            <div className="grid gap-6 md:grid-cols-[0.85fr_1.15fr] md:items-end md:gap-12">
                <MaskedHeading className="max-w-[12ch] text-4xl font-medium tracking-[-0.04em] text-white sm:text-5xl">
                    Your keys stay under your control.
                </MaskedHeading>
                <p className="max-w-xl text-[15px] leading-relaxed text-zinc-400 md:justify-self-end">
                    Provider credentials stay in your browser&apos;s storage and are relayed per
                    request. Threads, Canvas, memory, and knowledge persist in IndexedDB. The
                    Node server is a relay, not a persistent provider-key store.
                </p>
            </div>

            <div className="mt-10">
                <TrustBoundary />
            </div>

            <div className="mt-12 grid gap-3 border-t border-white/[0.08] pt-10 md:grid-cols-2">
                {CALLOUTS.slice(0, 2).map((item) => {
                    const Icon = item.icon;
                    return (
                        <article
                            key={item.title}
                            className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-6 transition-[border-color,background-color] duration-300 hover:border-white/[0.16] hover:bg-[#111]"
                        >
                            <Icon weight="light" className="size-5 text-zinc-300" />
                            <h3 className="mt-5 text-[16px] font-medium tracking-tight text-white">
                                {item.title}
                            </h3>
                            <p className="mt-2.5 text-[14px] leading-relaxed text-zinc-400">
                                {item.body}
                            </p>
                        </article>
                    );
                })}
                <article className="rounded-2xl border border-white/[0.08] bg-black p-6 md:col-span-2">
                    <PlugsConnected weight="light" className="size-5 text-zinc-300" />
                    <h3 className="mt-5 text-[16px] font-medium tracking-tight text-white">
                        {CALLOUTS[2].title}
                    </h3>
                    <p className="mt-2.5 max-w-2xl text-[14px] leading-relaxed text-zinc-400">
                        {CALLOUTS[2].body}
                    </p>
                </article>
            </div>
        </section>
    );
}
