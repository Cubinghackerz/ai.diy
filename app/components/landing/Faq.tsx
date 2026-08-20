import { CaretDown } from "@phosphor-icons/react";
import { Reveal } from "./DoubleBezel";
import { MaskedHeading } from "./MaskedHeading";

export const FAQ_ITEMS = [
    {
        question: "What is ai.diy?",
        answer:
            "ai.diy is an open-source, self-hosted AI workspace for chat, research, tools, Canvas artifacts, memory, and local knowledge. It uses bring-your-own-key (BYOK) access so you choose the provider and model instead of being locked into one hosted AI service.",
    },
    {
        question: "Are my AI provider keys stored on the ai.diy server?",
        answer:
            "No server-side LLM credentials are required. Provider keys are kept in your browser and relayed per request to the provider you select. A hosted instance operator can observe traffic in transit, so self-host ai.diy when you need control over the infrastructure and network boundary.",
    },
    {
        question: "Where does ai.diy store chats and documents?",
        answer:
            "Chats, files, Canvas artifacts, memory, on-device knowledge-base chunks, usage events, and preview sessions persist in your browser through IndexedDB and localStorage. Optional S3, WebDAV, or Google Drive backups are client-side features that you enable yourself.",
    },
    {
        question: "Which AI providers work with ai.diy?",
        answer:
            "ai.diy supports 20+ integrations including OpenAI, ChatGPT subscription, Anthropic, Google Gemini, Groq, Cerebras, Fireworks, Perplexity, Cohere, OpenRouter, DeepSeek, xAI, Ollama, Mistral, Hugging Face, Amazon Bedrock, Azure, Vertex, Vercel Gateway, Together, LM Studio, and custom OpenAI-compatible endpoints.",
    },
    {
        question: "Can I self-host ai.diy?",
        answer:
            "Yes. Run the production build on a standard Node.js server or use Docker Compose. The server acts as a request relay and does not need provider API keys in environment variables. You can open the hosted demo first or deploy the MIT-licensed source code on infrastructure you control.",
    },
    {
        question: "Does ai.diy replace my AI provider or pay for model usage?",
        answer:
            "No. ai.diy is the workspace layer. You bring authorized provider keys or connect local models such as Ollama and LM Studio. Provider pricing, quotas, availability, and data policies remain controlled by each provider, and any usage charges are yours.",
    },
] as const;

export function Faq() {
    return (
        <section
            id="faq"
            aria-labelledby="faq-heading"
            className="mx-auto max-w-4xl scroll-mt-28 px-5 py-16 sm:px-8 sm:py-20"
            data-anim-gate="faq"
        >
            <Reveal>
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
                        <details key={item.question} className="group py-5 first:pt-1 last:pb-1">
                            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-5 py-4 text-left text-[16px] font-medium text-white outline-none transition-colors marker:hidden hover:text-zinc-200 focus-visible:text-zinc-200 [&::-webkit-details-marker]:hidden">
                                {item.question}
                                <CaretDown
                                    weight="light"
                                    className="size-5 shrink-0 text-zinc-400 transition-transform duration-200 group-open:rotate-180"
                                    aria-hidden
                                />
                            </summary>
                            <p className="max-w-3xl pb-3 pr-8 text-[14px] leading-relaxed text-zinc-400">
                                {item.answer}
                            </p>
                        </details>
                    ))}
                </div>
            </Reveal>
        </section>
    );
}
