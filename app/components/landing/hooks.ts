import { useCallback, useEffect, useState } from "react";
import { GITHUB_REPO } from "./constants";

export function useGithubStars() {
    const [stars, setStars] = useState<number | null>(null);
    useEffect(() => {
        let cancelled = false;
        void fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
            headers: { Accept: "application/vnd.github+json" },
        })
            .then((r) => (r.ok ? r.json() : null))
            .then((data: { stargazers_count?: number } | null) => {
                if (cancelled) return;
                if (data && typeof data.stargazers_count === "number") {
                    setStars(data.stargazers_count);
                }
            })
            .catch(() => {});
        return () => {
            cancelled = true;
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
