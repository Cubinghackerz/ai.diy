import { cn } from "~/lib/utils";
import { Reveal } from "./DoubleBezel";

const FACTS = [
    { label: "LOCAL-FIRST", detail: "Browser-owned storage" },
    { label: "20+ PROVIDERS", detail: "Cloud and local models" },
    { label: "NO PERSISTENT LLM KEYS", detail: "Relayed per request" },
    { label: "MIT LICENSED", detail: "Self-host anytime" },
] as const;

/** Full-width key-facts band directly under the hero (hero stack discipline). */
export function FactsBand() {
    return (
        <Reveal delayMs={60}>
            <div className="border-y border-white/[0.08]">
                <dl className="mx-auto grid max-w-6xl grid-cols-2 lg:grid-cols-4">
                    {FACTS.map((fact, i) => (
                        <div
                            key={fact.label}
                            className={cn(
                                "flex flex-col gap-1 px-5 py-6 sm:px-8 sm:py-7",
                                i < 2 && "max-lg:border-b max-lg:border-white/[0.08]",
                                i % 2 === 1 && "max-lg:border-l max-lg:border-white/[0.08]",
                                i > 0 && "lg:border-l lg:border-white/[0.08]",
                            )}
                            aria-label={`${fact.label}: ${fact.detail}`}
                        >
                            <dt className="font-mono text-[10px] tracking-[0.16em] text-zinc-400">
                                {fact.label}
                            </dt>
                            <dd className="text-[13px] text-zinc-500">{fact.detail}</dd>
                        </div>
                    ))}
                </dl>
            </div>
        </Reveal>
    );
}