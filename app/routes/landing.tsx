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
import { FAQ_ITEMS, Faq } from "~/components/landing/Faq";
import { Hero } from "~/components/landing/Hero";
import { IslandNav } from "~/components/landing/IslandNav";
import { LandingFooter } from "~/components/landing/LandingFooter";
import { LandingShell } from "~/components/landing/LandingShell";
import { OwnershipStage } from "~/components/landing/OwnershipStage";
import { ProviderMarquee } from "~/components/landing/ProviderMarquee";
import { UseCases } from "~/components/landing/UseCases";
import { versionedAsset } from "~/lib/build";
import { PUBLIC_DOCUMENT_HEADERS } from "~/lib/http-headers";
import { pageMeta } from "~/lib/seo";
import {
    GOOGLE_SITE_VERIFICATION,
    SITE_DESCRIPTION,
    SITE_IMAGE_ALT,
    SITE_IMAGE_URL,
    SITE_LAST_MODIFIED,
    SITE_LOGO_URL,
    SITE_NAME,
    SITE_REPOSITORY_URL,
    SITE_SOCIAL_URLS,
    SITE_TITLE,
    SITE_URL,
} from "~/lib/site";

export const headers: HeadersFunction = () => PUBLIC_DOCUMENT_HEADERS;

const STRUCTURED_DATA = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "Organization",
            "@id": `${SITE_URL}/#organization`,
            name: SITE_NAME,
            url: SITE_URL,
            logo: {
                "@type": "ImageObject",
                url: SITE_LOGO_URL,
            },
            sameAs: SITE_SOCIAL_URLS,
        },
        {
            "@type": "WebSite",
            "@id": `${SITE_URL}/#website`,
            name: SITE_NAME,
            url: SITE_URL,
            description: SITE_DESCRIPTION,
            inLanguage: "en-US",
            publisher: { "@id": `${SITE_URL}/#organization` },
        },
        {
            "@type": "WebPage",
            "@id": `${SITE_URL}/#webpage`,
            url: `${SITE_URL}/`,
            name: SITE_TITLE,
            description: SITE_DESCRIPTION,
            dateModified: SITE_LAST_MODIFIED,
            isPartOf: { "@id": `${SITE_URL}/#website` },
            about: { "@id": `${SITE_URL}/#software` },
            primaryImageOfPage: { "@id": `${SITE_URL}/#image` },
            inLanguage: "en-US",
        },
        {
            "@type": "ImageObject",
            "@id": `${SITE_URL}/#image`,
            url: SITE_IMAGE_URL,
            contentUrl: SITE_IMAGE_URL,
            width: 1200,
            height: 630,
            caption: SITE_IMAGE_ALT,
        },
        {
            "@type": "SoftwareApplication",
            "@id": `${SITE_URL}/#software`,
            name: SITE_NAME,
            alternateName: "ai.diy AI workspace",
            applicationCategory: "ProductivityApplication",
            applicationSubCategory: "Self-hosted AI chat workspace",
            operatingSystem: "Web browser; Node.js or Docker for self-hosting",
            description: SITE_DESCRIPTION,
            url: SITE_URL,
            image: { "@id": `${SITE_URL}/#image` },
            screenshot: `${SITE_URL}/workspace-demo.png`,
            isAccessibleForFree: true,
            license: "https://opensource.org/license/mit/",
            codeRepository: SITE_REPOSITORY_URL,
            featureList: [
                "Bring-your-own-key AI chat",
                "Browser-owned chat and knowledge storage",
                "Web search and MCP tools",
                "Canvas artifacts and browser Python",
                "17 cloud and local AI providers",
                "Node.js and Docker self-hosting",
            ],
            author: { "@id": `${SITE_URL}/#organization` },
            publisher: { "@id": `${SITE_URL}/#organization` },
            mainEntityOfPage: { "@id": `${SITE_URL}/#webpage` },
        },
        {
            "@type": "VideoObject",
            "@id": `${SITE_URL}/#workspace-demo`,
            name: "ai.diy workspace demo",
            description:
                "A demo of the ai.diy local-first AI workspace with model switching, tools, and browser-owned context.",
            thumbnailUrl: `${SITE_URL}/workspace-demo.png`,
            uploadDate: SITE_LAST_MODIFIED,
            contentUrl: `${SITE_URL}/AI-DIY_DEMO.mp4`,
            isFamilyFriendly: true,
            inLanguage: "en-US",
        },
        {
            "@type": "FAQPage",
            "@id": `${SITE_URL}/#faq-page`,
            url: `${SITE_URL}/#faq`,
            mainEntity: FAQ_ITEMS.map((item) => ({
                "@type": "Question",
                name: item.question,
                acceptedAnswer: {
                    "@type": "Answer",
                    text: item.answer,
                },
            })),
        },
    ],
} as const;

export const meta: MetaFunction = () => [
    ...pageMeta({
        title: SITE_TITLE,
        description: SITE_DESCRIPTION,
        url: `${SITE_URL}/`,
        structuredData: STRUCTURED_DATA,
    }),
    { name: "google-site-verification", content: GOOGLE_SITE_VERIFICATION },
];

export const links: LinksFunction = () => [
    { rel: "canonical", href: `${SITE_URL}/` },
    {
        rel: "preconnect",
        href: "https://cdn.jsdelivr.net",
    },
    {
        rel: "dns-prefetch",
        href: "https://cdn.jsdelivr.net",
    },
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
            <main id="main-content">
                <Hero />
                <OwnershipStage />
                <ProviderMarquee />
                <UseCases />
                <CapabilityRack />
                <DeployTerminal />
                <Faq />
                <ClosingBand />
            </main>
            <LandingFooter />
        </LandingShell>
    );
}
