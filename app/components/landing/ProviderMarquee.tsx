import { PROVIDER_LOGOS } from "./constants";
import { MaskedHeading } from "./MaskedHeading";
import { Reveal } from "./DoubleBezel";

export function ProviderMarquee() {
    return (
        <section
            id="providers"
            className="relative overflow-hidden border-y border-white/[0.08] py-20 sm:py-24"
            data-anim-gate="marquee"
            aria-label="Supported providers"
        >
            <div className="mx-auto max-w-6xl px-5 sm:px-8">
                <MaskedHeading className="max-w-[13ch] text-3xl font-medium tracking-[-0.035em] text-white sm:text-4xl">
                    Bring any model into the same thread.
                </MaskedHeading>
                <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
                    Connect 20+ cloud and local providers, then switch models without moving
                    your workspace or copying context between apps.
                </p>
            </div>

            <Reveal delayMs={40} className="mt-12">
                <ul className="mx-auto grid max-w-6xl grid-cols-2 border-y border-white/[0.08] px-5 sm:grid-cols-3 sm:px-8 lg:grid-cols-5">
                    {PROVIDER_LOGOS.map((logo) => (
                        <li
                            key={logo.id}
                            className="group flex min-h-16 items-center gap-3 border-b border-white/[0.08] px-2 py-4 transition-colors duration-300 hover:bg-white/[0.02] sm:px-3 lg:min-h-[4.5rem] lg:[&:nth-child(-n+5)]:border-t-0"
                        >
                            <img
                                src={logo.src}
                                alt={logo.label}
                                width={20}
                                height={20}
                                className="size-5 shrink-0 object-contain opacity-55 grayscale transition-[filter,opacity] duration-300 ease-out group-hover:opacity-100 group-hover:grayscale-0"
                                loading="lazy"
                            />
                            <span className="text-sm text-zinc-300 transition-colors duration-300 group-hover:text-white">{logo.label}</span>
                        </li>
                    ))}
                </ul>
                <p className="mx-auto mt-6 max-w-6xl px-5 text-[13px] leading-relaxed text-zinc-500 sm:px-8">
                    Also supported: Anthropic, Groq, Mistral, Bedrock, Azure, Vertex, Together,
                    Hugging Face, LM Studio, and custom OpenAI-compatible endpoints.
                </p>
            </Reveal>
        </section>
    );
}