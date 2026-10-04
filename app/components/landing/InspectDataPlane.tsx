import { type KeyboardEvent, useEffect, useId, useState } from "react";
import { PROVIDER_INTEGRATION_COUNT } from "./constants";
import { EASE_OUT } from "./motion";
import { cn } from "~/lib/utils";

const NODES = [
    {
        id: "browser",
        label: "Your browser",
        status: "OWNED",
        facts: [
            "Provider keys stay in the browser and are relayed per request.",
            "When Web Crypto and IndexedDB are available, settings are encrypted at rest with AES-GCM. The payload is in localStorage; the envelope key is in IndexedDB. Otherwise storage may be plaintext.",
            "Threads, Canvas artifacts, memory, knowledge, and usage events persist in IndexedDB.",
        ],
    },
    {
        id: "relay",
        label: "Node relay",
        status: "TRANSIT",
        facts: [
            "No persistent provider keys. The server does not need LLM keys in its environment.",
            "Each request is forwarded to the provider you select.",
            "Private-network provider and MCP URLs are rejected unless a trusted self-host opts in.",
            "Remote MCP connections reject redirects.",
            "Optional sliding-window rate limits via RATE_LIMIT_RPM.",
        ],
    },
    {
        id: "provider",
        label: "Chosen provider",
        status: "CHOSEN",
        facts: [
            `Cloud or local endpoint you choose — ${PROVIDER_INTEGRATION_COUNT} integrations, including Ollama and LM Studio.`,
            "Retrieved knowledge-base context may be sent to the selected cloud model.",
        ],
    },
] as const;

const STAGES = [
    { id: "read", label: "Key read from browser", node: "browser" },
    { id: "relay", label: "Relayed per request", node: "relay" },
    { id: "stream", label: "Provider response streamed", node: "provider" },
    { id: "save", label: "Saved to IndexedDB", node: "browser" },
] as const;

type NodeId = (typeof NODES)[number]["id"];

export function InspectDataPlane() {
    const [enhanced, setEnhanced] = useState(false);
    const [nodeId, setNodeId] = useState<NodeId>("browser");
    const [stage, setStage] = useState<number | null>(null);
    const baseId = useId();
    const node = NODES.find((item) => item.id === nodeId) ?? NODES[0];

    useEffect(() => {
        const media = window.matchMedia("(prefers-reduced-motion: reduce)");
        const sync = () => setEnhanced(!media.matches);
        sync();
        media.addEventListener("change", sync);
        return () => media.removeEventListener("change", sync);
    }, []);

    const step = () => {
        const next = stage === null || stage >= STAGES.length - 1 ? 0 : stage + 1;
        setStage(next);
        setNodeId(STAGES[next].node);
    };

    const onNodeKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        const key = event.key;
        if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(key)) {
            return;
        }
        event.preventDefault();
        const last = NODES.length - 1;
        const next =
            key === "Home"
                ? 0
                : key === "End"
                  ? last
                  : key === "ArrowLeft" || key === "ArrowUp"
                    ? (index + last) % NODES.length
                    : (index + 1) % NODES.length;
        setNodeId(NODES[next].id);
        const button =
            event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                '[role="radio"]',
            )[next];
        button?.focus();
    };

    return (
        <div className="overflow-hidden rounded-[2px] border border-white/[0.08]">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-2 font-mono text-[10px] tracking-[0.16em] text-zinc-500">
                <span>LOCAL DATA PLANE</span>
                <span>INSPECT</span>
            </div>

            <div className={enhanced ? "hidden" : "block"} data-inspect-static="">
                <div className="grid md:grid-cols-3">
                    {NODES.map((item, index) => (
                        <article
                            key={item.id}
                            className={cn(
                                "px-4 py-4 sm:px-5 sm:py-5",
                                index > 0 &&
                                    "border-t border-white/[0.08] md:border-l md:border-t-0",
                            )}
                        >
                            <p className="font-mono text-[10px] tracking-[0.16em] text-zinc-500">
                                {item.status}
                            </p>
                            <h3 className="mt-1.5 text-[15px] font-medium tracking-tight text-white">
                                {item.label}
                            </h3>
                            <ul className="mt-2 space-y-1.5 text-[13px] leading-snug text-zinc-400">
                                {item.facts.map((fact) => (
                                    <li key={fact}>{fact}</li>
                                ))}
                            </ul>
                        </article>
                    ))}
                </div>
                <ol
                    aria-label="Request stages"
                    className="list-decimal space-y-2 border-t border-white/[0.08] px-8 py-4 text-[13px] text-zinc-300"
                >
                    {STAGES.map((item) => (
                        <li key={item.id}>{item.label}</li>
                    ))}
                </ol>
            </div>

            {enhanced ? (
                <div data-inspect-interactive="">
                    <div
                        role="radiogroup"
                        aria-label="Local data plane"
                        className="grid md:grid-cols-3"
                    >
                        {NODES.map((item, index) => {
                            const selected = item.id === nodeId;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={selected}
                                    id={`${baseId}-node-${item.id}`}
                                    tabIndex={selected ? 0 : -1}
                                    onClick={() => setNodeId(item.id)}
                                    onFocus={() => setNodeId(item.id)}
                                    onMouseEnter={() => setNodeId(item.id)}
                                    onKeyDown={(event) => onNodeKeyDown(event, index)}
                                    className={cn(
                                        "min-h-11 px-4 py-4 text-left transition-[background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/50 sm:px-5 sm:py-5",
                                        index > 0 &&
                                            "border-t border-white/[0.08] md:border-l md:border-t-0",
                                        selected ? "bg-white/[0.04]" : "hover:bg-white/[0.03]",
                                    )}
                                    style={{ transitionTimingFunction: EASE_OUT }}
                                >
                                    <p className="font-mono text-[10px] tracking-[0.16em] text-zinc-500">
                                        {item.status}
                                    </p>
                                    <span className="mt-1.5 block text-[15px] font-medium tracking-tight text-white">
                                        {item.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div
                        role="region"
                        aria-labelledby={`${baseId}-node-${node.id}`}
                        className="border-t border-white/[0.08] px-4 py-4 sm:px-5"
                    >
                        <ul className="max-w-3xl space-y-1.5 text-[13px] leading-snug text-zinc-400">
                            {node.facts.map((fact) => (
                                <li key={fact}>{fact}</li>
                            ))}
                        </ul>
                    </div>

                    <div className="border-t border-white/[0.08] px-4 py-4 sm:px-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={step}
                                className="inline-flex min-h-11 items-center rounded-[2px] border border-white/[0.1] bg-white px-4 text-[13px] font-medium text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                            >
                                Follow one request
                            </button>
                            <p
                                role="status"
                                aria-live="polite"
                                className="font-mono text-[11px] text-zinc-400"
                            >
                                {stage === null
                                    ? "Request idle"
                                    : `Stage ${stage + 1} of ${STAGES.length}: ${STAGES[stage].label}`}
                            </p>
                        </div>
                        <ol
                            aria-label="Request stages"
                            className="relative mt-4 grid gap-2 sm:grid-cols-4"
                        >
                            <span
                                aria-hidden
                                className="pointer-events-none absolute top-3 size-1.5 bg-[var(--landing-mint,#3DFFB0)] motion-reduce:hidden"
                                style={{
                                    left:
                                        stage === null
                                            ? "0.75rem"
                                            : `calc(${stage} * 25% + 0.75rem)`,
                                    transition: `left 200ms ${EASE_OUT}`,
                                }}
                            />
                            {STAGES.map((item, index) => (
                                <li
                                    key={item.id}
                                    className={cn(
                                        "border border-white/[0.08] px-3 py-3 font-mono text-[11px] leading-snug",
                                        stage === index ? "text-white" : "text-zinc-500",
                                    )}
                                >
                                    <span className="text-zinc-500">{index + 1}. </span>
                                    {item.label}
                                </li>
                            ))}
                        </ol>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
