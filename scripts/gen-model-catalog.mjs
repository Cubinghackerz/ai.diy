/**
 * Regenerates app/lib/model-catalog-fallback.ts from models.dev data.
 *
 * The fallback snapshot covers the built-in DEFAULT_MODELS so hover cards
 * and cost estimates work offline / before the live catalog loads.
 *
 * Usage: node scripts/gen-model-catalog.mjs [path-to-api.json]
 * Without an argument the script fetches https://models.dev/api.json.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PROVIDER_MAP, normalizeCatalog } from "../app/lib/model-catalog.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadRaw(argPath) {
    if (argPath) return JSON.parse(readFileSync(argPath, "utf8"));
    const res = await fetch("https://models.dev/api.json");
    if (!res.ok) throw new Error(`models.dev fetch failed: HTTP ${res.status}`);
    return res.json();
}

/** Parse `provider: [ { id: "x", ... }, ... ]` entries from types.ts. */
function parseDefaultModels(tsSource) {
    const out = new Map();
    const providerRe = /^(\s{4})([a-z0-9]+):\s*\[/gm;
    let match;
    while ((match = providerRe.exec(tsSource)) !== null) {
        const provider = match[2];
        const start = providerRe.lastIndex;
        const end = tsSource.indexOf("],", start);
        if (end === -1) continue;
        const block = tsSource.slice(start, end);
        const ids = [...block.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);
        for (const id of ids) {
            if (!out.has(id)) out.set(id, provider);
        }
    }
    return out;
}

function entryLine(entry) {
    const parts = [];
    for (const key of [
        "id",
        "name",
        "description",
        "family",
        "knowledge",
    ]) {
        const v = entry[key];
        if (v != null && v !== "") {
            parts.push(`${key}: ${JSON.stringify(v)}`);
        }
    }
    for (const key of [
        "toolCall",
        "reasoning",
        "structuredOutput",
        "vision",
        "videoOutput",
        "imageOutput",
    ]) {
        if (entry[key]) parts.push(`${key}: true`);
    }
    if (entry.context != null) parts.push(`context: ${entry.context}`);
    if (entry.maxOutput != null) parts.push(`maxOutput: ${entry.maxOutput}`);
    if (entry.cost) {
        const c = entry.cost;
        const costParts = Object.entries(c)
            .filter(([, v]) => v != null)
            .map(([k, v]) => `${k}: ${v}`);
        if (costParts.length) parts.push(`cost: { ${costParts.join(", ")} }`);
    }
    return `    ${JSON.stringify(entry.id)}: { ${parts.join(", ")} },`;
}

async function main() {
    const argPath = process.argv[2];
    const raw = await loadRaw(argPath);
    const catalog = normalizeCatalog(raw);
    console.log(`catalog: ${Object.keys(catalog.entries).length} entries`);

    const typesSource = readFileSync(path.join(root, "app/lib/types.ts"), "utf8");
    const defaults = parseDefaultModels(typesSource);
    console.log(`DEFAULT_MODELS ids: ${defaults.size}`);

    const lines = [];
    const seen = new Set();
    let found = 0;
    for (const [modelId, provider] of [...defaults.entries()].sort()) {
        const entry = catalog.entries[`${provider}/${modelId}`]
            ?? catalog.entries[modelId]
            ?? Object.values(catalog.entries).find(
                (e) => e.id.split("/").pop() === modelId,
            );
        if (!entry) {
            console.log(`  (no match) ${provider}/${modelId}`);
            continue;
        }
        if (seen.has(entry.id)) continue;
        seen.add(entry.id);
        lines.push(entryLine(entry));
        found++;
    }

    const header = `/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with: node scripts/gen-model-catalog.mjs
 * Source: https://models.dev/api.json (OpenRouter open model dataset).
 */

import type { ModelCatalogEntry } from "./model-catalog.ts";

export type FallbackCatalog = Record<string, ModelCatalogEntry>;

export const FALLBACK_CATALOG: FallbackCatalog = {
`;
    const footer = `};
`;

    const target = path.join(root, "app/lib/model-catalog-fallback.ts");
    writeFileSync(target, header + lines.join("\n") + "\n" + footer);
    console.log(`wrote ${target} (${found} entries)`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
