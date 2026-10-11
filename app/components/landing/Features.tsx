import { AppWindow, Books, CloudArrowUp, FilePy, Plug, SquareHalf } from "@phosphor-icons/react";
import { Link } from "react-router";
import { SEO_GUIDES } from "~/lib/seo-pages";
import { Reveal } from "./Reveal";
import { SectionHeader } from "./SectionHeader";

const FEATURES = [
    {
        icon: SquareHalf,
        title: "Canvas",
        body: "Artifacts open beside the thread: text, HTML previews, images, and Python output. They are saved with the chat in IndexedDB.",
    },
    {
        icon: FilePy,
        title: "Python in the tab",
        body: "Pyodide runs in your browser, not on a server. Charts and files land in Canvas.",
    },
    {
        icon: Books,
        title: "Knowledge base",
        body: "On-device WASM embeddings and search. Documents are not uploaded to a vendor vector store; retrieved context may be sent to the model you choose.",
    },
    {
        icon: Plug,
        title: "Tools and MCP",
        body: "Keyless web search (DuckDuckGo, Firecrawl, Parallel), URL fetch, a calculator, remote MCP servers, and skills. You choose what the model may use.",
    },
    {
        icon: AppWindow,
        title: "Connected apps",
        body: "Authorize Gmail, GitHub, Notion, Slack, and more through Composio with your own key. The assistant acts only in the tools you connect.",
    },
    {
        icon: CloudArrowUp,
        title: "Backups you control",
        body: "Export your chats, or back up to S3, WebDAV, or Google Drive straight from the browser. Off until you turn it on.",
    },
] as const;

export function Features() {
    return (
        <section
            id="capabilities"
            className="mx-auto max-w-6xl scroll-mt-14 px-6 py-24 sm:py-32"
            data-anim-gate="features"
        >
            <SectionHeader title="Everything in one workspace.">
                Create files, run code, search the web, and connect your apps with the models you
                already use.
            </SectionHeader>

            <Reveal delayMs={40} className="mt-12">
                <div className="grid gap-px overflow-hidden rounded-[6px] border border-white/[0.08] bg-white/[0.08] sm:grid-cols-2 lg:grid-cols-3">
                    {FEATURES.map((feature) => {
                        const Icon = feature.icon;
                        return (
                            <article key={feature.title} className="bg-black p-6">
                                <Icon weight="light" className="size-5 text-zinc-300" />
                                <h3 className="mt-4 text-[15px] font-medium text-white">
                                    {feature.title}
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                                    {feature.body}
                                </p>
                            </article>
                        );
                    })}
                </div>
                <nav aria-label="ai.diy product guides" className="mt-8">
                    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-400">
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
