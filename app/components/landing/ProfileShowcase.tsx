import { useEffect, useState } from "react";
import { ArrowSquareOut, GitCommit, Star } from "@phosphor-icons/react";
import { GITHUB_REPO, GITHUB_URL } from "./constants";
import { DoubleBezel, Reveal } from "./DoubleBezel";
import { formatStars } from "./hooks";
import { EASE_OUT } from "./motion";

const PROFILE_URL = "https://github.com/Cubinghackerz";
const API_USER = "https://api.github.com/users/Cubinghackerz";
const API_REPO = `https://api.github.com/repos/${GITHUB_REPO}`;
const API_COMMITS = `https://api.github.com/repos/${GITHUB_REPO}/commits?per_page=1`;
const GITHUB_CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

type ProfileData = {
    login: string;
    name: string | null;
    avatarUrl: string;
    bio: string | null;
    htmlUrl: string;
};

type RepoData = {
    stars: number;
    forks: number;
    commits: number | null;
};

function parseCommitCount(linkHeader: string | null): number | null {
    if (!linkHeader) return 1;
    const last = linkHeader
        .split(",")
        .map((part) => part.trim())
        .find((part) => part.includes('rel="last"'));
    if (!last) return 1;
    const match = /[?&]page=(\d+)/.exec(last);
    if (!match) return 1;
    const page = Number.parseInt(match[1]!, 10);
    return Number.isFinite(page) ? page : null;
}

function readGithubCache<T>(url: string): T | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.sessionStorage.getItem(`ai.diy:github:${url}`);
        if (!raw) return null;
        const cached = JSON.parse(raw) as { value?: T; savedAt?: number };
        if (
            cached.value === undefined ||
            typeof cached.savedAt !== "number" ||
            Date.now() - cached.savedAt > GITHUB_CACHE_MAX_AGE
        ) {
            return null;
        }
        return cached.value;
    } catch {
        return null;
    }
}

function writeGithubCache<T>(url: string, value: T) {
    try {
        window.sessionStorage.setItem(
            `ai.diy:github:${url}`,
            JSON.stringify({ value, savedAt: Date.now() }),
        );
    } catch {
        /* Storage can be unavailable in private browsing. */
    }
}

async function fetchGithubJson<T>(url: string): Promise<T | null> {
    const cached = readGithubCache<T>(url);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(url, {
            headers: {
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            signal: controller.signal,
        });
        if (!res.ok) return cached;
        const value = (await res.json()) as T;
        writeGithubCache(url, value);
        return value;
    } catch {
        return cached;
    } finally {
        window.clearTimeout(timeout);
    }
}

async function fetchGithubResponse(url: string): Promise<Response | null> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    try {
        return await fetch(url, {
            headers: {
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            signal: controller.signal,
        });
    } catch {
        return null;
    } finally {
        window.clearTimeout(timeout);
    }
}

export function ProfileShowcase() {
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [repo, setRepo] = useState<RepoData | null>(null);

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            try {
                const [user, repoJson, commitsRes] = await Promise.all([
                    fetchGithubJson<{
                        login: string;
                        name: string | null;
                        avatar_url: string;
                        bio: string | null;
                        html_url: string;
                    }>(API_USER),
                    fetchGithubJson<{
                        stargazers_count?: number;
                        forks_count?: number;
                    }>(API_REPO),
                    fetchGithubResponse(API_COMMITS),
                ]);

                if (cancelled) return;

                if (user) {
                    setProfile({
                        login: user.login,
                        name: user.name,
                        avatarUrl: user.avatar_url,
                        bio: user.bio,
                        htmlUrl: user.html_url,
                    });
                }

                const cachedCommits = readGithubCache<number>(API_COMMITS);
                const commits = commitsRes?.ok
                    ? parseCommitCount(commitsRes.headers.get("Link"))
                    : cachedCommits;

                if (commitsRes?.ok && commits != null) {
                    writeGithubCache(API_COMMITS, commits);
                }

                setRepo({
                    stars: repoJson?.stargazers_count ?? 0,
                    forks: repoJson?.forks_count ?? 0,
                    commits,
                });
            } catch {
                /* public API may fail offline; keep graceful empty */
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <section
            className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24"
            data-anim-gate="profile"
            aria-label="Builder profile"
        >
            <Reveal>
                <p className="font-mono text-[11px] text-zinc-600">Built in public</p>
                <h2 className="mt-2 text-2xl font-medium tracking-tight text-white sm:text-3xl">
                    From Cubinghackerz
                </h2>
                <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-zinc-500">
                    Live stats for the{" "}
                    <a
                        href={GITHUB_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="text-zinc-300 underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                    >
                        ai.diy
                    </a>{" "}
                    repository — commits refresh from the public GitHub API.
                </p>
            </Reveal>

            <Reveal delayMs={40} className="mt-8">
                <DoubleBezel
                    outerRadius="rounded-[1.75rem]"
                    innerRadius="rounded-[calc(1.75rem-0.375rem)]"
                >
                    <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
                        <a
                            href={PROFILE_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="group flex min-w-0 items-center gap-4 rounded-xl outline-none transition-opacity duration-200 hover:opacity-95 focus-visible:ring-2 focus-visible:ring-white/40"
                            style={{ transitionTimingFunction: EASE_OUT }}
                        >
                            <img
                                src={
                                    profile?.avatarUrl ??
                                    "https://avatars.githubusercontent.com/u/207402330?v=4"
                                }
                                alt=""
                                width={56}
                                height={56}
                                className="size-14 shrink-0 rounded-full outline outline-1 outline-white/10"
                            />
                            <div className="min-w-0 text-left">
                                <p className="truncate text-[15px] font-medium text-white">
                                    {profile?.name ?? "Cubinghackerz"}
                                </p>
                                <p className="mt-0.5 truncate font-mono text-[12px] text-zinc-500">
                                    @{profile?.login ?? "Cubinghackerz"}
                                </p>
                                {profile?.bio ? (
                                    <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-zinc-500">
                                        {profile.bio}
                                    </p>
                                ) : null}
                            </div>
                            <ArrowSquareOut
                                weight="light"
                                className="ml-auto hidden size-4 shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-300 sm:block"
                            />
                        </a>

                        <a
                            href={GITHUB_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="flex shrink-0 flex-col gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 transition-[border-color,background-color] duration-200 hover:border-white/20 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:min-w-[14rem]"
                            style={{ transitionTimingFunction: EASE_OUT }}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <span className="font-mono text-[12px] text-zinc-300">
                                    Cubinghackerz/ai.diy
                                </span>
                                <ArrowSquareOut weight="light" className="size-3.5 text-zinc-600" />
                            </div>
                            <div className="flex flex-wrap gap-4 font-mono text-[12px] text-zinc-500">
                                <span className="inline-flex items-center gap-1.5">
                                    <Star weight="light" className="size-3.5" />
                                    {repo ? formatStars(repo.stars) : "—"} stars
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <GitCommit weight="light" className="size-3.5" />
                                    {repo?.commits != null ? repo.commits.toLocaleString() : "—"}{" "}
                                    commits
                                </span>
                            </div>
                        </a>
                    </div>
                </DoubleBezel>
            </Reveal>
        </section>
    );
}
