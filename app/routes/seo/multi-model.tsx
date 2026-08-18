import type { LinksFunction, MetaFunction } from "react-router";
import { SeoGuidePage, type SeoFaq } from "~/components/seo/SeoGuidePage";
import { seoGuideBySlug } from "~/lib/seo-pages";
import { seoGuideMeta } from "~/lib/seo";
import { SITE_URL } from "~/lib/site";

const PAGE = seoGuideBySlug("multi-model");
const FAQ: readonly SeoFaq[] = [
    {
        question: "How many models can ai.diy Preview compare?",
        answer:
            "Preview can run up to three primary models in parallel and can optionally run a fourth fusion model after the primary responses finish.",
    },
    {
        question: "Is multi-model Preview a benchmark?",
        answer:
            "No. It is a workspace comparison tool, not a controlled benchmark. Provider latency, model settings, prompt formatting, context limits, and usage costs can differ between runs.",
    },
    {
        question: "Do the compared models share the same conversation?",
        answer:
            "They receive the same comparison prompt and selected attachments for the run, but each primary model has its own response stream. The optional fusion model receives the completed primary outputs to produce one synthesis.",
    },
];

export const meta: MetaFunction = () => seoGuideMeta(PAGE, FAQ);
export const links: LinksFunction = () => [{ rel: "canonical", href: `${SITE_URL}${PAGE.path}` }];

export default function MultiModelPage() {
    return (
        <SeoGuidePage
            page={PAGE}
            intro={
                <p>
                    Multi-model Preview gives one prompt a few independent perspectives without
                    making you copy context between apps. Choose primary models from your connected
                    providers, compare their answers side by side, and optionally ask a fusion model
                    to synthesize the completed results.
                </p>
            }
            facts={[
                { label: "Primary runs", value: "One to three models in parallel" },
                { label: "Synthesis", value: "Optional fusion model after primary completion" },
                { label: "Cost", value: "Each connected provider may bill its own request" },
            ]}
            sections={[
                {
                    title: "Compare answers in one workspace",
                    body: (
                        <>
                            <p>
                                Preview is useful when the decision matters more than a single model
                                preference: compare research plans, ask several models to critique a
                                draft, or see how local and cloud models handle the same prompt. Each
                                primary column streams independently and exposes its own model status,
                                duration, output, and retry control.
                            </p>
                            <p>
                                 The comparison lives in the same ai.diy workspace as normal chat, so
                                 you can use connected providers, attachments, Python analysis, and
                                 per-run artifact popups without opening a second product or the
                                 normal Canvas panel.
                            </p>
                        </>
                    ),
                },
                {
                    title: "Fusion is a synthesis step, not a vote",
                    body: (
                        <>
                            <p>
                                When every primary run has finished, the optional fusion model receives
                                the original prompt and the candidate outputs. It is asked to resolve
                                conflicts, retain useful specifics, and produce one direct answer.
                            </p>
                            <p>
                                Inspect the primary outputs before trusting the synthesis. A fusion
                                model can make a confident mistake if every candidate is wrong or if
                                the prompt does not provide enough evidence. For factual research,
                                require source links and verify important claims.
                            </p>
                        </>
                    ),
                },
                {
                    title: "A fair comparison needs a clear prompt",
                    body: (
                        <ul className="list-disc space-y-2 pl-5 marker:text-zinc-600">
                            <li>Keep the task and requested output format identical for each primary run.</li>
                            <li>Record which model, provider, reasoning effort, and files were used.</li>
                            <li>Compare usefulness, evidence, latency, and cost for your actual workflow.</li>
                            <li>Do not treat one run as a general model ranking or performance claim.</li>
                        </ul>
                    ),
                },
            ]}
            steps={[
                {
                    title: "Open Preview",
                    body: <p>Enable the multi-model Preview workspace under the experimental settings, then add the models you want to compare.</p>,
                },
                {
                    title: "Send one focused prompt",
                    body: <p>Add only the files each selected model supports. Preview skips unsupported modalities and tells you when it does.</p>,
                },
                {
                    title: "Review before fusion",
                    body: <p>Read the independent outputs, retry an outlier if needed, and then use fusion when a single synthesis is more useful than separate answers.</p>,
                },
            ]}
            faqs={FAQ}
        />
    );
}
