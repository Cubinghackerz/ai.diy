import type { LinksFunction, MetaFunction } from "react-router";
import { SeoGuidePage, type SeoFaq } from "~/components/seo/SeoGuidePage";
import { seoGuideBySlug } from "~/lib/seo-pages";
import { seoGuideMeta } from "~/lib/seo";
import { SITE_URL } from "~/lib/site";

const PAGE = seoGuideBySlug("apps");
const FAQ: readonly SeoFaq[] = [
    {
        question: "How do I connect Gmail or GitHub to ai.diy?",
        answer:
            "Open the workspace, go to Settings → Apps, paste a Composio API key with sessions write access, then connect the app. The key stays in your browser except for per-request relay.",
    },
    {
        question: "Is Composio free to use with ai.diy?",
        answer:
            "Composio’s free plan includes sessions, managed OAuth, and a monthly tool-call allowance. You still need a valid API key from dashboard.composio.dev.",
    },
    {
        question: "Can the assistant send email or change data without asking?",
        answer:
            "No. Read actions can run immediately. Writes, sends, and other data-changing actions ask you Yes, No, or Yes don’t ask again before they execute.",
    },
];

export const meta: MetaFunction = () => seoGuideMeta(PAGE, FAQ);
export const links: LinksFunction = () => [{ rel: "canonical", href: `${SITE_URL}${PAGE.path}` }];

export default function AppsPage() {
    return (
        <SeoGuidePage
            page={PAGE}
            intro={
                <p>
                    ai.diy can act in Gmail, GitHub, Notion, Slack, Linear, and other
                    SaaS apps through Composio. Connect once in Settings → Apps, then
                    ask the assistant to read or update the tools you authorized.
                </p>
            }
            facts={[
                { label: "Auth model", value: "BYOK Composio key, browser-held" },
                { label: "Apps", value: "Gmail, GitHub, Notion, Slack, Linear, Jira, and more" },
                { label: "Writes", value: "Yes / No / don’t-ask-again confirmation" },
            ]}
            sections={[
                {
                    title: "Connect apps without moving your workspace",
                    body: (
                        <>
                            <p>
                                Most AI chat apps stop at the model. ai.diy can also use
                                the SaaS tools you already live in. A Composio session
                                exposes those apps as MCP tools in the same thread as
                                search, Python, and files.
                            </p>
                            <p>
                                The API key never becomes a server secret. It is stored
                                in this browser and relayed only for the request that
                                needs it.
                            </p>
                        </>
                    ),
                },
                {
                    title: "What you need",
                    body: (
                        <>
                            <p>
                                Create a key at dashboard.composio.dev. Grant it
                                sessions write access — a read-only key can list apps
                                but cannot start a chat session.
                            </p>
                            <p>
                                Then open Settings → Apps, paste or drop the key, and
                                connect Gmail, GitHub, Notion, or Slack. In chat, those
                                tools appear as <code>mcp_composio_…</code>.
                            </p>
                        </>
                    ),
                },
            ]}
            faqs={FAQ}
        />
    );
}
