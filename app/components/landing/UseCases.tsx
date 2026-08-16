import { Code, Files, SquareHalf } from "@phosphor-icons/react";
import { Reveal } from "./DoubleBezel";

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
                    Private AI workflows for code, documents, and Canvas.
                </h2>
            </Reveal>
            <Reveal delayMs={40} className="mt-10">
                <ul className="grid gap-3 md:grid-cols-3">
                    {CASES.map((item) => {
                        const Icon = item.icon;
                        return (
                            <li
                                key={item.title}
                                className="min-h-[13rem] rounded-2xl border border-white/[0.12] bg-white/[0.03] p-6"
                            >
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
        </section>
    );
}
