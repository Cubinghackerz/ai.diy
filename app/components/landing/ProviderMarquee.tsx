import { PROVIDER_LOGOS } from "./constants";
import { Reveal } from "./DoubleBezel";

/** Static provider shelf — sleek marks, no infinite logo loop. */
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
                <div className="mx-auto grid max-w-4xl grid-cols-2 gap-3 px-5 sm:grid-cols-4 sm:gap-4 sm:px-8">
                    {PROVIDER_LOGOS.map((logo) => (
                        <div
                            key={logo.id}
                            className="flex min-h-[5.25rem] flex-col items-center justify-center gap-3 rounded-2xl border border-white/[0.12] bg-white/[0.05] px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-[border-color,background-color] duration-200 hover:border-white/25 hover:bg-white/[0.08]"
                        >
                            <img
                                src={logo.src}
                                alt=""
                                width={32}
                                height={32}
                                className="size-8 object-contain"
                                loading="lazy"
                            />
                            <span className="text-[13px] font-medium tracking-tight text-zinc-100">
                                {logo.label}
                            </span>
                        </div>
                    ))}
                </div>
            </Reveal>
        </section>
    );
}
