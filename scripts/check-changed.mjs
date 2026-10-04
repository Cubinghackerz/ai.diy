import { execFileSync, spawnSync } from "node:child_process";
import { ESLint } from "eslint";

const mode = process.argv[2] ?? "lint";
const requestedBase = process.env.CHECK_BASE || "HEAD";
const base = /^0+$/.test(requestedBase) ? "HEAD" : requestedBase;
const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
const changed = new Set([
    ...git("diff", "--name-only", "--diff-filter=ACMR", "-z", base).split("\0"),
    ...git("ls-files", "--others", "--exclude-standard", "-z").split("\0"),
]);
const files = [...changed].filter((file) => file && file !== "package-lock.json");
if (mode === "format") {
    const targets = files.filter((file) => /\.(?:[cm]?[jt]sx?|json|css|md|ya?ml)$/.test(file));
    if (targets.length) {
        const result = spawnSync(
            process.execPath,
            ["node_modules/prettier/bin/prettier.cjs", "--check", ...targets],
            { stdio: "inherit" },
        );
        process.exit(result.status ?? 1);
    }
} else {
    const targets = files.filter((file) => /\.(?:[cm]?[jt]sx?)$/.test(file));
    const eslint = new ESLint();
    const results = targets.length ? await eslint.lintFiles(targets) : [];
    let failures = 0;
    let inherited = 0;
    for (let index = 0; index < results.length; index++) {
        const result = results[index];
        const file = result.filePath;
        const relative = file.slice(process.cwd().length + 1);
        const baseline = spawnSync("git", ["show", `${base}:${relative}`], { encoding: "utf8" });
        const previous =
            baseline.status === 0
                ? (await eslint.lintText(baseline.stdout, { filePath: file }))[0].messages
                : [];
        const counts = new Map();
        const signature = (message) => `${message.ruleId}:${message.message}`;
        for (const message of previous.filter((message) => message.severity === 2)) {
            const key = signature(message);
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        for (const message of result.messages) {
            if (message.severity !== 2) continue;
            const key = signature(message);
            if (counts.get(key) > 0) {
                counts.set(key, counts.get(key) - 1);
                inherited++;
                continue;
            }
            failures++;
            console.error(
                `${relative}:${message.line}:${message.column} ${message.ruleId}: ${message.message}`,
            );
        }
    }
    if (inherited)
        console.log(
            `${inherited} existing lint errors remain in touched legacy files; no new errors are allowed.`,
        );
    if (failures) process.exit(1);
    console.log(`Lint passed for ${targets.length} changed files.`);
}
