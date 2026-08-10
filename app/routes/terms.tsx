import type { LinksFunction, MetaFunction } from "react-router";
import { LegalPage, LegalSection, LegalList } from "~/components/launch/LegalPage";
import { SITE_URL } from "~/lib/site";

export const meta: MetaFunction = () => [
    { title: "Terms - ai.diy" },
    {
        name: "description",
        content: "Terms for using the open-source ai.diy workspace and hosted demo.",
    },
    { name: "robots", content: "index, follow" },
];

export const links: LinksFunction = () => [
    { rel: "canonical", href: `${SITE_URL}/terms` },
];

export default function TermsPage() {
    return (
        <LegalPage
            title="Terms"
            intro="These terms keep the boundaries clear for the open-source ai.diy project and any hosted instance you choose to run."
            updated="Last updated: August 10, 2026"
        >
            <LegalSection title="Beta software">
                <p>
                    ai.diy is beta software provided for evaluation and development. Features can change, stop working, or be removed. Keep exports or backups of anything important and do not rely on the hosted demo as your only copy of data.
                </p>
            </LegalSection>

            <LegalSection title="Your keys and provider costs">
                <p>
                    You are responsible for the provider credentials you enter, the requests you make, and any usage charges created by those requests. Only use keys and endpoints you are authorized to use. Review provider settings and usage caps before public or shared deployments.
                </p>
                <p>
                    ai.diy does not provide LLM access, provider credits, or a guarantee that a provider will accept a request. Provider availability, pricing, safety rules, and data handling are controlled by each provider.
                </p>
            </LegalSection>

            <LegalSection title="Acceptable use">
                <p>You agree not to use ai.diy to:</p>
                <LegalList>
                    <li>Break the law, violate another person's rights, or access systems without permission.</li>
                    <li>Abuse provider APIs, bypass usage limits, distribute malware, or attempt to compromise a deployment.</li>
                    <li>Submit sensitive information to a hosted instance or third-party service without understanding its data handling.</li>
                </LegalList>
            </LegalSection>

            <LegalSection title="Open-source license">
                <p>
                    The ai.diy source code is released under the MIT License. The license grants the permissions and limitations stated in the repository's LICENSE file. A hosted deployment may include its own infrastructure, configuration, and third-party service terms.
                </p>
            </LegalSection>

            <LegalSection title="No warranty">
                <p>
                    To the maximum extent permitted by law, ai.diy is provided "as is" and without warranties of any kind. The maintainers are not responsible for provider charges, lost browser data, interruptions, model output, or actions taken based on model output. You are responsible for verifying generated content and securing your browser profile and deployment.
                </p>
            </LegalSection>

            <LegalSection title="Changes and contact">
                <p>
                    These terms may be updated as the beta evolves. Material changes will be reflected in this page. Questions can be raised through the GitHub repository or the official X account linked in the footer.
                </p>
            </LegalSection>
        </LegalPage>
    );
}
