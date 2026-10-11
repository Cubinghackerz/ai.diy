/**
 * THESIS: Clean, simple, minimal. Say what it is, show it working, then get out of the way.
 * OWN-WORLD: #000 canvas, hairline borders, Geist, solid white actions, no gradients, no ornament.
 * STORY: A browser-owned workspace you can open now or self-host in one command.
 * FIRST VIEWPORT: A plain headline, one sentence, two buttons, and a scripted, clearly labelled workspace preview (sample data).
 * FORM: Vercel-style flat top bar, full-width hairline sections, one column of content.
 */
import type { ReactNode } from "react";
import type { HeadersFunction, LinksFunction, MetaFunction } from "react-router";
import { ClosingBand } from "~/components/landing/ClosingBand";
import { DeployTerminal } from "~/components/landing/DeployTerminal";
import { FAQ_ITEMS, Faq } from "~/components/landing/Faq";
import { Features } from "~/components/landing/Features";
import { Hero } from "~/components/landing/Hero";
import { LandingFooter } from "~/components/landing/LandingFooter";
import { LandingShell } from "~/components/landing/LandingShell";
import { OwnershipStage } from "~/components/landing/OwnershipStage";
import { Providers } from "~/components/landing/Providers";
import { SiteNav } from "~/components/landing/SiteNav";
import { PROVIDER_INTEGRATION_COUNT } from "~/components/landing/constants";
import { versionedAsset } from "~/lib/build";
import { PUBLIC_DOCUMENT_HEADERS } from "~/lib/http-headers";
import { pageMeta } from "~/lib/seo";
import {
    GOOGLE_SITE_VERIFICATION,
    SITE_DESCRIPTION,
    SITE_IMAGE_ALT,
    SITE_IMAGE_URL,
    SITE_KEYWORDS,
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
                "Connect Gmail, GitHub, Notion, and Slack via Composio",
                "Web search and MCP tools",
                "Canvas artifacts and browser Python",
                `${PROVIDER_INTEGRATION_COUNT} cloud and local AI provider integrations`,
                "Node.js and Docker self-hosting",
            ],
            keywords: SITE_KEYWORDS,
            offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
                availability: "https://schema.org/InStock",
            },
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
        rel: "stylesheet",
        href: "https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/geist-sans/style.css",
    },
    {
        rel: "stylesheet",
        href: "https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/geist-mono/style.css",
    },
];

/** Full-width hairline between sections; the content inside stays on one column. */
function Band({ children }: { children: ReactNode }) {
    return <div className="border-t border-white/[0.08]">{children}</div>;
}

export default function LandingPage() {
    return (
        <LandingShell>
            <SiteNav />
            <main id="main-content">
                <Hero />
                <Band>
                    <OwnershipStage />
                </Band>
                <Band>
                    <Providers />
                </Band>
                <Band>
                    <Features />
                </Band>
                <Band>
                    <DeployTerminal />
                </Band>
                <Band>
                    <Faq />
                </Band>
                <Band>
                    <ClosingBand />
                </Band>
            </main>
            <LandingFooter />
        </LandingShell>
    );
}
