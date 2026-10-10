import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vite = await createServer({
    root,
    appType: "custom",
    server: { middlewareMode: true },
    resolve: { alias: { "~": path.join(root, "app") } },
});
const models = await vite.ssrLoadModule(path.join(root, "app/lib/chatgpt-models.ts"));
const skills = await vite.ssrLoadModule(path.join(root, "app/lib/skill-command.ts"));
const {
    CHATGPT_SAFE_DEFAULT,
    compareChatGPTSlugs,
    formatChatGPTModelName,
    pickLatestChatGPTModel,
    preferDiscoveredChatGPTModel,
    sortChatGPTModelSlugs,
} = models;
const { detectFinanceIntent } = skills;

let failures = 0;

function check(name, condition, detail = "") {
    if (condition) console.log(`ok - ${name}`);
    else {
        failures += 1;
        console.error(`FAIL - ${name}${detail ? `: ${detail}` : ""}`);
    }
}

const ranked = sortChatGPTModelSlugs([
    "gpt-4o",
    "gpt-5.6-luna",
    "gpt-5.6",
    "gpt-6",
    "gpt-6-luna",
    "gpt-6.1",
    "gpt-6-mini",
    "o3",
]);

check("gpt-6.1 outranks gpt-6", compareChatGPTSlugs("gpt-6.1", "gpt-6") < 0);
check("gpt-6 outranks gpt-5.6-luna", compareChatGPTSlugs("gpt-6", "gpt-5.6-luna") < 0);
check("luna beats mini inside gpt-6", compareChatGPTSlugs("gpt-6-luna", "gpt-6-mini") < 0);
check("newest discovered slug is gpt-6.1", ranked[0] === "gpt-6.1", ranked.join(","));
check("o-series stays after GPT series", ranked.at(-1) === "o3", ranked.join(","));
check(
    "latest chat skips image ids",
    pickLatestChatGPTModel(["gpt-image-1", "gpt-6", "gpt-5.6-luna"]) === "gpt-6",
);
check(
    "stale luna default upgrades to gpt-6",
    preferDiscoveredChatGPTModel("gpt-5.6-luna", ["gpt-5.6-luna", "gpt-6"]) === "gpt-6",
);
check(
    "explicit older pick is kept",
    preferDiscoveredChatGPTModel("gpt-5.4", ["gpt-5.4", "gpt-6"]) === "gpt-5.4",
);
check(
    "missing id falls through to latest",
    preferDiscoveredChatGPTModel("gpt-retired", ["gpt-6", "gpt-5.6"]) === "gpt-6",
);
check(
    "name formats series and codename",
    formatChatGPTModelName("gpt-6.1-luna") === "GPT-6.1 Luna",
);

check("astra leads its own version", compareChatGPTSlugs("gpt-6-astra", "gpt-6-sol") < 0);
check("gpt-6.1 sol outranks gpt-6 astra", compareChatGPTSlugs("gpt-6.1-sol", "gpt-6-astra") < 0);
check(
    "live GPT-6 catalog picks the newest chat model",
    pickLatestChatGPTModel(["gpt-6-luna", "gpt-6.1-sol", "gpt-6-sol", "gpt-5.6-luna"]) ===
        "gpt-6.1-sol",
);
check(
    "stale default is only upgraded from a catalog that has something newer",
    preferDiscoveredChatGPTModel(CHATGPT_SAFE_DEFAULT, ["gpt-5.6-luna", "gpt-5.5"]) ===
        CHATGPT_SAFE_DEFAULT,
);
check("safe default is a long-standing model id", CHATGPT_SAFE_DEFAULT === "gpt-5.6-luna");

const types = await vite.ssrLoadModule(path.join(root, "app/lib/types.ts"));
const fallbackIds = (types.DEFAULT_MODELS.chatgpt ?? []).map((model) => model.id);
check(
    "bundled fallback lists the newest series first",
    sortChatGPTModelSlugs(fallbackIds)[0] === fallbackIds[0],
    fallbackIds.slice(0, 4).join(","),
);

const auth = await vite.ssrLoadModule(path.join(root, "app/lib/server/chatgpt-auth.ts"));
const [, minor, patch] = auth.DEFAULT_LWC_CLIENT_VERSION.split(".").map(Number);
check(
    "default Codex client version is recent enough to list GPT-6.x (>= 0.159.0)",
    minor > 159 || (minor === 159 && patch >= 0),
    auth.DEFAULT_LWC_CLIENT_VERSION,
);

check("finance intent: earnings", detectFinanceIntent("What did NVDA report in earnings?"));
check("finance intent: mortgage", detectFinanceIntent("Compare this mortgage rate to last year"));
check("not finance: stock photo", detectFinanceIntent("Find a stock photo of a cat") === false);
check("not finance: short", detectFinanceIntent("stocks") === false);

await vite.close();
if (failures > 0) {
    console.error(`${failures} chatgpt-model check(s) failed`);
    process.exit(1);
}
console.log("All ChatGPT model checks passed.");
