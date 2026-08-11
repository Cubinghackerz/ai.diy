import type { HeadersFunction, LinksFunction, MetaFunction } from "react-router";
import { MidnightLanding } from "~/components/landing/MidnightLanding";
import {
    SITE_DESCRIPTION,
    SITE_IMAGE_URL,
    SITE_NAME,
    SITE_TITLE,
    SITE_TWITTER_HANDLE,
    SITE_URL,
} from "~/lib/site";
import "~/styles/landing.css";

export const headers: HeadersFunction = () => ({
    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
});

export const meta: MetaFunction = () => [
    { title: SITE_TITLE },
    { name: "description", content: SITE_DESCRIPTION },
    { name: "color-scheme", content: "dark" },
    { name: "robots", content: "index, follow" },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:title", content: SITE_TITLE },
    { property: "og:description", content: SITE_DESCRIPTION },
    { property: "og:url", content: `${SITE_URL}/` },
    { property: "og:image", content: SITE_IMAGE_URL },
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
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap",
    },
    {
        rel: "stylesheet",
        href: "https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/geist-mono/style.css",
    },
];

export default function LandingPage() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "SoftwareApplication",
                        name: SITE_NAME,
                        applicationCategory: "ProductivityApplication",
                        operatingSystem: "Web browser",
                        description: SITE_DESCRIPTION,
                        url: SITE_URL,
                        image: SITE_IMAGE_URL,
                        logo: `${SITE_URL}/ai-diy.png`,
                        isAccessibleForFree: true,
                        license: "https://opensource.org/license/mit/",
                        sameAs: [
                            "https://github.com/Cubinghackerz/ai.diy",
                            "https://x.com/HeckingHacker",
                        ],
                    }),
                }}
            />
            <MidnightLanding />
        </>
    );
}
