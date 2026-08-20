import { Code, Files, SquareHalf } from "@phosphor-icons/react";
import { Link } from "react-router";
import { Reveal } from "./DoubleBezel";
import { MaskedHeading } from "./MaskedHeading";
import { EASE_OUT } from "./motion";
import { SEO_GUIDES } from "~/lib/seo-pages";

const CASES = [
    {
        icon: Code,
        title: "Local code review",
        body: "Refactor and review with BYOK or Ollama. Diffs stay in the browser; nothing is uploaded to a vendor workspace.",
    },
    {
        icon: Files,
        title: "Private document RAG",
        body: "Search your notes and PDFs with on-device embeddings. The index stays local, but retrieved context may be sent to the selected cloud model.",
    },
    {
        icon: SquareHalf,
        title: "Create useful artifacts",
        body: "Make presentations, documents, code, and files with Canvas, Python, npm packages, and browser tools beside the thread.",
    },
] as const;

export function UseCases() {
    return (
        <section
            id="use-cases"
            className="mx-auto max-w-6xl scroll-mt-28 px-5 py-16 sm:px-8 sm:py-20"
            data-anim-gate="use-cases"
        >
            <MaskedHeading className="max-w-[16ch] text-3xl font-medium tracking-[-0.035em] text-white sm:text-4xl">
                Browser-owned by default. Capable by design.
            </MaskedHeading>
            <Reveal delayMs={40} className="mt-12">
                <ul className="grid gap-3 md:grid-cols-3">
                    {CASES.map((item) => {
                        const Icon = item.icon;
                        return (
                            <li
                                key={item.title}
                                className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-6 transition-[border-color,background-color] duration-200 hover:border-white/[0.16] hover:bg-[#111]"
                                style={{ transitionTimingFunction: EASE_OUT }}
                            >
                                <Icon weight="light" className="size-5 text-zinc-300" />
                                <h3 className="mt-5 text-[16px] font-medium tracking-tight text-white">
                                    {item.title}
                                </h3>
                                <p className="mt-2.5 text-[14px] leading-relaxed text-zinc-400">
                                    {item.body}
                                </p>
                            </li>
                        );
                    })}
                </ul>
            </Reveal>
            <Reveal delayMs={80} className="mt-12 border-t border-white/[0.08] pt-7">
                <nav aria-label="ai.diy product guides">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                        Explore the product
                    </p>
                    <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-300">
                        {SEO_GUIDES.map((guide) => (
                            <li key={guide.slug}>
                                <Link
                                    to={guide.path}
                                    className="underline decoration-white/20 underline-offset-4 transition-colors hover:text-white hover:decoration-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                                >
                                    {guide.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>
            </Reveal>
        </section>
    );
}
