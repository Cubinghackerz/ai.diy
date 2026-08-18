import type { LinksFunction, MetaFunction } from "react-router";
import { SeoGuidePage, type SeoFaq } from "~/components/seo/SeoGuidePage";
import { seoGuideBySlug } from "~/lib/seo-pages";
import { seoGuideMeta } from "~/lib/seo";
import { SITE_URL } from "~/lib/site";

const PAGE = seoGuideBySlug("mcp");
const FAQ: readonly SeoFaq[] = [
    {
        question: "What does MCP enable in ai.diy?",
        answer:
            "MCP lets ai.diy discover and call tools exposed by configured remote MCP servers. That can extend a chat with search, retrieval, or service-specific actions while keeping the tool call visible in the conversation.",
    },
    {
        question: "Does ai.diy support local stdio MCP servers?",
        answer:
            "The shipped product uses remote HTTP or SSE-style MCP connections and rejects stdio MCP. This keeps the browser/server deployment boundary explicit and avoids silently running arbitrary local processes.",
    },
    {
        question: "Are MCP requests automatically trusted?",
        answer:
            "No. Review the server URL, credentials, scopes, and returned data before enabling a remote MCP server. Provider and connector policies still apply, and a hosted ai.diy operator can observe traffic in transit.",
    },
];

export const meta: MetaFunction = () => seoGuideMeta(PAGE, FAQ);
export const links: LinksFunction = () => [{ rel: "canonical", href: `${SITE_URL}${PAGE.path}` }];

export default function McpPage() {
    return (
        <SeoGuidePage
            page={PAGE}
            intro={
                <p>
                    ai.diy is an MCP-capable AI workspace: connect remote Model Context Protocol
                    servers, keep tool activity visible, and use the same BYOK chat interface for
                    research, coding, and connected workflows.
                </p>
            }
            facts={[
                { label: "Connection model", value: "Remote HTTP or SSE-style MCP servers" },
                { label: "Built-in search", value: "DuckDuckGo plus bundled keyless search MCP options" },
                { label: "Boundary", value: "Review URLs, scopes, credentials, and tool output" },
            ]}
            sections={[
                {
                    title: "What MCP changes",
                    body: (
                        <>
                            <p>
                                A normal model can only use the context and functions a client gives
                                it. MCP provides a consistent way for a remote server to describe
                                tools and resources that a client can expose to the model. In ai.diy,
                                those tools appear alongside the built-in search, Python, file, and
                                workspace capabilities.
                            </p>
                            <p>
                                The benefit is composability: a research workflow can combine web
                                search with a configured MCP service without replacing the chat
                                client. The cost is another trust boundary that needs review.
                            </p>
                        </>
                    ),
                },
                {
                    title: "Security and approval considerations",
                    body: (
                        <>
                            <p>
                                Only connect MCP servers you understand and are authorized to use.
                                Check the endpoint, authentication mode, scopes, network exposure,
                                and the data the tool may receive. Do not paste provider credentials
                                into an ordinary tool argument.
                            </p>
                            <p>
                                ai.diy rejects stdio MCP and applies URL safety checks to remote
                                requests. These are guardrails, not a substitute for reviewing the
                                server implementation or operator. Enable only the servers needed for
                                the task and remove stale connections.
                            </p>
                        </>
                    ),
                },
                {
                    title: "Useful MCP workflows",
                    body: (
                        <ul className="list-disc space-y-2 pl-5 marker:text-zinc-600">
                            <li>Pair web search with a connected research or document service.</li>
                            <li>Use a service-specific tool from the same thread as local Python analysis.</li>
                            <li>Keep outputs in the browser-owned chat and Canvas instead of a vendor workspace.</li>
                            <li>Use the built-in keyless search MCP options when you want a low-friction first test.</li>
                        </ul>
                    ),
                },
            ]}
            steps={[
                {
                    title: "Open MCP settings",
                    body: <p>Go to Settings → MCP Beta and add the remote server URL and the minimum configuration it requires.</p>,
                },
                {
                    title: "Connect and inspect tools",
                    body: <p>Enable the server only after checking its name, transport, tool descriptions, and permission boundary.</p>,
                },
                {
                    title: "Use it with a focused prompt",
                    body: <p>Ask for one concrete action, inspect the tool call and result, and disable the server when the workflow is complete.</p>,
                },
            ]}
            faqs={FAQ}
        />
    );
}
