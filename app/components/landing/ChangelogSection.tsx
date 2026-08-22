import { ArrowUpRight, GitCommit } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { CHANGELOG_URL, GITHUB_URL } from "./constants";
import { Reveal } from "./DoubleBezel";
import { useGithubCommits, type GithubCommit } from "./hooks";
import { MaskedHeading } from "./MaskedHeading";
import { cn } from "~/lib/utils";

function commitTitle(commit: GithubCommit) {
    return commit.commit.message.split("\n", 1)[0] || "Untitled change";
}

function commitDate(commit: GithubCommit) {
    const date = commit.commit.author?.date;
    if (!date) return "Recent";
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "Recent";
    return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(parsed);
}

function CommitSkeleton() {
    return (
        <ul aria-label="Loading recent changes" aria-busy="true">
            {Array.from({ length: 4 }, (_, index) => (
                <li
                    key={index}
                    className="flex min-h-[5.5rem] flex-col justify-center gap-2 border-b border-white/[0.08] last:border-b-0"
                >
                    <span className="h-4 w-3/4 animate-pulse rounded bg-white/[0.07] motion-reduce:animate-none" />
                    <span className="h-3 w-1/3 animate-pulse rounded bg-white/[0.05] motion-reduce:animate-none" />
                </li>
            ))}
        </ul>
    );
}

export function ChangelogSection() {
    const { commits, status } = useGithubCommits();
    const [skeletonGone, setSkeletonGone] = useState(false);

    useEffect(() => {
        if (!commits) return;
        const timeout = window.setTimeout(() => setSkeletonGone(true), 450);
        return () => window.clearTimeout(timeout);
    }, [commits]);

    return (
        <section
            id="changelog"
            className="mx-auto max-w-6xl scroll-mt-28 border-t border-white/[0.08] px-5 py-24 sm:px-8 sm:py-32"
            aria-labelledby="changelog-heading"
        >
            <div className="grid gap-10 md:grid-cols-[0.8fr_1.2fr] md:items-start md:gap-16">
                <div>
                    <MaskedHeading
                        id="changelog-heading"
                        className="max-w-[10ch] text-4xl font-medium tracking-[-0.04em] text-white sm:text-5xl"
                    >
                        Built in the open.
                    </MaskedHeading>
                    <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-zinc-400">
                        The workspace changes in public. Read the latest implementation notes,
                        fixes, and experiments directly from the repository history.
                    </p>
                    <a
                        href={CHANGELOG_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-7 inline-flex min-h-10 items-center gap-1.5 text-[13px] text-zinc-300 underline decoration-white/20 underline-offset-4 transition-colors hover:text-white hover:decoration-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                    >
                        View full changelog
                        <ArrowUpRight weight="light" className="size-4" />
                    </a>
                </div>

                <Reveal delayMs={60}>
                    <div className="relative min-h-[22rem] border-y border-white/[0.08]">
                        {status === "loading" && !skeletonGone ? (
                            <div
                                className={cn(
                                    "t-skel-skeleton",
                                    commits && "t-skel-out",
                                )}
                                aria-hidden={Boolean(commits)}
                            >
                                <CommitSkeleton />
                            </div>
                        ) : null}
                        <div className={cn(commits && "t-skel-content-in")}>
                            {commits ? (
                                <ol aria-label="Recent ai.diy changes">
                                    {commits.map((commit, index) => (
                                        <li
                                            key={commit.sha}
                                            className="grid gap-3 border-b border-white/[0.08] py-5 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center"
                                        >
                                            <div className="min-w-0">
                                                <a
                                                    href={commit.html_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex max-w-full items-start gap-2 text-[14px] leading-relaxed text-zinc-200 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                                                >
                                                    <span>{commitTitle(commit)}</span>
                                                    <ArrowUpRight
                                                        weight="light"
                                                        className="mt-0.5 size-3.5 shrink-0 text-zinc-500"
                                                    />
                                                </a>
                                                <div className="mt-2 flex items-center gap-2 font-mono text-[10px] tracking-[0.08em] text-zinc-500">
                                                    <GitCommit weight="light" className="size-3.5" />
                                                    <span>{commit.sha.slice(0, 7)}</span>
                                                    <span aria-hidden className="size-px bg-white/25" />
                                                    <time dateTime={commit.commit.author?.date ?? undefined}>
                                                        {commitDate(commit)}
                                                    </time>
                                                </div>
                                            </div>
                                            <span className="font-mono text-[10px] text-zinc-600 sm:self-start sm:pt-1">
                                                {String(index + 1).padStart(2, "0")}
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                            ) : (
                                <div className="flex min-h-[14rem] flex-col justify-center gap-3 py-8 text-[14px] text-zinc-400">
                                    <p>Recent changes are unavailable right now.</p>
                                    <a
                                        href={GITHUB_URL}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex w-fit items-center gap-1.5 text-zinc-300 underline decoration-white/20 underline-offset-4 transition-colors hover:text-white hover:decoration-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                                    >
                                        Open the repository
                                        <ArrowUpRight weight="light" className="size-4" />
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}
