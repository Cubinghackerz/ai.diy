import { Code, Files, SquareHalf } from "@phosphor-icons/react";
import { Link } from "react-router";
import { Reveal } from "./DoubleBezel";
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
        body: "Search your notes and PDFs with on-device embeddings. The knowledge base never leaves this machine.",
    },
    {
        icon: SquareHalf,
        title: "Interactive Canvas",
        body: "Preview HTML, Python files, and code artifacts beside the thread — live outputs without cloud lock-in.",
    },
] as const;

export function UseCases() {
    return (
        <section
            id="use-cases"
            className="mx-auto max-w-6xl scroll-mt-28 px-5 py-16 sm:px-8 sm:py-20"
            data-anim-gate="use-cases"
        >
            <Reveal>
                <h2 className="max-w-[16ch] text-3xl font-medium tracking-[-0.035em] text-white sm:text-4xl">
                    Private by default. Capable by design.
                </h2>
            </Reveal>
            <Reveal delayMs={40} className="mt-12">
                <ul className="grid gap-10 md:grid-cols-3 md:gap-8">
                    {CASES.map((item) => {
                        const Icon = item.icon;
                        return (
                            <li key={item.title} className="border-t border-white/[0.1] pt-7">
                                <Icon weight="light" className="size-6 text-zinc-200" />
                                <h3 className="mt-5 text-[17px] font-medium tracking-tight text-white">
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
            <Reveal delayMs={80} className="mt-12 border-t border-white/[0.1] pt-7">
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
