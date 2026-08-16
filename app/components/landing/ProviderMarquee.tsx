import { PROVIDER_LOGOS } from "./constants";
import { Reveal } from "./DoubleBezel";

export function ProviderMarquee() {
    return (
        <section
            id="providers"
            className="relative border-y border-white/[0.12] py-16 sm:py-20"
            data-anim-gate="marquee"
            aria-label="Supported providers"
        >
            <Reveal>
                <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
                    <h2 className="text-3xl font-medium tracking-[-0.035em] text-white sm:text-4xl">
                        One workspace. Every model you already pay for.
                    </h2>
                    <p className="mt-4 text-[15px] leading-relaxed text-zinc-300">
                        Seventeen cloud and local providers, plus custom OpenAI-compatible
                        endpoints. Switch mid-thread. Keys stay in the browser.
                    </p>
                </div>
            </Reveal>

            <Reveal delayMs={40} className="mt-12">
                <ul className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-3 px-5 sm:px-8">
                    {PROVIDER_LOGOS.map((logo) => (
                        <li
                            key={logo.id}
                            className="inline-flex items-center gap-2.5 rounded-full border border-white/[0.12] bg-white/[0.05] px-3.5 py-2 text-[13px] font-medium tracking-tight text-zinc-100"
                        >
                            <img
                                src={logo.src}
                                alt=""
                                width={22}
                                height={22}
                                className="size-[22px] object-contain opacity-95"
                                loading="lazy"
                            />
                            {logo.label}
                        </li>
                    ))}
                    <li className="inline-flex items-center rounded-full border border-dashed border-white/20 px-3.5 py-2 text-[13px] text-zinc-400">
                        + Bedrock, Azure, Vertex, Together, Hugging Face, LM Studio
                    </li>
                </ul>
            </Reveal>
        </section>
    );
}
