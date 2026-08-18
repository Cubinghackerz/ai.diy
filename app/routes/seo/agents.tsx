import type { LinksFunction, MetaFunction } from "react-router";
import { SeoGuidePage, type SeoFaq } from "~/components/seo/SeoGuidePage";
import { seoGuideBySlug } from "~/lib/seo-pages";
import { seoGuideMeta } from "~/lib/seo";
import { SITE_URL } from "~/lib/site";

const PAGE = seoGuideBySlug("agents");
const FAQ: readonly SeoFaq[] = [
    {
        question: "What is Agent Mode in ai.diy?",
        answer:
            "Agent Mode lets the selected model plan a task, choose enabled skills and tools, verify work, and synthesize a final response. It is an opt-in workspace mode, not a separate hosted agent service.",
    },
    {
        question: "How do ai.diy subagents work?",
        answer:
            "The main model can request one or more focused subagents. You approve each run, the main chat waits for structured results, and it continues with a synthesis that distinguishes complete, declined, cancelled, and error results.",
    },
    {
        question: "Can the browser Linux environment access the public internet?",
        answer:
            "The in-browser Linux environment is offline by default. Tailscale connectivity is an opt-in bridge, and public internet access additionally depends on an exit node in that network.",
    },
];

export const meta: MetaFunction = () => seoGuideMeta(PAGE, FAQ);
export const links: LinksFunction = () => [{ rel: "canonical", href: `${SITE_URL}${PAGE.path}` }];

export default function AgentsPage() {
    return (
        <SeoGuidePage
            page={PAGE}
            intro={
                <p>
                    ai.diy is an AI agent workspace where planning, tool calls, approvals, and
                    artifacts remain visible. Use Agent Mode for longer tasks, skills for reusable
                    operating instructions, and approved subagents for focused parallel work.
                </p>
            }
            facts={[
                { label: "Orchestration", value: "Agent Mode plus approved subagents" },
                { label: "Tools", value: "Web, Python, files, MCP, memory, and knowledge" },
                { label: "Safety", value: "Visible tool calls, approval gates, and stop controls" },
            ]}
            sections={[
                {
                    title: "A visible agent loop",
                    body: (
                        <>
                            <p>
                                Agent Mode is designed for tasks that need more than one response:
                                understand the goal, select an installed skill or tool, execute the
                                work, verify the result, and synthesize. The thread shows the work
                                summary and tool calls instead of hiding every step behind a status
                                spinner.
                            </p>
                            <p>
                                This is useful for research, code review, document analysis, and
                                implementation tasks where the final answer should explain what was
                                actually checked.
                            </p>
                        </>
                    ),
                },
                {
                    title: "Subagents are delegated, not detached",
                    body: (
                        <>
                            <p>
                                A subagent receives a focused, self-contained task. The user approves
                                the run, watches its status, and can stop it. When it finishes, the
                                parent model receives a structured result and continues the original
                                conversation rather than leaving a second answer stranded in a popup.
                            </p>
                            <p>
                                Keep subtasks narrow. A good delegation asks for one research pass,
                                one comparison, or one verification step. The parent remains
                                responsible for resolving conflicts and handling incomplete results.
                            </p>
                        </>
                    ),
                },
                {
                    title: "Browser tools and boundaries",
                    body: (
                        <ul className="list-disc space-y-2 pl-5 marker:text-zinc-600">
                            <li>Browser Python runs in Pyodide and can place generated files in Canvas.</li>
                            <li>The Linux VM runs in the tab and is offline by default.</li>
                            <li>Remote MCP tools and web services have their own data and trust boundaries.</li>
                            <li>Provider keys remain browser-owned and model usage remains your responsibility.</li>
                        </ul>
                    ),
                },
            ]}
            steps={[
                {
                    title: "Enable the mode you need",
                    body: <p>Open Settings → Experimental and enable Agent Mode or Subagents. Keep other tools disabled when they are not needed.</p>,
                },
                {
                    title: "Give the model a verifiable goal",
                    body: <p>Include the expected output, source or file boundaries, and what counts as verification.</p>,
                },
                {
                    title: "Review and synthesize",
                    body: <p>Approve focused work, inspect artifacts and sources, then check that the final response distinguishes evidence from assumptions.</p>,
                },
            ]}
            faqs={FAQ}
        />
    );
}
