import { useCallback, useEffect, useState } from "react";
import { GITHUB_REPO } from "./constants";

const STARS_CACHE_KEY = "ai.diy:github-stars";
const STARS_CACHE_TTL = 15 * 60 * 1000;

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

export function useCopy(text: string) {
    const [copied, setCopied] = useState(false);
    const [copyError, setCopyError] = useState(false);
    const copy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setCopyError(false);
            window.setTimeout(() => setCopied(false), 1400);
        } catch {
            setCopied(false);
            setCopyError(true);
            window.setTimeout(() => setCopyError(false), 2200);
        }
    }, [text]);
    return { copied, copy, copyError };
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
