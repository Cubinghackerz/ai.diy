import { PROVIDER_LOGOS } from "./constants";
import { Reveal } from "./DoubleBezel";

/** Static provider density band — not a card grid, not a marquee loop. */
export function ProviderMarquee() {
    return (
        <section
            className="relative border-y border-white/[0.12] py-16 sm:py-20"
            data-anim-gate="marquee"
            aria-label="Supported providers"
        >
            <Reveal>
                <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
                    <h2 className="text-3xl font-medium tracking-[-0.035em] text-white sm:text-4xl">
                        One workspace.
                        <br className="hidden sm:block" /> Every model you already pay for.
                    </h2>
                    <p className="mt-4 text-[15px] leading-relaxed text-zinc-300">
                        Cloud providers, local Ollama/LM Studio, and custom OpenAI-compatible
                        endpoints — without surrendering your keys.
                    </p>
                </div>
            </Reveal>

            <Reveal delayMs={40} className="mt-12">
                <ul className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-8 gap-y-6 px-5 sm:gap-x-12 sm:px-8">
                    {PROVIDER_LOGOS.map((logo) => (
                        <li
                            key={logo.id}
                            className="flex items-center gap-3 text-[13px] font-medium tracking-tight text-zinc-200"
                        >
                            <img
                                src={logo.src}
                                alt=""
                                width={28}
                                height={28}
                                className="size-7 object-contain opacity-90"
                                loading="lazy"
                            />
                            {logo.label}
                        </li>
                    ))}
                </ul>
            </Reveal>
        </section>
    );
}
