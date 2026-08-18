import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { SITE_URL } from "~/lib/site";

const ROBOTS_HEADERS = {
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    "Content-Type": "text/plain; charset=utf-8",
};

export const headers: HeadersFunction = () => ROBOTS_HEADERS;

export function loader(_args: LoaderFunctionArgs) {
    return new Response(
        [
            "User-agent: *",
            "Allow: /",
            "Disallow: /workspace",
            "Disallow: /api/",
            "Disallow: /*?*",
            "",
            `Sitemap: ${SITE_URL}/sitemap.xml`,
            "",
        ].join("\n"),
        { headers: ROBOTS_HEADERS },
    );
}
