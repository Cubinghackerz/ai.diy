import { SectionLabel } from "./SectionLabel";
import { DOCS_URL, PROVIDER_INTEGRATION_COUNT, PROVIDER_LOGOS } from "./constants";
import { MaskedHeading } from "./MaskedHeading";
import { Reveal } from "./DoubleBezel";

const MORE_PROVIDERS = PROVIDER_INTEGRATION_COUNT - PROVIDER_LOGOS.length;

/** Eight cells (seven logos plus the "more" link) fill two clean rows at every width. */
const CELL =
    "group flex min-h-16 items-center gap-3 border-b border-white/[0.08] px-2 py-4 transition-colors duration-200 hover:bg-white/[0.03] sm:px-3 lg:min-h-[4.5rem] max-sm:[&:nth-child(2n)]:border-l max-sm:[&:nth-last-child(-n+2)]:border-b-0 sm:[&:not(:nth-child(4n+1))]:border-l sm:[&:nth-last-child(-n+4)]:border-b-0";

export function ProviderMarquee() {
    return (
        <section
            id="providers"
            className="relative overflow-hidden py-20 sm:py-28"
            data-anim-gate="marquee"
            aria-label="Supported providers"
        >
            <div className="mx-auto max-w-6xl px-5 sm:px-8">
                <SectionLabel index="02">Providers</SectionLabel>
                <MaskedHeading className="max-w-[13ch] text-3xl font-medium tracking-[-0.035em] text-white sm:text-4xl">
                    Bring any model into the same thread.
                </MaskedHeading>
                <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
                    Connect {PROVIDER_INTEGRATION_COUNT} cloud and local providers, then switch
                    models without moving your workspace or copying context between apps.
                </p>
            </div>

            <Reveal delayMs={40} className="mt-12">
                <ul className="mx-auto grid max-w-6xl grid-cols-2 border-y border-white/[0.08] px-5 sm:grid-cols-4 sm:px-8">
                    {PROVIDER_LOGOS.map((logo) => (
                        <li key={logo.id} className={CELL}>
                            <img
                                src={logo.src}
                                alt={logo.label}
                                width={20}
                                height={20}
                                className="size-5 shrink-0 object-contain opacity-55 grayscale transition-[filter,opacity] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:opacity-100 group-hover:grayscale-0"
                                loading="lazy"
                            />
                            <span className="text-sm text-zinc-300 transition-colors duration-200 group-hover:text-white">
                                {logo.label}
                            </span>
                        </li>
                    ))}
                    <li className={CELL}>
                        <a
                            href={DOCS_URL}
                            className="flex min-h-10 flex-1 items-center text-sm text-zinc-300 underline-offset-4 outline-none transition-colors duration-200 hover:text-white hover:underline focus-visible:ring-2 focus-visible:ring-white/50"
                        >
                            +{MORE_PROVIDERS} more providers
                        </a>
                    </li>
                </ul>
                <p className="mx-auto mt-6 max-w-6xl px-5 text-[13px] leading-relaxed text-zinc-400 sm:px-8">
                    Also supported: Anthropic, Groq, Mistral, Bedrock, Azure, Vertex, Together,
                    Hugging Face, LM Studio, and custom OpenAI-compatible endpoints.
                </p>
                <p className="mx-auto mt-2 max-w-6xl px-5 text-[13px] leading-relaxed text-zinc-400 sm:px-8">
                    No key to paste? Sign in with a ChatGPT, Grok, or Kimi plan instead (beta).
                    Those sessions live in an encrypted server session, not in browser storage.
                </p>
            </Reveal>
        </section>
    );
}
