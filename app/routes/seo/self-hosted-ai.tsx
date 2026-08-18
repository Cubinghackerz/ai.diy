import type { LinksFunction, MetaFunction } from "react-router";
import { SeoGuidePage, type SeoFaq } from "~/components/seo/SeoGuidePage";
import { seoGuideBySlug } from "~/lib/seo-pages";
import { seoGuideMeta } from "~/lib/seo";
import { SITE_URL } from "~/lib/site";

const PAGE = seoGuideBySlug("self-hosted-ai");
const FAQ: readonly SeoFaq[] = [
    {
        question: "What does self-hosting ai.diy control?",
        answer:
            "You control the Node.js or Docker deployment, its logs, network boundary, access controls, and hosting provider. The selected model provider still receives prompts and files when you use a cloud endpoint.",
    },
    {
        question: "Does self-hosting make cloud model requests private?",
        answer:
            "No. Self-hosting controls the ai.diy relay and infrastructure, but a cloud provider still processes the request. Use an authorized local endpoint such as Ollama or LM Studio when the model must stay on your network.",
    },
    {
        question: "Can I run ai.diy without putting LLM keys in server environment variables?",
        answer:
            "Yes. ai.diy is designed for bring-your-own-key use. Provider keys are entered in the browser and relayed per request; configure rate limits and access controls before exposing a deployment publicly.",
    },
];

export const meta: MetaFunction = () => seoGuideMeta(PAGE, FAQ);
export const links: LinksFunction = () => [{ rel: "canonical", href: `${SITE_URL}${PAGE.path}` }];

export default function SelfHostedAiPage() {
    return (
        <SeoGuidePage
            page={PAGE}
            intro={
                <p>
                    ai.diy is a self-hosted AI chat workspace for people who want to choose their
                    infrastructure as well as their model provider. Run the production build on a
                    Node.js server or Docker Compose, then keep your workspace data in the browser.
                </p>
            }
            facts={[
                { label: "Deploy", value: "Node.js, Docker Compose, or a Vercel preview" },
                { label: "Data model", value: "Browser-local settings, chats, Canvas, and knowledge" },
                { label: "Provider access", value: "BYOK cloud providers or local endpoints" },
            ]}
            sections={[
                {
                    title: "What self-hosting means in ai.diy",
                    body: (
                        <>
                            <p>
                                A self-hosted ai.diy instance is the workspace server you run and
                                maintain. It serves the app and relays provider requests, but it is
                                not a hosted model company and does not supply model credits.
                            </p>
                            <p>
                                The browser remains an important part of the architecture: chats,
                                settings, provider keys, Canvas artifacts, memory, knowledge-base
                                indexes, and usage events are stored locally by the client. That is
                                useful for a personal workstation, a private team deployment, or a
                                developer evaluating multiple providers without moving between apps.
                            </p>
                        </>
                    ),
                },
                {
                    title: "Know the trust boundary",
                    body: (
                        <div className="overflow-x-auto rounded-xl border border-white/[0.1] bg-[#0b0b0d]">
                            <table className="min-w-full text-left text-sm">
                                <thead className="border-b border-white/[0.1] text-xs text-zinc-300">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Layer</th>
                                        <th className="px-4 py-3 font-medium">What it handles</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.08] text-zinc-400">
                                    <tr>
                                        <td className="px-4 py-3 text-zinc-200">Browser</td>
                                        <td className="px-4 py-3">Workspace state, keys, local knowledge, and Canvas artifacts</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3 text-zinc-200">Your relay</td>
                                        <td className="px-4 py-3">App delivery, model discovery, request forwarding, and optional rate limits</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3 text-zinc-200">Chosen provider</td>
                                        <td className="px-4 py-3">The prompts, files, and tool context needed to produce the model response</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    ),
                },
                {
                    title: "Who should self-host it?",
                    body: (
                        <>
                            <p>
                                Self-hosting is a good fit when you want an auditable deployment,
                                browser-local persistence, control over operational logs, or a single
                                interface for cloud and local models. It is also useful when a hosted
                                demo is not the right place for work data.
                            </p>
                            <p>
                                It is not a substitute for provider security review. A public
                                deployment needs authentication or network controls, HTTPS, sensible
                                logging, and server rate limits. Read the project deployment notes
                                before exposing it beyond a trusted network.
                            </p>
                        </>
                    ),
                },
            ]}
            steps={[
                {
                    title: "Clone and install",
                    body: <p>Use the repository and lockfile so the production build uses the tested dependency graph.</p>,
                    code: "git clone https://github.com/Cubinghackerz/ai.diy.git\ncd ai.diy\nnpm install",
                },
                {
                    title: "Build and serve",
                    body: <p>Run the production server on the port and host boundary you control.</p>,
                    code: "npm run build && npm start",
                },
                {
                    title: "Connect a provider",
                    body: <p>Open Settings, choose a cloud or local provider, test the connection, and keep the model selection that fits the task.</p>,
                },
            ]}
            faqs={FAQ}
        />
    );
}
