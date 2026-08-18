import { cn } from "~/lib/utils";

const NODES = [
    {
        id: "browser",
        label: "Your browser",
        status: "OWNED",
        tone: "owned" as const,
        lines: ["Settings and keys in browser storage", "Threads · Canvas · memory", "IndexedDB + localStorage"],
    },
    {
        id: "relay",
        label: "Node relay",
        status: "TRANSIT",
        tone: "transit" as const,
        lines: ["No persistent provider keys", "Models + enabled tools", "Per-request forward"],
    },
    {
        id: "provider",
        label: "Chosen provider",
        status: "CHOSEN",
        tone: "provider" as const,
        lines: ["20+ cloud and local providers", "Ollama / custom endpoint", "You pick the model"],
    },
];

export function TrustBoundary({ className }: { className?: string }) {
    return (
        <div
            className={cn("relative w-full", className)}
            role="img"
            aria-label="The browser owns workspace state, the Node server relays requests, and you choose the provider."
        >
            <div className="rounded-2xl border border-white/[0.1] bg-[#08080a]">
                <div className="flex items-center justify-between border-b border-white/[0.1] px-4 py-2.5 font-mono text-[10px] tracking-[0.18em] text-zinc-400">
                    <span>LOCAL DATA PLANE</span>
                    <span className="inline-flex items-center gap-1.5 tracking-normal text-[var(--landing-mint,#3DFFB0)]">
                        <span className="size-1.5 rounded-full bg-[var(--landing-mint,#3DFFB0)]" />
                        RELAY · TRANSIT ONLY
                    </span>
                </div>

                <div className="grid lg:grid-cols-3">
                    {NODES.map((node, index) => (
                        <article
                            key={node.id}
                            className={cn(
                                "min-h-[12.5rem] p-5 sm:p-6",
                                index > 0 && "border-t border-white/[0.08] lg:border-l lg:border-t-0",
                                node.tone === "owned" && "bg-white text-black",
                                node.tone === "transit" && "bg-[#101014] text-zinc-100",
                                node.tone === "provider" && "bg-[#16161b] text-zinc-100",
                            )}
                        >
                            <p
                                className={cn(
                                    "font-mono text-[10px] tracking-[0.18em]",
                                    node.tone === "owned"
                                        ? "text-black/50"
                                        : node.tone === "transit"
                                          ? "text-zinc-300"
                                          : "text-zinc-500",
                                )}
                            >
                                {node.status}
                            </p>
                            <h3
                                className={cn(
                                    "mt-2 text-[18px] font-medium tracking-[-0.035em]",
                                    node.tone === "owned" ? "text-black" : "text-white",
                                )}
                            >
                                {node.label}
                            </h3>
                            <ul
                                className={cn(
                                    "mt-4 space-y-1.5 text-[13px] leading-snug",
                                    node.tone === "owned" ? "text-black/62" : "text-zinc-400",
                                )}
                            >
                                {node.lines.map((line) => (
                                    <li key={line}>{line}</li>
                                ))}
                            </ul>
                        </article>
                    ))}
                </div>

                <p className="border-t border-white/[0.1] px-5 py-3 font-mono text-[11px] leading-relaxed text-zinc-400">
                    Stored in the browser. Relayed in transit. Never required as a persistent server secret.
                </p>
            </div>
        </div>
    );
}
