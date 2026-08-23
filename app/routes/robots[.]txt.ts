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
            "User-agent: GPTBot",
            "Allow: /",
            "Disallow: /workspace",
            "Disallow: /api/",
            "",
            "User-agent: ChatGPT-User",
            "Allow: /",
            "Disallow: /workspace",
            "Disallow: /api/",
            "",
            "User-agent: ClaudeBot",
            "Allow: /",
            "Disallow: /workspace",
            "Disallow: /api/",
            "",
            "User-agent: PerplexityBot",
            "Allow: /",
            "Disallow: /workspace",
            "Disallow: /api/",
            "",
            "User-agent: Google-Extended",
            "Allow: /",
            "Disallow: /workspace",
            "Disallow: /api/",
            "",
            `Sitemap: ${SITE_URL}/sitemap.xml`,
            `LLMs: ${SITE_URL}/llms.txt`,
            "",
        ].join("\n"),
        { headers: ROBOTS_HEADERS },
    );
}
