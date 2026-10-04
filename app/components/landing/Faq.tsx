import { PROVIDER_INTEGRATION_SUMMARY } from "./constants";
import { SectionLabel } from "./SectionLabel";
import { CaretDown } from "@phosphor-icons/react";
import { Reveal } from "./DoubleBezel";
import { MaskedHeading } from "./MaskedHeading";

/** Matches --acc-collapse / --acc-chevron in app/styles/app.css. */
const ACC_CLOSE_MS = 250;

export const FAQ_ITEMS = [
    {
        question: "What is ai.diy?",
        answer: "ai.diy is an open-source, self-hosted AI workspace for chat, research, tools, Canvas artifacts, memory, and local knowledge. It uses bring-your-own-key (BYOK) access so you choose the provider and model instead of being locked into one hosted AI service.",
    },
    {
        question: "Are my AI provider keys stored on the ai.diy server?",
        answer: "No. Provider keys stay in the browser and are relayed per request. The server does not keep them as persistent secrets. Self-host when you need control of the network boundary.",
    },
    {
        question: "Where does ai.diy store chats and documents?",
        answer: "In the browser. Threads, files, Canvas artifacts, memory, knowledge chunks, usage events, and preview sessions use IndexedDB. Settings use localStorage, encrypted with AES-GCM when Web Crypto and IndexedDB are available. Optional S3, WebDAV, and Google Drive backups are client-side and off until you enable them.",
    },
    {
        question: "Which AI providers work with ai.diy?",
        answer: `ai.diy supports ${PROVIDER_INTEGRATION_SUMMARY}`,
    },
    {
        question: "Can I self-host ai.diy?",
        answer: "Yes. Run the production build on a standard Node.js server or use Docker Compose. The server acts as a request relay and does not need provider API keys in environment variables. You can open the hosted demo first or deploy the MIT-licensed source code on infrastructure you control.",
    },
    {
        question: "Does ai.diy replace my AI provider or pay for model usage?",
        answer: "No. ai.diy is the workspace layer. You bring authorized provider keys or connect local models such as Ollama and LM Studio. Provider pricing, quotas, availability, and data policies remain controlled by each provider, and any usage charges are yours.",
    },
] as const;

export function Faq() {
    return (
        <section
            id="faq"
            aria-labelledby="faq-heading"
            className="mx-auto max-w-4xl scroll-mt-28 px-5 py-20 sm:px-8 sm:py-28"
            data-anim-gate="faq"
        >
            <Reveal>
                <SectionLabel index="07">FAQ</SectionLabel>
                <MaskedHeading
                    id="faq-heading"
                    className="max-w-[18ch] text-3xl font-medium tracking-[-0.035em] text-white sm:text-4xl"
                >
                    Frequently asked questions.
                </MaskedHeading>
                <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
                    Understand the ownership model, supported AI providers, browser storage, and
                    self-hosting path before you open the workspace.
                </p>
            </Reveal>

            <Reveal delayMs={40} className="mt-8">
                <div className="divide-y divide-white/[0.08] border-t border-white/[0.08]">
                    {FAQ_ITEMS.map((item) => (
                        <details key={item.question} className="t-acc py-5 first:pt-1 last:pb-1">
                            <summary
                                onClick={(event) => {
                                    const details = event.currentTarget.closest("details");
                                    if (!details || !details.open) return;
                                    event.preventDefault();
                                    details.classList.add("is-closing");
                                    window.setTimeout(() => {
                                        details.open = false;
                                        details.classList.remove("is-closing");
                                    }, ACC_CLOSE_MS);
                                }}
                                className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-5 py-4 text-left text-[16px] font-medium text-white outline-none transition-colors marker:hidden hover:text-zinc-200 focus-visible:text-zinc-200 [&::-webkit-details-marker]:hidden"
                            >
                                {item.question}
                                <span className="t-acc-chevron shrink-0" aria-hidden>
                                    <CaretDown weight="light" className="size-5 text-zinc-400" />
                                </span>
                            </summary>
                            <div className="t-acc-panel">
                                <div className="t-acc-panel-inner">
                                    <p className="max-w-3xl pb-3 pr-8 text-[14px] leading-relaxed text-zinc-400">
                                        {item.answer}
                                    </p>
                                </div>
                            </div>
                        </details>
                    ))}
                </div>
            </Reveal>
        </section>
    );
}
