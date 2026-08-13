import { Check, X } from "@phosphor-icons/react";
import { BlueprintFrame, StatusPill } from "./BlueprintFrame";
import { Reveal } from "./DoubleBezel";

const ROWS = [
    {
        label: "LLM API keys",
        hosted: "On the vendor’s servers",
        owned: "In your browser only",
    },
    {
        label: "Chat history",
        hosted: "Vendor cloud account",
        owned: "IndexedDB on this device",
    },
    {
        label: "Model choice",
        hosted: "One catalog, one bill",
        owned: "17 providers, switch mid-thread",
    },
    {
        label: "Knowledge / RAG",
        hosted: "Uploaded to their store",
        owned: "On-device WASM + HNSW",
    },
    {
        label: "Infrastructure",
        hosted: "You rent the product",
        owned: "You run Node or Docker",
    },
] as const;

export function OwnershipSplit() {
    return (
        <section
            className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24"
            data-anim-gate="split"
            aria-label="Ownership comparison"
        >
            <Reveal>
                <h2 className="max-w-[16ch] text-3xl font-medium tracking-[-0.035em] text-white sm:text-4xl">
                    Hosted chat vs a workspace you run.
                </h2>
                <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-zinc-300">
                    Same job — useful thinking with models. Different trust boundary.
                </p>
            </Reveal>

            <Reveal delayMs={40} className="mt-10">
                <div className="grid gap-3 lg:grid-cols-2">
                    <BlueprintFrame label="HOSTED SAAS" className="rounded-xl opacity-70">
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-[15px] font-medium text-zinc-400">Typical cloud chat</p>
                            <StatusPill tone="warn">Keys leave device</StatusPill>
                        </div>
                        <ul className="mt-6 space-y-3">
                            {ROWS.map((row) => (
                                <li
                                    key={row.label}
                                    className="flex items-start gap-3 border-t border-white/[0.06] pt-3 first:border-0 first:pt-0"
                                >
                                    <X
                                        weight="bold"
                                        className="mt-0.5 size-3.5 shrink-0 text-zinc-500"
                                        aria-hidden
                                    />
                                    <div className="min-w-0">
                                        <p className="font-mono text-[10px] tracking-wide text-zinc-500">
                                            {row.label}
                                        </p>
                                        <p className="mt-1 text-[13px] text-zinc-400">{row.hosted}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </BlueprintFrame>

                    <BlueprintFrame
                        label="AI.DIY"
                        className="rounded-xl bg-[#1c1c22]/90 shadow-[0_24px_80px_-40px_rgba(255,255,255,0.18)]"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-[15px] font-medium text-white">Local-first workspace</p>
                            <StatusPill tone="live" pulse>
                                Keys stay local
                            </StatusPill>
                        </div>
                        <ul className="mt-6 space-y-3">
                            {ROWS.map((row) => (
                                <li
                                    key={row.label}
                                    className="flex items-start gap-3 border-t border-white/[0.08] pt-3 first:border-0 first:pt-0"
                                >
                                    <Check
                                        weight="bold"
                                        className="mt-0.5 size-3.5 shrink-0 text-[var(--landing-mint,#3DFFB0)]"
                                        aria-hidden
                                    />
                                    <div className="min-w-0">
                                        <p className="font-mono text-[10px] tracking-wide text-zinc-400">
                                            {row.label}
                                        </p>
                                        <p className="mt-1 text-[13px] text-zinc-100">{row.owned}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </BlueprintFrame>
                </div>
            </Reveal>
        </section>
    );
}
