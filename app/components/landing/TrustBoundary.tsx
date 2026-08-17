import { usePrefersReducedMotion } from "./hooks";
import { cn } from "~/lib/utils";

const NODES = [
    {
        id: "browser",
        label: "Your browser",
        status: "OWNED",
        tone: "owned" as const,
        lines: ["Keys in localStorage", "Threads · Canvas · memory", "IndexedDB only"],
    },
    {
        id: "relay",
        label: "Node relay",
        status: "TRANSIT",
        tone: "transit" as const,
        lines: ["No stored LLM keys", "Search / MCP / models", "Per-request forward"],
    },
    {
        id: "provider",
        label: "Chosen provider",
        status: "YOURS",
        tone: "provider" as const,
        lines: ["OpenAI · Anthropic · Gemini", "Ollama / custom endpoint", "You pick the model"],
    },
];

export function TrustBoundary({ className }: { className?: string }) {
    const reduced = usePrefersReducedMotion();

    return (
        <div
            className={cn("relative w-full", className)}
            role="img"
            aria-label="Keys stay in the browser, the Node server relays each request, and only the selected provider receives it."
        >
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-[#08080a] shadow-[0_32px_90px_-48px_rgba(0,0,0,0.9)]">
                <div className="relative flex items-center justify-between border-b border-white/[0.1] px-4 py-2.5 font-mono text-[10px] tracking-[0.18em] text-zinc-400">
                    <span>LOCAL DATA PLANE</span>
                    <span className="inline-flex items-center gap-1.5 tracking-normal text-[var(--landing-mint,#3DFFB0)]">
                        <span className="size-1.5 rounded-full bg-[var(--landing-mint,#3DFFB0)] shadow-[0_0_10px_rgba(61,255,176,0.85)]" />
                        RELAY · NO STORE
                    </span>
                </div>

                <div className="relative grid gap-0 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
                    {NODES.map((node, index) => (
                        <div key={node.id} className="contents">
                            <article
                                className={cn(
                                    "relative z-[1] min-h-[12.5rem] p-5 sm:p-6",
                                    node.tone === "owned" &&
                                        "bg-white text-black shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]",
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
                            {index < NODES.length - 1 ? (
                                <div
                                    aria-hidden
                                    className="relative hidden h-full min-w-12 items-center justify-center bg-[#09090c] lg:flex"
                                >
                                    <span className="absolute inset-y-5 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-white/5 via-white/25 to-white/5" />
                                    {!reduced ? (
                                        <span className="landing-packet absolute left-1/2 top-8 size-2 -translate-x-1/2 rounded-full bg-[var(--landing-mint,#3DFFB0)] shadow-[0_0_16px_rgba(61,255,176,0.95)]" />
                                    ) : (
                                        <span className="size-2 rounded-full bg-[var(--landing-mint,#3DFFB0)]" />
                                    )}
                                </div>
                            ) : null}
                        </div>
                    ))}
                </div>

                <p className="relative border-t border-white/[0.1] px-5 py-3 font-mono text-[11px] leading-relaxed text-zinc-400">
                    Stored locally. Relayed in transit. Never configured as a server secret.
                </p>
            </div>
            <style>{`
                @keyframes landing-packet {
                    0% { top: 14%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 86%; opacity: 0; }
                }
                .landing-packet { animation: landing-packet 2.1s cubic-bezier(0.32,0.72,0,1) infinite; }
                @media (prefers-reduced-motion: reduce) {
                    .landing-packet { animation: none; }
                }
            `}</style>
        </div>
    );
}
