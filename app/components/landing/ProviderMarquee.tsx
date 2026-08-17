import { PROVIDER_LOGOS } from "./constants";
import { Reveal } from "./DoubleBezel";
import { SectionIndex } from "./SectionIndex";

export function ProviderMarquee() {
    return (
        <section
            id="providers"
            className="relative border-y border-white/[0.08] py-20 sm:py-24"
            data-anim-gate="marquee"
            aria-label="Supported providers"
        >
            <Reveal>
                <div className="mx-auto max-w-3xl px-5 sm:px-8">
                    <SectionIndex index="03" label="PROVIDERS" />
                    <h2 className="text-center text-3xl font-medium tracking-[-0.035em] text-white sm:text-4xl">
                        One workspace. Every provider.
                    </h2>
                    <p className="mt-4 text-center text-[15px] leading-relaxed text-zinc-400">
                        Seventeen cloud and local providers, plus custom OpenAI-compatible
                        endpoints. Switch models mid-thread without moving your workspace.
                    </p>
                </div>
            </Reveal>

            <Reveal delayMs={40} className="mt-12">
                <ul className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-7 px-5 sm:px-8">
                    {PROVIDER_LOGOS.map((logo) => (
                        <li key={logo.id}>
                            <img
                                src={logo.src}
                                alt=""
                                width={28}
                                height={28}
                                className="h-7 w-auto object-contain opacity-50 grayscale transition-[filter,opacity] duration-300 hover:opacity-100 hover:grayscale-0"
                                loading="lazy"
                            />
                            <span className="sr-only">{logo.label}</span>
                        </li>
                    ))}
                </ul>
                <p className="mt-9 px-5 text-center font-mono text-[10px] tracking-[0.12em] text-zinc-600 sm:text-[11px]">
                    + BEDROCK · AZURE · VERTEX · TOGETHER · HUGGING FACE · LM STUDIO · CUSTOM ENDPOINTS
                </p>
            </Reveal>
        </section>
    );
}
