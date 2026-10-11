import { DOCS_URL, PROVIDER_INTEGRATION_COUNT, PROVIDER_LOGOS } from "./constants";
import { Reveal } from "./Reveal";
import { SectionHeader } from "./SectionHeader";

const MORE_PROVIDERS = PROVIDER_INTEGRATION_COUNT - PROVIDER_LOGOS.length;

/** Eight cells (seven logos plus the "more" link) fill two clean rows at every width. */
const CELL =
    "group flex h-16 items-center gap-3 border-b border-white/[0.08] px-4 transition-colors duration-150 hover:bg-white/[0.03] max-sm:[&:nth-child(2n)]:border-l max-sm:[&:nth-last-child(-n+2)]:border-b-0 sm:[&:not(:nth-child(4n+1))]:border-l sm:[&:nth-last-child(-n+4)]:border-b-0";

export function Providers() {
    return (
        <section
            id="providers"
            className="mx-auto max-w-6xl scroll-mt-14 px-6 py-24 sm:py-32"
            data-anim-gate="providers"
            aria-label="Supported providers"
        >
            <SectionHeader title="Bring any model into the same thread.">
                Connect {PROVIDER_INTEGRATION_COUNT} cloud and local providers, then switch models
                without moving your workspace or copying context between apps.
            </SectionHeader>

            <Reveal delayMs={40} className="mt-12">
                <ul className="grid grid-cols-2 overflow-hidden rounded-[6px] border border-white/[0.08] sm:grid-cols-4">
                    {PROVIDER_LOGOS.map((logo) => (
                        <li key={logo.id} className={CELL}>
                            <img
                                src={logo.src}
                                alt=""
                                width={20}
                                height={20}
                                className="size-5 shrink-0 object-contain opacity-60 grayscale transition-[filter,opacity] duration-150 group-hover:opacity-100 group-hover:grayscale-0"
                                loading="lazy"
                            />
                            <span className="text-sm text-zinc-300 transition-colors duration-150 group-hover:text-white">
                                {logo.label}
                            </span>
                        </li>
                    ))}
                    <li className={CELL}>
                        <a
                            href={DOCS_URL}
                            className="flex h-10 flex-1 items-center rounded-[4px] text-sm text-zinc-300 underline-offset-4 outline-none transition-colors duration-150 hover:text-white hover:underline focus-visible:ring-2 focus-visible:ring-white/50"
                        >
                            +{MORE_PROVIDERS} more providers
                        </a>
                    </li>
                </ul>
                <p className="mt-6 max-w-3xl text-sm leading-relaxed text-zinc-400">
                    Also supported: Anthropic, Groq, Mistral, Bedrock, Azure, Vertex, Together,
                    Hugging Face, LM Studio, and custom OpenAI-compatible endpoints. No key to
                    paste? Sign in with a ChatGPT, Grok, or Kimi plan instead (beta); those sessions
                    live in an encrypted server session, not in browser storage.
                </p>
            </Reveal>
        </section>
    );
}
