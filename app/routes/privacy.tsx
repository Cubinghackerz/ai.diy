import type { HeadersFunction, LinksFunction, MetaFunction } from "react-router";
import { LegalPage, LegalSection, LegalList } from "~/components/launch/LegalPage";
import { PUBLIC_DOCUMENT_HEADERS } from "~/lib/http-headers";
import { pageMeta } from "~/lib/seo";
import { SITE_URL } from "~/lib/site";

const PAGE_TITLE = "Privacy - ai.diy";
const PAGE_DESCRIPTION =
    "How ai.diy handles browser data, provider keys, and hosted requests.";

export const headers: HeadersFunction = () => PUBLIC_DOCUMENT_HEADERS;

export const meta: MetaFunction = () =>
    pageMeta({ title: PAGE_TITLE, description: PAGE_DESCRIPTION, url: `${SITE_URL}/privacy` });

export const links: LinksFunction = () => [
    { rel: "canonical", href: `${SITE_URL}/privacy` },
];

export default function PrivacyPage() {
    return (
        <LegalPage
            title="Privacy"
            intro="ai.diy is designed to keep your workspace close to you. This page describes the default data flow in the open-source application and the hosted demo."
            updated="Last updated: August 10, 2026"
        >
            <LegalSection title="The short version">
                <p>
                    The default app has no user account, marketing list, or product analytics service. Chats, settings, provider keys, files, Canvas artifacts, memory, knowledge-base chunks, and usage events are stored in your browser.
                </p>
                <p>
                    When you send a message, the selected provider key and request pass through the ai.diy server route to the provider you chose. A hosted instance operator can observe traffic in transit. The app does not require server-side LLM credentials and is not designed to persist provider keys.
                </p>
            </LegalSection>

            <LegalSection title="Data stored in your browser">
                <p>Depending on the features you use, ai.diy stores the following locally:</p>
                <LegalList>
                    <li>
                        Provider settings and API keys in browser storage. When Web Crypto and
                        IndexedDB are available, the settings payload is encrypted at rest with
                        AES-GCM; the envelope key is stored separately in IndexedDB. Fallback
                        environments may use plaintext storage.
                    </li>
                    <li>Chats, attachments, threads, Canvas artifacts, memory, knowledge-base indexes, usage events, and preview sessions in browser storage.</li>
                    <li>Optional cloud-backup credentials in the browser so the client can talk to your chosen storage endpoint.</li>
                </LegalList>
                <p>
                    You can delete local data through the browser or the relevant workspace settings. Export and backup tools are client-side features; review the destination before sending anything there.
                </p>
            </LegalSection>

            <LegalSection title="Provider and tool requests">
                <p>
                    Your selected LLM provider receives the prompts, files, and tool context needed for the request. Web search, URL fetch, remote MCP, cloud backup, and other connectors may send data to the service you enable. Those services have their own privacy policies and retention rules.
                </p>
                <p>
                    Do not use a shared deployment for secrets or regulated data unless you have reviewed and trust its operator. For maximum control, self-host ai.diy and configure production logging, rate limits, and access controls yourself.
                </p>
            </LegalSection>

            <LegalSection title="Optional integrations">
                <LegalList>
                    <li>The landing page reads public GitHub profile and repository statistics from the GitHub API. It does not request a GitHub token.</li>
                    <li>Login with ChatGPT is an experimental beta integration. It uses a session cookie and third-party community SDK; enable it only after reviewing its consent flow.</li>
                    <li>Hosting providers may process normal operational data such as IP addresses, request timing, and server logs according to their policies.</li>
                </LegalList>
            </LegalSection>

            <LegalSection title="Contact">
                <p>
                    Questions or corrections can be sent to{" "}
                    <a href="mailto:support@tryaidiy.com" className="text-zinc-200 underline decoration-white/20 underline-offset-4 hover:decoration-white/60">
                        support@tryaidiy.com
                    </a>
                    , or raised through the project repository or the official X account linked in the footer. ai.diy is open source, so you can also inspect the implementation and deploy it on infrastructure you control.
                </p>
            </LegalSection>
        </LegalPage>
    );
}
