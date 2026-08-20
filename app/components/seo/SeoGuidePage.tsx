import { ArrowRight, GithubLogo } from "@phosphor-icons/react";
import { Link } from "react-router";
import type { ReactNode } from "react";
import { SITE_REPOSITORY_URL } from "~/lib/site";
import { SEO_GUIDES, type SeoGuide } from "~/lib/seo-pages";

export type SeoFaq = {
    question: string;
    answer: string;
};

export type SeoGuideArtifact = {
    title: string;
    body: ReactNode;
};

type GuideFact = {
    label: string;
    value: string;
};

type GuideStep = {
    title: string;
    body: ReactNode;
    code?: string;
};

export function SeoGuidePage({
    page,
    intro,
    facts,
    sections,
    steps,
    faqs,
}: {
    page: SeoGuide;
    intro: ReactNode;
    facts: readonly GuideFact[];
    sections: readonly SeoGuideArtifact[];
    steps?: readonly GuideStep[];
    faqs: readonly SeoFaq[];
}) {
    const related = SEO_GUIDES.filter((candidate) => candidate.slug !== page.slug).slice(0, 3);

    return (
        <div className="min-h-screen w-full bg-[#050505] text-zinc-100 selection:bg-white selection:text-black">
            <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#050505]/85 backdrop-blur-xl">
                <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
                    <Link
                        to="/"
                        className="font-mono text-sm font-semibold tracking-[-0.02em] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                    >
                        ai.diy
                    </Link>
                    <nav className="flex items-center gap-1.5 text-xs text-zinc-400 sm:gap-3" aria-label="Guide navigation">
                        <Link
                            to="/"
                            className="rounded-full px-3 py-2 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                        >
                            Home
                        </Link>
                        <Link
                            to="/workspace"
                            className="rounded-full border border-white/20 bg-white/[0.08] px-3 py-2 text-white hover:bg-white/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                        >
                            Open workspace
                        </Link>
                    </nav>
                </div>
            </header>

            <main id="main-content">
                <article className="mx-auto max-w-5xl px-5 pb-24 pt-12 sm:px-8 sm:pt-16">
                    <nav className="text-xs text-zinc-500" aria-label="Breadcrumb">
                        <ol className="flex flex-wrap items-center gap-2">
                            <li>
                                <Link
                                    to="/"
                                    className="hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                                >
                                    ai.diy
                                </Link>
                            </li>
                            <li aria-hidden>/</li>
                            <li className="text-zinc-300">{page.label}</li>
                        </ol>
                    </nav>

                    <div className="mt-10 max-w-3xl">
                        <h1 className="text-4xl font-medium leading-[1.05] tracking-[-0.04em] text-white sm:text-6xl">
                            {page.heading}
                        </h1>
                        <div className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400 sm:text-xl">
                            {intro}
                        </div>
                    </div>

                    <dl className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/[0.1] bg-white/[0.1] sm:grid-cols-3">
                        {facts.map((fact) => (
                            <div key={fact.label} className="bg-[#0b0b0d] px-5 py-5">
                                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                                    {fact.label}
                                </dt>
                                <dd className="mt-2 text-sm leading-relaxed text-zinc-200">
                                    {fact.value}
                                </dd>
                            </div>
                        ))}
                    </dl>

                    <div className="mt-16 grid gap-16 lg:grid-cols-[minmax(0,1fr)_17rem]">
                        <div className="min-w-0 space-y-14">
                            {sections.map((section) => (
                                <section key={section.title} aria-labelledby={`${page.slug}-${section.title}`}>
                                    <h2
                                        id={`${page.slug}-${section.title}`}
                                        className="text-2xl font-medium tracking-[-0.03em] text-white sm:text-3xl"
                                    >
                                        {section.title}
                                    </h2>
                                    <div className="mt-5 space-y-4 text-[15px] leading-8 text-zinc-400">
                                        {section.body}
                                    </div>
                                </section>
                            ))}

                            {steps?.length ? (
                                <section aria-labelledby={`${page.slug}-setup`}>
                                    <h2
                                        id={`${page.slug}-setup`}
                                        className="text-2xl font-medium tracking-[-0.03em] text-white sm:text-3xl"
                                    >
                                        A practical setup path
                                    </h2>
                                    <ol className="mt-6 space-y-6">
                                        {steps.map((step, index) => (
                                            <li key={step.title} className="flex gap-4">
                                                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/15 font-mono text-xs text-zinc-300">
                                                    {index + 1}
                                                </span>
                                                <div className="min-w-0">
                                                    <h3 className="text-base font-medium text-white">{step.title}</h3>
                                                    <div className="mt-2 text-[15px] leading-7 text-zinc-400">{step.body}</div>
                                                    {step.code ? (
                                                        <pre className="mt-3 overflow-x-auto rounded-xl border border-white/[0.1] bg-[#0b0b0d] p-4 font-mono text-xs leading-6 text-zinc-300">
                                                            <code>{step.code}</code>
                                                        </pre>
                                                    ) : null}
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                </section>
                            ) : null}

                            <section aria-labelledby={`${page.slug}-faq`}>
                                <h2
                                    id={`${page.slug}-faq`}
                                    className="text-2xl font-medium tracking-[-0.03em] text-white sm:text-3xl"
                                >
                                    Questions people ask
                                </h2>
                                <div className="mt-6 divide-y divide-white/[0.1] border-y border-white/[0.1]">
                                    {faqs.map((faq) => (
                                        <details key={faq.question} className="group py-4">
                                            <summary className="cursor-pointer list-none pr-8 text-base font-medium text-white marker:hidden [&::-webkit-details-marker]:hidden">
                                                {faq.question}
                                            </summary>
                                            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-zinc-400">
                                                {faq.answer}
                                            </p>
                                        </details>
                                    ))}
                                </div>
                            </section>
                        </div>

                        <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Related ai.diy guides">
                            <div className="border-t border-white/[0.1] pt-5">
                                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                                    Continue exploring
                                </p>
                                <ul className="mt-4 space-y-1">
                                    {related.map((relatedPage) => (
                                        <li key={relatedPage.slug}>
                                            <Link
                                                to={relatedPage.path}
                                                className="group flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                                            >
                                                <span>{relatedPage.label}</span>
                                                <ArrowRight className="size-4 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-300" />
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="mt-10 border-t border-white/[0.1] pt-5">
                                <p className="text-sm leading-6 text-zinc-400">
                                    ai.diy is open source. Read the implementation, check the license, or deploy it on infrastructure you control.
                                </p>
                                <a
                                    href={SITE_REPOSITORY_URL}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full border border-white/20 px-4 text-xs font-medium text-white hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                                >
                                    <GithubLogo className="size-4" />
                                    View source on GitHub
                                </a>
                            </div>
                        </aside>
                    </div>

                    <div className="mt-20 flex flex-wrap items-center gap-3 border-t border-white/[0.1] pt-8">
                        <Link
                            to="/workspace"
                            className="inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-medium text-black hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                        >
                            Open the workspace
                        </Link>
                        <Link
                            to="/"
                            className="inline-flex min-h-11 items-center rounded-full border border-white/20 px-5 text-sm text-zinc-300 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                        >
                            Back to product overview
                        </Link>
                    </div>
                </article>
            </main>

            <footer className="border-t border-white/[0.08]">
                <div className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-10 sm:px-8 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                            Explore the product
                        </p>
                        <nav className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-300" aria-label="Product guides">
                            {SEO_GUIDES.map((guide) => (
                                <Link
                                    key={guide.slug}
                                    to={guide.path}
                                    className="underline decoration-white/20 underline-offset-4 transition-colors hover:text-white hover:decoration-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                                >
                                    {guide.label}
                                </Link>
                            ))}
                        </nav>
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-500">
                        <Link to="/" className="hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
                            Home
                        </Link>
                        <Link to="/privacy" className="hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
                            Privacy
                        </Link>
                        <Link to="/terms" className="hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
                            Terms
                        </Link>
                        <a
                            href="mailto:support@tryaidiy.com"
                            className="hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                        >
                            Contact
                        </a>
                        <a
                            href={SITE_REPOSITORY_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                        >
                            GitHub
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
