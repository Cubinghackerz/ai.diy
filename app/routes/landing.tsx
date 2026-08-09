/**
 * ai.diy landing — Ethereal Glass × Resend blackspace.
 *
 * THESIS: Ownership is a mechanism you can see — keys stay local, providers
 * converge, artifacts emerge from chat; refuse flat generic dark SaaS.
 * OWN-WORLD: OLED #050505, zinc/white mesh (no purple), double-bezel hardware,
 * floating island nav, Geist, Phosphor Light, solid white type.
 * STORY: Visitor grasps BYOK local-first ownership and opens /workspace.
 * FIRST VIEWPORT: Island nav; announcement; brand headline; dual CTAs;
 * double-bezel product with light parallax.
 * FORM: Pinnacle Ethereal Glass / Resend hybrid.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
 */
import type { HeadersFunction, LinksFunction } from "react-router";
import { DeployTerminal } from "~/components/landing/DeployTerminal";
import { Hero } from "~/components/landing/Hero";
import { IslandNav } from "~/components/landing/IslandNav";
import { LandingFooter } from "~/components/landing/LandingFooter";
import { LandingShell } from "~/components/landing/LandingShell";
import { OwnershipBento } from "~/components/landing/OwnershipBento";
import { ProfileShowcase } from "~/components/landing/ProfileShowcase";

export const headers: HeadersFunction = () => ({
    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
});

export const links: LinksFunction = () => [
    {
        rel: "stylesheet",
        href: "https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/geist-sans/style.css",
    },
    {
        rel: "stylesheet",
        href: "https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/geist-mono/style.css",
    },
];

export default function LandingPage() {
    return (
        <LandingShell>
            <IslandNav />
            <main>
                <Hero />
                <OwnershipBento />
                <ProfileShowcase />
                <DeployTerminal />
            </main>
            <LandingFooter />
        </LandingShell>
    );
}
