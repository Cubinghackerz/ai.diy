/**
 * Two server processes sharing `.data/` must not erase each other's ChatGPT
 * sessions. Two FileKeyValueStore instances over one file model two processes.
 */
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = "chatgpt-file-store-smoke.json";
const FILE_PATH = path.join(root, ".data", FILE);

const vite = await createServer({
    root,
    appType: "custom",
    server: { middlewareMode: true },
    resolve: { alias: { "~": path.join(root, "app") } },
    logLevel: "silent",
});
const { FileKeyValueStore } = await vite.ssrLoadModule(path.join(root, "app/lib/server/local-persist.ts"));

let failures = 0;
function check(name, condition, detail = "") {
    if (condition) console.log(`ok - ${name}`);
    else {
        failures += 1;
        console.error(`FAIL - ${name}${detail ? `: ${detail}` : ""}`);
    }
}
const cleanup = () => existsSync(FILE_PATH) && unlinkSync(FILE_PATH);

cleanup();
const processA = new FileKeyValueStore(FILE);
const processB = new FileKeyValueStore(FILE);

processA.set("signed-in", { tokens: "a" });
check("B sees a session written by A", processB.get("signed-in")?.tokens === "a");

processB.set("other-user", { tokens: "b" });
check("A sees a session written by B", processA.get("other-user")?.tokens === "b");

processA.set("third", { tokens: "c" });
check("A's write keeps B's session on disk", processB.get("other-user")?.tokens === "b");
check("B's write keeps A's session on disk", processB.get("signed-in")?.tokens === "a");

processB.delete("other-user");
check("a delete in B is seen by A", processA.get("other-user") === undefined);
check("a delete leaves the other sessions alone", processA.get("signed-in")?.tokens === "a");

const restarted = new FileKeyValueStore(FILE);
check("a fresh process reads everything back", restarted.get("third")?.tokens === "c");

processA.set("short", { tokens: "d" }, { ttlMs: 30 });
await new Promise((resolve) => setTimeout(resolve, 60));
check("expired entries disappear", processB.get("short") === undefined);

cleanup();
await vite.close();
if (failures > 0) {
    console.error(`\n${failures} file-store check(s) failed.`);
    process.exit(1);
}
console.log("\nAll file-store checks passed.");
