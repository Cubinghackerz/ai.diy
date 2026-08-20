import { cn } from "~/lib/utils";

const NODES = [
    {
        id: "browser",
        label: "Your browser",
        status: "OWNED",
        body: "Keys, threads, Canvas, memory — IndexedDB.",
    },
    {
        id: "relay",
        label: "Node relay",
        status: "TRANSIT",
        body: "No persistent provider keys. Per-request forward.",
    },
    {
        id: "provider",
        label: "Chosen provider",
        status: "CHOSEN",
        body: "20+ cloud and local models. You pick.",
    },
];

export function TrustBoundary({ className }: { className?: string }) {
    return (
        <div
            className={cn("relative w-full", className)}
            role="img"
            aria-label="The browser owns workspace state, the Node server relays requests, and you choose the provider."
        >
            <div className="overflow-hidden rounded-xl border border-white/[0.08]">
                <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-2 font-mono text-[10px] tracking-[0.16em] text-zinc-600">
                    <span>LOCAL DATA PLANE</span>
                    <span>TRANSIT ONLY</span>
                </div>

                <div className="grid md:grid-cols-3">
                    {NODES.map((node, index) => (
                        <article
                            key={node.id}
                            className={cn(
                                "px-4 py-4 sm:px-5 sm:py-5",
                                index > 0 && "border-t border-white/[0.08] md:border-l md:border-t-0",
                            )}
                        >
                            <p className="font-mono text-[10px] tracking-[0.16em] text-zinc-600">
                                {node.status}
                            </p>
                            <h3 className="mt-1.5 text-[15px] font-medium tracking-tight text-white">
                                {node.label}
                            </h3>
                            <p className="mt-1.5 text-[13px] leading-snug text-zinc-500">{node.body}</p>
                        </article>
                    ))}
                </div>
            </div>
        </div>
    );
}
