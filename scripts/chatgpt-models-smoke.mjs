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
check("name formats series and codename", formatChatGPTModelName("gpt-6.1-luna") === "GPT-6.1 Luna");

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
