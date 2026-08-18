import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { INDEXABLE_PUBLIC_PAGES } from "~/lib/seo-pages";
import { SITE_URL } from "~/lib/site";

function escapeXml(value: string): string {
    return value.replace(/[<>&'\"]/g, (character) => {
        switch (character) {
            case "<":
                return "&lt;";
            case ">":
                return "&gt;";
            case "&":
                return "&amp;";
            case "'":
                return "&apos;";
            default:
                return "&quot;";
        }
    });
}

const SITEMAP_HEADERS = {
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    "Content-Type": "application/xml; charset=utf-8",
};

export const headers: HeadersFunction = () => SITEMAP_HEADERS;

export function loader(_args: LoaderFunctionArgs) {
    const urls = INDEXABLE_PUBLIC_PAGES.map((page) => {
        const loc = `${SITE_URL}${page.path}`;
        const image = "image" in page && page.image ? page.image : null;
        return [
            "  <url>",
            `    <loc>${escapeXml(loc)}</loc>`,
            `    <lastmod>${page.lastModified}</lastmod>`,
            `    <changefreq>${page.changeFrequency}</changefreq>`,
            `    <priority>${page.priority}</priority>`,
            ...(image
                ? [
                      "    <image:image>",
                      `      <image:loc>${escapeXml(`${SITE_URL}${image}`)}</image:loc>`,
                      "      <image:title>ai.diy open-source self-hosted AI workspace</image:title>",
                      "      <image:caption>Local-first BYOK AI chat workspace with model switching and tools</image:caption>",
                      "    </image:image>",
                  ]
                : []),
            "  </url>",
        ].join("\n");
    }).join("\n");

    return new Response(
        [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
            '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
            urls,
            "</urlset>",
            "",
        ].join("\n"),
        { headers: SITEMAP_HEADERS },
    );
}
