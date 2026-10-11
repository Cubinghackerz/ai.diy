import { InspectDataPlane } from "./InspectDataPlane";
import { SectionHeader } from "./SectionHeader";

export function OwnershipStage() {
    return (
        <section
            id="features"
            className="mx-auto max-w-6xl scroll-mt-14 px-6 py-24 sm:py-32"
            data-anim-gate="ownership-stage"
        >
            <SectionHeader title="Your keys stay under your control.">
                Inspect where a request is read, forwarded, and saved. Nothing here is a persistent
                server-side key store.
            </SectionHeader>
            <div className="mt-12">
                <InspectDataPlane />
            </div>
        </section>
    );
}
