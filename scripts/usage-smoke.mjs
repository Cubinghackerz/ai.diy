import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
    normalizeCatalog,
    catalogKey,
    lookupCatalogEntry,
    lookupFallbackEntry,
    fallbackCatalogAsCatalog,
    formatContextWindow,
    formatPricePerMillion,
} from "../app/lib/model-catalog.ts";
import {
    normalizeUsage,
    usageFromStoredMessage,
    estimateCost,
    aggregateUsage,
    formatTokens,
    formatCost,
    bytesToHex,
    rollupUsageForFingerprint,
    checkUsageLimits,
} from "../app/lib/usage.ts";

let failures = 0;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function check(name, condition, detail = "") {
    if (condition) {
        console.log(`ok - ${name}`);
    } else {
        failures++;
        console.error(`FAIL - ${name} ${detail}`);
    }
}

// ─── Catalog normalization ───────────────────────────────────
const raw = {
    openai: {
        models: {
            "gpt-5": {
                id: "gpt-5",
                name: "GPT-5",
                description: "Workhorse",
                reasoning: true,
                tool_call: true,
                structured_output: true,
                attachment: true,
                limit: { context: 400000, output: 128000 },
                cost: { input: 1.25, output: 10, cache_read: 0.125 },
            },
            "gpt-4o": {
                id: "gpt-4o",
                name: "GPT-4o",
                tool_call: true,
                cost: { input: 2.5, output: 10 },
            },
        },
    },
    openrouter: {
        models: {
            "openai/gpt-5.6": {
                id: "openai/gpt-5.6",
                name: "GPT-5.6",
                tool_call: true,
                cost: { input: 5, output: 30 },
            },
        },
    },
};
const catalog = normalizeCatalog(raw);
check("catalog entry count", Object.keys(catalog.entries).length === 3);
check("qualified id (provider prefix)", Boolean(catalog.entries["openai/gpt-5"]));
check("qualified id (already qualified)", Boolean(catalog.entries["openai/gpt-5.6"]));
check("vision from attachment", catalog.entries["openai/gpt-5"].vision === true);
check("reasoning flag", catalog.entries["openai/gpt-5"].reasoning === true);
check("byId index", catalog.byId["gpt-5"]?.includes("openai/gpt-5"));

check("catalogKey openai", catalogKey("openai", "gpt-5") === "openai/gpt-5");
check("catalogKey gemini→google", catalogKey("gemini", "gemini-2.5-pro") === "google/gemini-2.5-pro");
check("catalogKey gateway qualified", catalogKey("gateway", "openai/gpt-5.6") === "openai/gpt-5.6");
check("catalogKey ollama (no map)", catalogKey("ollama", "llama3") === undefined);

check(
    "lookup exact",
    lookupCatalogEntry(catalog, "openai", "gpt-5")?.name === "GPT-5",
);
check(
    "lookup byId fallback (bad provider id)",
    lookupCatalogEntry(catalog, "openai", "gpt-4o")?.name === "GPT-4o",
);

// ─── Bundled fallback snapshot ───────────────────────────────
const fallback = fallbackCatalogAsCatalog();
check("fallback has entries", Object.keys(fallback.entries).length > 50);
const fbGpt5 = lookupFallbackEntry("openai", "gpt-5");
check("fallback gpt-5 cost", fbGpt5?.cost?.input === 1.25, JSON.stringify(fbGpt5));
const fbClaude = lookupFallbackEntry("anthropic", "claude-opus-4-5-20251101");
check("fallback claude-opus-4-5", fbClaude?.cost?.output === 25, JSON.stringify(fbClaude));

check("formatContextWindow 128000", formatContextWindow(128000) === "128K");
check("formatContextWindow 1048576", formatContextWindow(1048576) === "1M");
check("formatContextWindow undefined", formatContextWindow(undefined) === undefined);
check(
    "formatPricePerMillion",
    formatPricePerMillion({ input: 1.25, output: 10 }) ===
        "≈$1.25 in / $10 out per 1M",
);
check("formatPricePerMillion empty", formatPricePerMillion(undefined) === undefined);

// ─── Usage normalization ─────────────────────────────────────
const aiSdkUsage = normalizeUsage({
    inputTokens: 1000,
    outputTokens: 200,
    reasoningTokens: 50,
    totalTokens: 1200,
});
check(
    "ai sdk usage",
    aiSdkUsage?.inputTokens === 1000 && aiSdkUsage?.outputTokens === 200,
);
const rawProviderUsage = normalizeUsage({ promptTokens: 10, completionTokens: 20 });
check(
    "raw provider usage",
    rawProviderUsage?.inputTokens === 10 && rawProviderUsage?.outputTokens === 20,
);
const googleNested = normalizeUsage({
    inputTokens: { total: 1400, noCache: 1400, cacheRead: 0 },
    outputTokens: { total: 32, text: 32, reasoning: 0 },
    raw: { promptTokenCount: 1400, candidatesTokenCount: 32, totalTokenCount: 1432 },
});
check(
    "google nested usage",
    googleNested?.inputTokens === 1400 &&
        googleNested?.outputTokens === 32 &&
        googleNested?.totalTokens === 1432,
    JSON.stringify(googleNested),
);

const stored = {
    id: "m1",
    threadId: "t1",
    role: "assistant",
    content: "hi",
    createdAt: 1,
    uiMessage: {
        id: "m1",
        role: "assistant",
        parts: [{ type: "text", text: "hi" }],
        metadata: {
            usage: { inputTokens: 500, outputTokens: 100 },
            model: "gpt-5",
            provider: "openai",
        },
    },
};
const rec = usageFromStoredMessage(stored);
check(
    "usageFromStoredMessage",
    rec?.usage.inputTokens === 500 && rec?.model === "gpt-5" && rec?.threadId === "t1",
    JSON.stringify(rec),
);
check(
    "usageFromStoredMessage skips no-metadata",
    usageFromStoredMessage({ ...stored, uiMessage: undefined }) === null,
);

// ─── Cost estimation ─────────────────────────────────────────
const gpt5Entry = lookupFallbackEntry("openai", "gpt-5");
const cost = estimateCost(
    { inputTokens: 1_000_000, outputTokens: 100_000, reasoningTokens: 0, cachedInputTokens: 0, totalTokens: 1_100_000 },
    gpt5Entry,
);
check("estimateCost gpt-5", cost != null && Math.abs(cost - 2.25) < 1e-9, `cost=${cost}`);
const cachedCost = estimateCost(
    { inputTokens: 1_000_000, outputTokens: 0, reasoningTokens: 0, cachedInputTokens: 1_000_000, totalTokens: 1_000_000 },
    gpt5Entry,
);
check("estimateCost cached input", cachedCost != null && Math.abs(cachedCost - 0.125) < 1e-9, `cost=${cachedCost}`);
check("estimateCost unknown entry", estimateCost({ ...rawProviderUsage.usage }, undefined) === null);

// ─── Aggregation ─────────────────────────────────────────────
const agg = aggregateUsage(
    [
        {
            usage: { inputTokens: 1000, outputTokens: 100, reasoningTokens: 0, cachedInputTokens: 0, totalTokens: 1100 },
            model: "gpt-5",
            provider: "openai",
            threadId: "t1",
        },
        {
            usage: { inputTokens: 500, outputTokens: 50, reasoningTokens: 0, cachedInputTokens: 0, totalTokens: 550 },
            model: "gpt-5",
            provider: "openai",
            threadId: "t2",
        },
        {
            usage: { inputTokens: 200, outputTokens: 20, reasoningTokens: 0, cachedInputTokens: 0, totalTokens: 220 },
            model: "gpt-4o",
            provider: "openai",
            threadId: "t2",
        },
    ],
    (model, provider) => lookupFallbackEntry(provider, model),
    {
        threadMeta: new Map([
            ["t1", { title: "Chat one" }],
            ["t2", { title: "Chat two" }],
        ]),
    },
);
check("aggregate totals input", agg.totals.inputTokens === 1700);
check("aggregate totals output", agg.totals.outputTokens === 170);
check("aggregate messages", agg.messagesWithUsage === 3);
check("aggregate threads", agg.chatThreads === 2);
check("aggregate byModel groups", agg.byModel.length === 2);
check(
    "aggregate byModel sorted",
    agg.byModel[0].model === "gpt-5" && agg.byModel[0].usage.totalTokens === 1650,
);
check("aggregate byProvider", agg.byProvider.length === 1 && agg.byProvider[0].provider === "openai");
check("aggregate thread titles", agg.threads.find((t) => t.threadId === "t2")?.title === "Chat two");
check("aggregate cost known", agg.totalCost != null && agg.totalCost > 0);

// ─── Usage ledger rollup & limits ────────────────────────────
check(
    "bytesToHex",
    bytesToHex(new Uint8Array([0, 255, 16])) === "00ff10",
);
const sampleEvents = /** @type {UsageEvent[]} */ ([
    {
        id: "e1",
        keyFingerprint: "abc",
        provider: "openai",
        model: "gpt-5",
        inputTokens: 1000,
        outputTokens: 100,
        reasoningTokens: 0,
        cachedInputTokens: 0,
        totalTokens: 1100,
        estimatedCostUsd: 0.01,
        source: "chat",
        createdAt: Date.now() - 45_000,
    },
    {
        id: "e2",
        keyFingerprint: "abc",
        provider: "openai",
        model: "gpt-5",
        inputTokens: 500,
        outputTokens: 50,
        reasoningTokens: 0,
        cachedInputTokens: 0,
        totalTokens: 550,
        estimatedCostUsd: 0.005,
        source: "chat",
        createdAt: Date.now() - 15_000,
    },
]);
const rollup = rollupUsageForFingerprint(sampleEvents);
check("rollup total tokens", rollup.totalTokens === 1650);
check("rollup total cost", Math.abs(rollup.totalCostUsd - 0.015) < 1e-9);
check("rollup event count", rollup.eventCount === 2);
check("rollup rpm count", rollup.requestsInLastMinute === 2);

const blocked = checkUsageLimits(
    {
        enabled: true,
        dailyTokenCap: 1000,
        blockWhenExceeded: true,
    },
    rollup,
);
check("checkUsageLimits blocks tokens", blocked.blocked === true);

const warn = checkUsageLimits(
    {
        enabled: true,
        dailyTokenCap: 2000,
        warnAtPercent: 80,
        blockWhenExceeded: true,
    },
    rollup,
);
check("checkUsageLimits warns near cap", warn.warn === true && warn.ok === true);

const rpmBlocked = checkUsageLimits(
    {
        enabled: true,
        requestsPerMinute: 1,
        blockWhenExceeded: true,
    },
    rollup,
);
check("checkUsageLimits blocks rpm", rpmBlocked.blocked === true);

check(
    "checkUsageLimits disabled passes",
    checkUsageLimits({ enabled: false }, rollup).ok === true,
);

// ─── Formatting ──────────────────────────────────────────────
check("formatTokens M", formatTokens(1_200_000) === "1.2M");
check("formatTokens K", formatTokens(12_300) === "12.3K");
check("formatCost small", formatCost(0.0042) === "$0.0042");
check("formatCost mid", formatCost(1.234) === "$1.23");
check("formatCost unknown", formatCost(null) === "—");

// ─── Video / image output detection (catalog-driven) ────────
const videoRaw = {
    google: {
        models: {
            "veo-3.1-generate-001": {
                id: "veo-3.1-generate-001",
                name: "Veo 3.1",
                modalities: { input: ["text"], output: ["video"] },
            },
            "gemini-2.5-flash-image": {
                id: "gemini-2.5-flash-image",
                name: "Gemini 2.5 Flash Image",
                modalities: { input: ["text", "image"], output: ["text", "image"] },
            },
        },
    },
};
const videoCatalog = normalizeCatalog(videoRaw);
check(
    "video output flag",
    lookupCatalogEntry(videoCatalog, "google", "veo-3.1-generate-001")
        ?.videoOutput === true,
);
check(
    "no video flag on chat model",
    lookupCatalogEntry(videoCatalog, "google", "gemini-2.5-flash-image")
        ?.videoOutput !== true,
);
check(
    "image output flag",
    lookupCatalogEntry(videoCatalog, "google", "gemini-2.5-flash-image")
        ?.imageOutput === true,
);
const fallbackSource = readFileSync(
    path.join(root, "app/lib/model-catalog-fallback.ts"),
    "utf8",
);
check(
    "fallback has video entries",
    fallbackSource.includes('"google/veo-3.1-generate-preview"') &&
        fallbackSource.includes("videoOutput: true"),
);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} checks FAILED.`);
process.exit(failures === 0 ? 0 : 1);
