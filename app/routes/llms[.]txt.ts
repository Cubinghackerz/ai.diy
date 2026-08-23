import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { SEO_GUIDES } from "~/lib/seo-pages";
import { SITE_DESCRIPTION, SITE_NAME, SITE_REPOSITORY_URL, SITE_URL } from "~/lib/site";

const HEADERS = {
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    "Content-Type": "text/plain; charset=utf-8",
};

export const headers: HeadersFunction = () => HEADERS;

export function loader(_args: LoaderFunctionArgs) {
    const guides = SEO_GUIDES.map((page) => `- [${page.label}](${SITE_URL}${page.path}): ${page.description}`).join(
        "\n",
    );
    return new Response(
        [
            `# ${SITE_NAME}`,
            "",
            `> ${SITE_DESCRIPTION}`,
            "",
            `${SITE_NAME} is a browser-owned, open-source AI workspace at ${SITE_URL}.`,
            "Chats, knowledge, and API keys stay in the browser. A self-hosted relay talks to 20+ providers.",
            "Users can connect Gmail, GitHub, Notion, Slack, and more through Composio (Settings → Apps).",
            "",
            "## Product",
            `- [Home](${SITE_URL}/): Browser-owned AI workspace`,
            `- [Workspace](${SITE_URL}/workspace): Open the app`,
            `- [GitHub](${SITE_REPOSITORY_URL}): Source code`,
            "",
            "## Guides",
            guides,
            "",
            "## Policy",
            `- [Privacy](${SITE_URL}/privacy)`,
            `- [Terms](${SITE_URL}/terms)`,
            "",
        ].join("\n"),
        { headers: HEADERS },
    );
}
