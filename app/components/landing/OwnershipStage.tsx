import { InspectDataPlane } from "./InspectDataPlane";
import { SectionLabel } from "./SectionLabel";
import { MaskedHeading } from "./MaskedHeading";

export function OwnershipStage() {
    return (
        <section
            id="features"
            className="relative mx-auto max-w-6xl scroll-mt-28 px-5 py-20 sm:px-8 sm:py-28"
            data-anim-gate="ownership-stage"
        >
            <SectionLabel index="01">Ownership</SectionLabel>
            <div className="grid gap-6 md:grid-cols-[0.85fr_1.15fr] md:items-end md:gap-12">
                <MaskedHeading className="max-w-[12ch] text-4xl font-medium tracking-[-0.04em] text-white sm:text-5xl">
                    Your keys stay under your control.
                </MaskedHeading>
                <p className="max-w-xl text-[15px] leading-relaxed text-zinc-400 md:justify-self-end">
                    Inspect where a request is read, forwarded, and saved. Nothing here is a
                    persistent server-side key store.
                </p>
            </div>

            <div className="mt-10">
                <InspectDataPlane />
            </div>
        </section>
    );
}
