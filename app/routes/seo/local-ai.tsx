import type { LinksFunction, MetaFunction } from "react-router";
import { SeoGuidePage, type SeoFaq } from "~/components/seo/SeoGuidePage";
import { seoGuideBySlug } from "~/lib/seo-pages";
import { seoGuideMeta } from "~/lib/seo";
import { SITE_URL } from "~/lib/site";

const PAGE = seoGuideBySlug("local-ai");
const FAQ: readonly SeoFaq[] = [
    {
        question: "Can ai.diy use Ollama models?",
        answer:
            "Yes. Ollama is a supported local provider. Connect the Ollama endpoint in Settings, discover the models it exposes, and select the model you want to use in the workspace.",
    },
    {
        question: "Does ai.diy only work with local models?",
        answer:
            "No. Local endpoints and cloud providers can coexist. ai.diy is a BYOK workspace, so you can compare a local Ollama or LM Studio model with an authorized cloud provider without changing applications.",
    },
    {
        question: "What is the main limitation of local AI?",
        answer:
            "Local model quality, speed, context length, and tool support depend on your hardware and the model server. ai.diy does not hide those differences; its role is to provide the workspace and provider switch.",
    },
];

export const meta: MetaFunction = () => seoGuideMeta(PAGE, FAQ);
export const links: LinksFunction = () => [{ rel: "canonical", href: `${SITE_URL}${PAGE.path}` }];

export default function LocalAiPage() {
    return (
        <SeoGuidePage
            page={PAGE}
            intro={
                <p>
                    A local AI workspace should make local models useful, not isolate them in a
                    separate app. ai.diy connects Ollama, LM Studio, and other OpenAI-compatible
                    endpoints to the same chat, Canvas, knowledge, and model-selection workflow.
                </p>
            }
            facts={[
                { label: "Local providers", value: "Ollama, LM Studio, and custom endpoints" },
                { label: "Workspace", value: "One thread can move between configured models" },
                { label: "Privacy", value: "Local inference stays with the endpoint you choose" },
            ]}
            sections={[
                {
                    title: "Ollama and LM Studio are provider choices",
                    body: (
                        <>
                            <p>
                                ai.diy treats a local model server as a provider. In Settings, select
                                Ollama or a custom OpenAI-compatible endpoint, confirm the base URL,
                                discover the models that are available, and choose one in the composer.
                            </p>
                            <p>
                                This keeps local experimentation next to cloud models instead of
                                forcing a separate interface for each backend. Your last model choice
                                is retained per provider, so switching away and back does not have to
                                reset the workflow.
                            </p>
                        </>
                    ),
                },
                {
                    title: "What stays local",
                    body: (
                        <>
                            <p>
                                If the selected provider is a local endpoint, the model request goes
                                to that endpoint. The browser also keeps workspace state, local
                                knowledge, Canvas artifacts, and settings in browser storage.
                            </p>
                            <p>
                                Local models do not automatically make every enabled tool local. Web
                                search, remote MCP, cloud backup, and other connectors can send data
                                to their own services when you enable them. Review the tool boundary
                                before using sensitive material.
                            </p>
                        </>
                    ),
                },
                {
                    title: "Container and network considerations",
                    body: (
                        <>
                            <p>
                                When ai.diy runs in Docker and Ollama runs on the host, the container
                                may need a host gateway such as <code className="rounded bg-white/[0.08] px-1.5 py-0.5 text-zinc-200">host.docker.internal</code>. The exact address depends on your operating system and network layout.
                            </p>
                            <p>
                                Start with a simple text request, then verify vision, tool calling,
                                and context limits for the chosen model. Those capabilities come from
                                the model server and model, not from the label “local”.
                            </p>
                        </>
                    ),
                },
            ]}
            steps={[
                {
                    title: "Run the local model server",
                    body: <p>Install and start Ollama or LM Studio separately, then confirm the endpoint responds on your machine.</p>,
                },
                {
                    title: "Add the provider in ai.diy",
                    body: <p>Open Settings → API Keys, select the local provider, use model discovery, and test the connection.</p>,
                },
                {
                    title: "Choose the model in the workspace",
                    body: <p>Use the provider and model controls in the composer. Keep web tools disabled when the task must remain entirely offline.</p>,
                },
            ]}
            faqs={FAQ}
        />
    );
}
