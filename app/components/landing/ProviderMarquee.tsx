import { PROVIDER_LOGOS } from "./constants";
import { Reveal } from "./DoubleBezel";

export function ProviderMarquee() {
    return (
        <section
            id="providers"
            className="relative overflow-hidden border-y border-white/[0.08] py-20 sm:py-24"
            data-anim-gate="marquee"
            aria-label="Supported providers"
        >
            <Reveal>
                <div className="mx-auto grid max-w-6xl gap-8 px-5 sm:px-8 md:grid-cols-[0.85fr_1.15fr] md:items-end md:gap-12">
                    <h2 className="max-w-[13ch] text-3xl font-medium tracking-[-0.035em] text-white sm:text-4xl">
                        Bring any model into the same thread.
                    </h2>
                    <p className="max-w-xl text-[15px] leading-relaxed text-zinc-400 md:justify-self-end">
                        Connect 20+ cloud and local providers, then switch models without moving
                        your workspace or copying context between apps.
                    </p>
                </div>
            </Reveal>

            <Reveal delayMs={40} className="mt-12">
                <ul className="mx-auto grid max-w-6xl grid-cols-2 border-y border-white/[0.08] px-5 sm:grid-cols-3 sm:px-8 lg:grid-cols-5">
                    {PROVIDER_LOGOS.map((logo) => (
                        <li
                            key={logo.id}
                            className="flex min-h-16 items-center gap-3 border-b border-white/[0.08] px-2 py-4 sm:px-3 lg:min-h-[4.5rem] lg:[&:nth-child(-n+5)]:border-t-0"
                        >
                            <img
                                src={logo.src}
                                alt={logo.label}
                                width={24}
                                height={24}
                                className="size-6 shrink-0 object-contain opacity-60 grayscale transition-[filter,opacity] duration-300 hover:opacity-100 hover:grayscale-0"
                                loading="lazy"
                            />
                            <span className="text-sm text-zinc-300">{logo.label}</span>
                        </li>
                    ))}
                </ul>
                <p className="mx-auto mt-7 max-w-6xl px-5 font-mono text-[10px] leading-relaxed tracking-[0.12em] text-zinc-600 sm:px-8 sm:text-[11px]">
                    ALSO AVAILABLE: ANTHROPIC · GROQ · MISTRAL · BEDROCK · AZURE · VERTEX · TOGETHER · HUGGING FACE · LM STUDIO · CUSTOM ENDPOINTS
                </p>
            </Reveal>
        </section>
    );
}
