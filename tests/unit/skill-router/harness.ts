import queriesJson from "./queries.json";

export type SkillQuery = {
    id: string;
    family: string;
    query: string;
    expect: string;
    mustNotLoad: string[];
};

export type Retriever = (query: string) => string[];

export type ScoreResult = {
    positives: number;
    negatives: number;
    top1: number;
    top3: number;
    falseLoads: number;
    falsePositiveRate: number;
    p50Ms: number;
    p95Ms: number;
};

function percentile(sorted: number[], p: number): number {
    if (!sorted.length) return 0;
    const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
    return sorted[Math.max(0, idx)];
}

export function loadQueries(): SkillQuery[] {
    return queriesJson as SkillQuery[];
}

export function scoreRetriever(
    retriever: Retriever,
    queries: SkillQuery[] = loadQueries(),
): ScoreResult {
    const positives = queries.filter((q) => q.expect !== "");
    const negatives = queries.filter((q) => q.expect === "");
    let top1 = 0;
    let top3 = 0;
    let falseLoads = 0;
    const times: number[] = [];

    for (const q of queries) {
        const start = performance.now();
        let results: string[] = [];
        try {
            results = retriever(q.query) ?? [];
        } catch {
            results = [];
        }
        const elapsed = performance.now() - start;
        times.push(elapsed);
        if (q.expect === "") {
            if (results.length > 0) falseLoads += 1;
        } else {
            if (results[0] === q.expect) top1 += 1;
            if (results.slice(0, 3).includes(q.expect)) top3 += 1;
        }
    }

    const sorted = [...times].sort((a, b) => a - b);
    return {
        positives: positives.length,
        negatives: negatives.length,
        top1: positives.length ? top1 / positives.length : 0,
        top3: positives.length ? top3 / positives.length : 0,
        falseLoads,
        falsePositiveRate: negatives.length ? falseLoads / negatives.length : 0,
        p50Ms: percentile(sorted, 50),
        p95Ms: percentile(sorted, 95),
    };
}
