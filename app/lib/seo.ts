import type { MetaDescriptor } from "react-router";
import {
    PUBLIC_ROBOTS_DIRECTIVE,
    SITE_DESCRIPTION,
    SITE_IMAGE_ALT,
    SITE_IMAGE_URL,
    SITE_KEYWORDS,
    SITE_NAME,
    SITE_REPOSITORY_URL,
    SITE_TWITTER_HANDLE,
    SITE_URL,
} from "./site";

type PageMetaOptions = {
    title: string;
    description?: string;
    url: string;
    noindex?: boolean;
    structuredData?: Record<string, unknown> | Record<string, unknown>[];
};

export type SeoGuideMetaPage = {
    title: string;
    description: string;
    path: string;
};

export type SeoGuideFaq = {
    question: string;
    answer: string;
};

export function pageMeta({
    title,
    description = SITE_DESCRIPTION,
    url,
    noindex = false,
    structuredData,
}: PageMetaOptions): MetaDescriptor[] {
    const robots = noindex ? "noindex, nofollow" : PUBLIC_ROBOTS_DIRECTIVE;

    return [
        { title },
        { name: "description", content: description },
        { name: "author", content: SITE_NAME },
        { name: "application-name", content: SITE_NAME },
        { name: "keywords", content: SITE_KEYWORDS },
        { name: "color-scheme", content: "dark light" },
        { name: "robots", content: robots },
        { name: "googlebot", content: robots },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: SITE_NAME },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:image", content: SITE_IMAGE_URL },
        { property: "og:image:type", content: "image/png" },
        { property: "og:image:secure_url", content: SITE_IMAGE_URL },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:alt", content: SITE_IMAGE_ALT },
        { property: "og:locale", content: "en_US" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:site", content: SITE_TWITTER_HANDLE },
        { name: "twitter:creator", content: SITE_TWITTER_HANDLE },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: SITE_IMAGE_URL },
        { name: "twitter:image:alt", content: SITE_IMAGE_ALT },
        ...(structuredData ? [{ "script:ld+json": structuredData }] : []),
    ];
}

export function seoGuideStructuredData({
    title,
    description,
    url,
    section,
    faqs,
}: {
    title: string;
    description: string;
    url: string;
    section: string;
    faqs: readonly SeoGuideFaq[];
}): Record<string, unknown> {
    return {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebPage",
                "@id": `${url}#webpage`,
                url,
                name: title,
                description,
                isPartOf: { "@id": `${SITE_URL}/#website` },
                about: { "@id": `${SITE_URL}/#software` },
                inLanguage: "en-US",
                mainEntity: { "@id": `${url}#faq` },
            },
            {
                "@type": "BreadcrumbList",
                "@id": `${url}#breadcrumb`,
                itemListElement: [
                    {
                        "@type": "ListItem",
                        position: 1,
                        name: SITE_NAME,
                        item: SITE_URL,
                    },
                    {
                        "@type": "ListItem",
                        position: 2,
                        name: section,
                        item: url,
                    },
                ],
            },
            {
                "@type": "FAQPage",
                "@id": `${url}#faq`,
                url: `${url}#faq`,
                mainEntity: faqs.map((faq) => ({
                    "@type": "Question",
                    name: faq.question,
                    acceptedAnswer: {
                        "@type": "Answer",
                        text: faq.answer,
                    },
                })),
            },
            {
                "@type": "SoftwareApplication",
                "@id": `${SITE_URL}/#software`,
                name: SITE_NAME,
                url: SITE_URL,
                codeRepository: SITE_REPOSITORY_URL,
                applicationCategory: "ProductivityApplication",
            },
        ],
    };
}

export function seoGuideMeta(
    page: SeoGuideMetaPage,
    faqs: readonly SeoGuideFaq[],
): MetaDescriptor[] {
    const url = `${SITE_URL}${page.path}`;
    return pageMeta({
        title: page.title,
        description: page.description,
        url,
        structuredData: seoGuideStructuredData({
            title: page.title,
            description: page.description,
            url,
            section: page.title.split("|")[0]?.trim() || page.title,
            faqs,
        }),
    });
}
