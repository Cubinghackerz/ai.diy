import { MaskedHeading } from "./MaskedHeading";
import { Reveal } from "./DoubleBezel";

const APPS: Array<{ slug: string; label: string }> = [
    { slug: "gmail", label: "Gmail" },
    { slug: "github", label: "GitHub" },
    { slug: "slack", label: "Slack" },
    { slug: "notion", label: "Notion" },
    { slug: "linear", label: "Linear" },
    { slug: "jira", label: "Jira" },
    { slug: "googlecalendar", label: "Calendar" },
    { slug: "googledrive", label: "Drive" },
    { slug: "googlesheets", label: "Sheets" },
    { slug: "googledocs", label: "Docs" },
    { slug: "discord", label: "Discord" },
    { slug: "trello", label: "Trello" },
    { slug: "airtable", label: "Airtable" },
    { slug: "youtube", label: "YouTube" },
    { slug: "todoist", label: "Todoist" },
    { slug: "twitter", label: "X" },
    { slug: "hackernews", label: "Hacker News" },
    { slug: "outlook", label: "Outlook" },
    { slug: "asana", label: "Asana" },
    { slug: "clickup", label: "ClickUp" },
    { slug: "figma", label: "Figma" },
    { slug: "hubspot", label: "HubSpot" },
    { slug: "salesforce", label: "Salesforce" },
    { slug: "stripe", label: "Stripe" },
    { slug: "shopify", label: "Shopify" },
    { slug: "zendesk", label: "Zendesk" },
    { slug: "intercom", label: "Intercom" },
    { slug: "zoom", label: "Zoom" },
    { slug: "linkedin", label: "LinkedIn" },
    { slug: "gitlab", label: "GitLab" },
    { slug: "bitbucket", label: "Bitbucket" },
    { slug: "confluence", label: "Confluence" },
    { slug: "dropbox", label: "Dropbox" },
    { slug: "box", label: "Box" },
    { slug: "sentry", label: "Sentry" },
    { slug: "vercel", label: "Vercel" },
    { slug: "supabase", label: "Supabase" },
    { slug: "reddit", label: "Reddit" },
    { slug: "spotify", label: "Spotify" },
    { slug: "telegram", label: "Telegram" },
    { slug: "calendly", label: "Calendly" },
    { slug: "pagerduty", label: "PagerDuty" },
    { slug: "twilio", label: "Twilio" },
    { slug: "mailchimp", label: "Mailchimp" },
    { slug: "typeform", label: "Typeform" },
];

const SEARCH_PARTNERS = [
    {
        id: "duckduckgo",
        label: "DuckDuckGo",
        href: "https://duckduckgo.com",
        src: "/landing-logos/duckduckgo.svg",
    },
    {
        id: "parallel",
        label: "Parallel.ai",
        href: "https://parallel.ai",
        src: "/landing-logos/parallel.png",
    },
    {
        id: "firecrawl",
        label: "Firecrawl",
        href: "https://www.firecrawl.dev",
        src: "/landing-logos/firecrawl.png",
    },
] as const;

function AppLogo({ slug }: { slug: string }) {
    return (
        <img
            src={`https://logos.composio.dev/api/${slug}`}
            alt=""
            width={20}
            height={20}
            loading="lazy"
            decoding="async"
            className="size-5 shrink-0 object-contain opacity-70 transition-[opacity,filter] duration-200 group-hover:opacity-100"
            onError={(event) => {
                const img = event.currentTarget;
                img.style.display = "none";
                const fallback = img.nextElementSibling;
                if (fallback instanceof HTMLElement) fallback.hidden = false;
            }}
        />
    );
}

export function ComposioApps() {
    return (
        <section
            id="apps"
            className="relative overflow-hidden border-y border-white/[0.08] py-20 sm:py-24"
            aria-label="Connect apps with Composio"
        >
            <div className="mx-auto max-w-6xl px-5 sm:px-8">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    Connect
                </p>
                <MaskedHeading className="mt-3 max-w-[18ch] text-3xl font-medium tracking-[-0.035em] text-white sm:text-4xl">
                    Connect the apps you already use.
                </MaskedHeading>
                <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
                    Paste a free Composio key in Settings → Apps. Authorize Gmail,
                    GitHub, Notion, Slack, and a thousand more — the assistant acts
                    only in the tools you connect.
                </p>
            </div>

            <Reveal delayMs={40} className="mt-12">
                <ul className="mx-auto grid max-w-6xl grid-cols-2 border-y border-white/[0.08] px-5 sm:grid-cols-3 sm:px-8 md:grid-cols-4 lg:grid-cols-6">
                    {APPS.map((app) => (
                        <li
                            key={app.slug}
                            className="group flex min-h-14 items-center gap-2.5 border-b border-white/[0.08] px-2 py-3 transition-colors duration-200 hover:bg-white/[0.03] sm:px-2.5"
                        >
                            <AppLogo slug={app.slug} />
                            <span
                                hidden
                                className="flex size-5 shrink-0 items-center justify-center rounded bg-white/10 font-mono text-[9px] text-zinc-400"
                            >
                                {app.label.slice(0, 1)}
                            </span>
                            <span className="truncate text-[13px] text-zinc-300 transition-colors duration-200 group-hover:text-white">
                                {app.label}
                            </span>
                        </li>
                    ))}
                </ul>
            </Reveal>

            <div className="mx-auto mt-10 flex max-w-6xl flex-col gap-8 px-5 sm:px-8">
                <a
                    href="https://composio.dev"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-fit items-center gap-2.5 text-[13px] text-zinc-400 transition-colors hover:text-white"
                >
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                        Powered by
                    </span>
                    <img
                        src="/landing-logos/composio-white.svg"
                        alt="Composio"
                        height={16}
                        className="h-4 w-auto opacity-80"
                    />
                </a>

                <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                        Free web search powered by
                    </p>
                    <ul className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
                        {SEARCH_PARTNERS.map((partner) => (
                            <li key={partner.id}>
                                <a
                                    href={partner.href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="group inline-flex items-center gap-2 text-[13px] text-zinc-400 transition-colors hover:text-white"
                                >
                                    <img
                                        src={partner.src}
                                        alt=""
                                        width={18}
                                        height={18}
                                        className="size-[18px] object-contain opacity-70 grayscale transition-[filter,opacity] duration-200 group-hover:opacity-100 group-hover:grayscale-0"
                                    />
                                    {partner.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </section>
    );
}
