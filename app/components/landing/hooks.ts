import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { GITHUB_REPO } from "./constants";

const STARS_CACHE_KEY = "ai.diy:github-stars";
const STARS_CACHE_TTL = 15 * 60 * 1000;
const COMMITS_CACHE_KEY = "ai.diy:github-commits";
const COMMITS_CACHE_TTL = 30 * 60 * 1000;

export type GithubCommit = {
    sha: string;
    html_url: string;
    commit: {
        message: string;
        author?: { date?: string | null } | null;
    };
};

function isGithubCommit(value: unknown): value is GithubCommit {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as {
        sha?: unknown;
        html_url?: unknown;
        commit?: { message?: unknown; author?: { date?: unknown } | null };
    };
    return (
        typeof candidate.sha === "string" &&
        typeof candidate.html_url === "string" &&
        typeof candidate.commit?.message === "string" &&
        (candidate.commit.author === null ||
            candidate.commit.author === undefined ||
            typeof candidate.commit.author.date === "string")
    );
}

function readCachedStars(): number | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.sessionStorage.getItem(STARS_CACHE_KEY);
        if (!raw) return null;
        const cached = JSON.parse(raw) as { value?: number; savedAt?: number };
        if (
            typeof cached.value !== "number" ||
            typeof cached.savedAt !== "number" ||
            Date.now() - cached.savedAt > STARS_CACHE_TTL
        ) {
            return null;
        }
        return cached.value;
    } catch {
        return null;
    }
}

function cacheStars(value: number) {
    try {
        window.sessionStorage.setItem(
            STARS_CACHE_KEY,
            JSON.stringify({ value, savedAt: Date.now() }),
        );
    } catch {
        /* Storage can be unavailable in private browsing. */
    }
}

export function useGithubStars() {
    const [stars, setStars] = useState<number | null>(readCachedStars);
    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 5000);
        void fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
            headers: { Accept: "application/vnd.github+json" },
            signal: controller.signal,
        })
            .then((r) => (r.ok ? r.json() : null))
            .then((data: { stargazers_count?: number } | null) => {
                if (cancelled) return;
                if (data && typeof data.stargazers_count === "number") {
                    setStars(data.stargazers_count);
                    cacheStars(data.stargazers_count);
                }
            })
            .catch(() => {})
            .finally(() => window.clearTimeout(timeout));
        return () => {
            cancelled = true;
            controller.abort();
            window.clearTimeout(timeout);
        };
    }, []);
    return stars;
}

export function formatStars(n: number) {
    if (n >= 1000) {
        return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}k`;
    }
    return String(n);
}

function readCachedCommits(): GithubCommit[] | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.sessionStorage.getItem(COMMITS_CACHE_KEY);
        if (!raw) return null;
        const cached = JSON.parse(raw) as { value?: unknown; savedAt?: number };
        if (
            !Array.isArray(cached.value) ||
            typeof cached.savedAt !== "number" ||
            Date.now() - cached.savedAt > COMMITS_CACHE_TTL
        ) {
            return null;
        }
        const commits = cached.value.filter(isGithubCommit).slice(0, 5);
        return commits.length ? commits : null;
    } catch {
        return null;
    }
}

function cacheCommits(value: GithubCommit[]) {
    try {
        window.sessionStorage.setItem(
            COMMITS_CACHE_KEY,
            JSON.stringify({ value, savedAt: Date.now() }),
        );
    } catch {
        /* Storage can be unavailable in private browsing. */
    }
}

export function useGithubCommits() {
    const [commits, setCommits] = useState<GithubCommit[] | null>(readCachedCommits);
    const [status, setStatus] = useState<"loading" | "ready" | "error">(
        () => (readCachedCommits() ? "ready" : "loading"),
    );

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 5000);

        void fetch(`https://api.github.com/repos/${GITHUB_REPO}/commits?per_page=5`, {
            headers: { Accept: "application/vnd.github+json" },
            signal: controller.signal,
        })
            .then((response) => {
                if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
                return response.json() as Promise<unknown>;
            })
            .then((data) => {
                if (cancelled || !Array.isArray(data)) return;
                const next = data.filter(isGithubCommit).slice(0, 5);
                setCommits(next.length ? next : null);
                setStatus("ready");
                if (next.length) cacheCommits(next);
            })
            .catch(() => {
                if (!cancelled && !commits) setStatus("error");
            })
            .finally(() => window.clearTimeout(timeout));

        return () => {
            cancelled = true;
            controller.abort();
            window.clearTimeout(timeout);
        };
    }, []);
    return { commits, status };
}

export function useCopy(text: string) {
    const [copied, setCopied] = useState(false);
    const copy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
        } catch {
            /* ignore */
        }
    }, [text]);
    return { copied, copy };
}

export function usePrefersReducedMotion() {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        const sync = () => setReduced(mq.matches);
        sync();
        mq.addEventListener("change", sync);
        return () => mq.removeEventListener("change", sync);
    }, []);
    return reduced;
}

export function useFinePointer() {
    return useSyncExternalStore(
        (onStoreChange) => {
            const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
            mq.addEventListener("change", onStoreChange);
            return () => mq.removeEventListener("change", onStoreChange);
        },
        () => window.matchMedia("(hover: hover) and (pointer: fine)").matches,
        () => false,
    );
}
