import { Code, FilePy, SquareHalf } from "@phosphor-icons/react";
import { Link } from "react-router";
import { Reveal } from "./DoubleBezel";
import { MaskedHeading } from "./MaskedHeading";
import { SectionLabel } from "./SectionLabel";
import { SEO_GUIDES } from "~/lib/seo-pages";

const LANES = [
    {
        icon: SquareHalf,
        kicker: "CANVAS",
        title: "Artifacts beside the thread",
        rows: [
            ["Kinds", "Text, HTML previews, images, Python binaries"],
            ["Persistence", "Saved with the chat in IndexedDB"],
            ["Limit", "Oversized binaries stay downloadable in-session"],
        ],
    },
    {
        icon: FilePy,
        kicker: "PYTHON",
        title: "Browser Python, not a server runtime",
        rows: [
            ["Runtime", "Pyodide in the tab"],
            ["Output", "Charts and files land in Canvas"],
            ["Storage", "Generated images and binaries persist in IndexedDB"],
        ],
    },
    {
        icon: Code,
        kicker: "KNOWLEDGE",
        title: "Settings → Knowledge Base",
        rows: [
            ["Index", "On-device WASM embeddings + HNSW"],
            ["Stays local", "Not uploaded to a vendor vector store"],
            ["Leaves the browser", "Retrieved context may be sent to the selected cloud model"],
        ],
    },
] as const;

export function InUse() {
    return (
        <section
            id="in-use"
            className="mx-auto max-w-6xl scroll-mt-28 px-5 py-20 sm:px-8 sm:py-28"
            data-anim-gate="in-use"
        >
            <SectionLabel index="04">In use</SectionLabel>
            <MaskedHeading className="max-w-[16ch] text-3xl font-medium tracking-[-0.035em] text-white sm:text-4xl">
                What the workspace actually does.
            </MaskedHeading>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
                Spec rows from the product, not cropped screenshots of an empty composer.
            </p>
            <Reveal delayMs={40} className="mt-10">
                <div className="grid gap-px border border-white/[0.08] bg-white/[0.08] md:grid-cols-3">
                    {LANES.map((lane) => {
                        const Icon = lane.icon;
                        return (
                            <article key={lane.kicker} className="bg-black px-5 py-5">
                                <Icon weight="light" className="size-5 text-zinc-300" />
                                <p className="mt-4 font-mono text-[10px] tracking-[0.16em] text-zinc-400">
                                    {lane.kicker}
                                </p>
                                <h3 className="mt-2 text-[16px] font-medium tracking-tight text-white">
                                    {lane.title}
                                </h3>
                                <dl className="mt-4 space-y-3">
                                    {lane.rows.map(([key, value]) => (
                                        <div key={key}>
                                            <dt className="font-mono text-[10px] tracking-wide text-zinc-400">
                                                {key}
                                            </dt>
                                            <dd className="mt-1 text-[13px] leading-snug text-zinc-300">
                                                {value}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            </article>
                        );
                    })}
                </div>
            </Reveal>
            <Reveal delayMs={80} className="mt-12 border-t border-white/[0.08] pt-7">
                <nav aria-label="ai.diy product guides">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
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
