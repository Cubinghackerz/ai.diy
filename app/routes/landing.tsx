/**
 * ai.diy landing — Ethereal Glass × Resend blackspace, Cloudflare-scale structure.
 *
 * THESIS: Ownership is a mechanism you can see.
 * FORM: OLED blackspace + luminous panels + dotted stage rails + blueprint frames.
 * STORY: Grasp BYOK local-first ownership → open /workspace or deploy.
 */
import type { HeadersFunction, LinksFunction, MetaFunction } from "react-router";
import { CapabilityRack } from "~/components/landing/CapabilityRack";
import { ClosingBand } from "~/components/landing/ClosingBand";
import { DeployTerminal } from "~/components/landing/DeployTerminal";
import { Hero } from "~/components/landing/Hero";
import { IslandNav } from "~/components/landing/IslandNav";
import { LandingFooter } from "~/components/landing/LandingFooter";
import { LandingShell } from "~/components/landing/LandingShell";
import { OwnershipStage } from "~/components/landing/OwnershipStage";
import { ProviderMarquee } from "~/components/landing/ProviderMarquee";
import { UseCases } from "~/components/landing/UseCases";
import { versionedAsset } from "~/lib/build";
import { PUBLIC_DOCUMENT_HEADERS } from "~/lib/http-headers";
import {
    SITE_DESCRIPTION,
    SITE_IMAGE_URL,
    SITE_NAME,
    SITE_TITLE,
    SITE_TWITTER_HANDLE,
    SITE_URL,
} from "~/lib/site";

export const headers: HeadersFunction = () => PUBLIC_DOCUMENT_HEADERS;

export const meta: MetaFunction = () => [
    { title: SITE_TITLE },
    { name: "description", content: SITE_DESCRIPTION },
    { name: "color-scheme", content: "dark light" },
    { name: "robots", content: "index, follow" },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:title", content: SITE_TITLE },
    { property: "og:description", content: SITE_DESCRIPTION },
    { property: "og:url", content: `${SITE_URL}/` },
    { property: "og:image", content: SITE_IMAGE_URL },
    { property: "og:image:type", content: "image/png" },
    { property: "og:image:secure_url", content: SITE_IMAGE_URL },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: SITE_TITLE },
    { property: "og:locale", content: "en_US" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:site", content: SITE_TWITTER_HANDLE },
    { name: "twitter:creator", content: SITE_TWITTER_HANDLE },
    { name: "twitter:title", content: SITE_TITLE },
    { name: "twitter:description", content: SITE_DESCRIPTION },
    { name: "twitter:image", content: SITE_IMAGE_URL },
    { name: "twitter:image:alt", content: SITE_TITLE },
];

export const links: LinksFunction = () => [
    { rel: "canonical", href: `${SITE_URL}/` },
    {
        rel: "preload",
        as: "image",
        href: versionedAsset("/ai-diy-mark-white.png"),
        type: "image/png",
    },
    {
        rel: "preload",
        as: "image",
        href: "/workspace-demo.png",
        type: "image/png",
    },
    {
        rel: "preload",
        as: "video",
        href: "/AI-DIY_DEMO.mp4",
        type: "video/mp4",
    },
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
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@graph": [
                            {
                                "@type": "SoftwareApplication",
                                name: SITE_NAME,
                                applicationCategory: "ProductivityApplication",
                                operatingSystem: "Web browser",
                                description: SITE_DESCRIPTION,
                                url: SITE_URL,
                                image: SITE_IMAGE_URL,
                                logo: `${SITE_URL}${versionedAsset("/ai-diy-new-logo-white.png")}`,
                                isAccessibleForFree: true,
                                license: "https://opensource.org/license/mit/",
                                sameAs: [
                                    "https://github.com/Cubinghackerz/ai.diy",
                                    "https://x.com/HeckingHacker",
                                ],
                            },
                            {
                                "@type": "WebSite",
                                name: SITE_NAME,
                                url: SITE_URL,
                                inLanguage: "en-US",
                            },
                            {
                                "@type": "VideoObject",
                                name: "ai.diy workspace demo",
                                description: SITE_DESCRIPTION,
                                thumbnailUrl: `${SITE_URL}/workspace-demo.png`,
                                uploadDate: "2026-08-16",
                                contentUrl: `${SITE_URL}/AI-DIY_DEMO.mp4`,
                            },
                        ],
                    }),
                }}
            />
            <IslandNav />
            <main>
                <Hero />
                <OwnershipStage />
                <ProviderMarquee />
                <UseCases />
                <CapabilityRack />
                <DeployTerminal />
                <ClosingBand />
            </main>
            <LandingFooter />
        </LandingShell>
    );
}
