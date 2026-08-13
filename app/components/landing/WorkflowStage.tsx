import {
    CheckCircle,
    CircleNotch,
    GitBranch,
    ShieldCheck,
} from "@phosphor-icons/react";
import { BlueprintFrame } from "./BlueprintFrame";
import { Reveal } from "./DoubleBezel";
import { LandingCta } from "./LandingCta";

const DEPLOYS = [
    { ver: "workspace", status: "ready" as const, note: "Chat · Canvas · skills" },
    { ver: "providers", status: "ready" as const, note: "17 cloud + local" },
    { ver: "search", status: "ready" as const, note: "Firecrawl · Parallel" },
    { ver: "knowledge", status: "ready" as const, note: "On-device RAG" },
    { ver: "subagents", status: "building" as const, note: "Approve → wait → synthesize" },
];

export function WorkflowStage() {
    return (
        <section
            className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24"
            data-anim-gate="workflow"
        >
            <Reveal>
                <div className="text-center">
                    <h2 className="text-3xl font-medium tracking-[-0.04em] text-white sm:text-5xl">
                        Fits into how you already ship.
                    </h2>
                    <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-zinc-300">
                        Git, Docker, Node, or a Vercel preview. No proprietary lock-in. No
                        server-side model bill.
                    </p>
                </div>
            </Reveal>

            <Reveal delayMs={40} className="mt-12">
                <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                    <BlueprintFrame
                        className="min-h-[32rem] rounded-xl"
                        pad={false}
                        label="WORKSPACE STATE"
                    >
                        <div className="flex items-center gap-3 border-b border-white/[0.08] px-6 py-5">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-white text-black">
                                <GitBranch weight="bold" className="size-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="truncate font-mono text-[12px] text-zinc-200">
                                    Cubinghackerz/ai.diy
                                </p>
                                <p className="font-mono text-[10px] text-zinc-500">main · MIT</p>
                            </div>
                        </div>
                        <ul className="divide-y divide-white/[0.07]">
                            {DEPLOYS.map((row) => (
                                <li
                                    key={row.ver}
                                    className="flex min-h-14 items-center gap-3 px-6 py-4 font-mono text-[12px]"
                                >
                                    <span className="w-24 shrink-0 text-zinc-300">{row.ver}</span>
                                    <span className="min-w-0 flex-1 truncate text-zinc-500">
                                        {row.note}
                                    </span>
                                    {row.status === "ready" ? (
                                        <span className="inline-flex items-center gap-1.5 text-[var(--landing-mint,#3DFFB0)]">
                                            <CheckCircle weight="fill" className="size-3.5" />
                                            Ready
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 text-zinc-400">
                                            <CircleNotch
                                                weight="bold"
                                                className="size-3.5 animate-spin motion-reduce:animate-none"
                                            />
                                            Experimental
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                        <div className="border-t border-white/[0.08] px-6 py-5">
                            <p className="text-[13px] font-medium text-white">
                                Secure by default posture
                            </p>
                            <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-400">
                                SSRF guards on fetch, private URL rejection, no stdio MCP, optional
                                server RPM limits. Soft spend caps in the client.
                            </p>
                        </div>
                    </BlueprintFrame>

                    <div className="flex min-h-[28rem] flex-col justify-between overflow-hidden rounded-xl bg-white p-8 text-black shadow-[0_32px_90px_-36px_rgba(255,255,255,0.5)] sm:p-9">
                        <div>
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-black/[0.04] px-2.5 py-1 font-mono text-[10px] tracking-wide text-zinc-600">
                                <span className="size-1.5 rounded-full bg-[var(--landing-mint,#3DFFB0)]" />
                                Ownership
                            </span>
                            <h3 className="mt-6 text-2xl font-medium tracking-[-0.03em] sm:text-[1.85rem] sm:leading-tight">
                                One workspace for keys, models, and artifacts.
                            </h3>
                            <p className="mt-4 text-[15px] leading-relaxed text-zinc-600">
                                Whether you are reviewing code, running research, or shipping a
                                Canvas artifact — it all runs under your control.
                            </p>
                            <ul className="mt-7 space-y-3 text-[14px] text-zinc-700">
                                <li className="flex items-center gap-2">
                                    <ShieldCheck weight="fill" className="size-4 text-zinc-900" />
                                    BYOK · no server LLM bill
                                </li>
                                <li className="flex items-center gap-2">
                                    <ShieldCheck weight="fill" className="size-4 text-zinc-900" />
                                    Import ChatGPT / Claude / Markdown
                                </li>
                                <li className="flex items-center gap-2">
                                    <ShieldCheck weight="fill" className="size-4 text-zinc-900" />
                                    Self-host in one command
                                </li>
                            </ul>
                        </div>
                        <LandingCta to="/workspace" variant="inverse" className="mt-8">
                            Enter workspace
                        </LandingCta>
                    </div>
                </div>
            </Reveal>
        </section>
    );
}
