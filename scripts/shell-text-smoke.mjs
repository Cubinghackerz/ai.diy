import { Bash, InMemoryFs } from "just-bash";
import {
    SHELL_TEXT_MAX_TIMEOUT_MS,
    SHELL_TEXT_OUTPUT_CAP,
    capShellTextOutput,
    formatShellTextOutput,
    isCommandNotFound,
    needsHeavyToolchain,
    resolveShellTextTimeoutMs,
} from "../app/lib/shell-text.ts";

let failures = 0;

function check(name, condition, detail = "") {
    if (condition) console.log(`ok - ${name}`);
    else {
        failures += 1;
        console.error(`FAIL - ${name}${detail ? `: ${detail}` : ""}`);
    }
}

async function main() {
    for (const script of [
        'echo "hello"',
        "ls -la /tmp | grep foo",
        "cat a.txt | sort | uniq -c",
        "echo hi > f.txt && cat f.txt",
        "for i in 1 2 3; do echo $i; done",
        "VAR=1 && echo $VAR",
        "awk -F, '{print $2}' data.csv | sort -n",
        "tar -czf out.tar.gz f.txt",
        "find . -name '*.log' | xargs grep -l ERROR",
        "cmd 2>&1 | tee out.txt",
        "a && b || c",
    ]) {
        check(`fast path eligible: ${script.slice(0, 40)}`, needsHeavyToolchain(script) === false);
    }

    for (const script of [
        "gcc main.c -o main && ./main",
        "node --version",
        "npm install",
        "npm run build",
        "python3 -c \"print(1)\"",
        "pip install requests",
        "apt update",
        "curl -s https://example.com",
        "git clone https://example.com/r.git",
        "make -j4",
        "./server &",
        "sleep 30 &",
        "sleep 5 & wait",
        "sudo apt install -y htop",
        "docker run hello-world",
        "gzip -c f.txt",
        "gunzip archive.gz",
        "zcat archive.gz",
    ]) {
        check(`VM required: ${script.slice(0, 40)}`, needsHeavyToolchain(script) === true);
    }

    check("empty script is not heavy", needsHeavyToolchain("   ") === false);
    check("comment-only script is not heavy", needsHeavyToolchain("# gcc notes") === false);

    check("default timeout is 90s", resolveShellTextTimeoutMs(undefined) === 90_000);
    check("explicit timeout passes through", resolveShellTextTimeoutMs(10) === 10_000);
    check(
        "timeout clamps at VM ceiling",
        resolveShellTextTimeoutMs(600) === SHELL_TEXT_MAX_TIMEOUT_MS,
    );

    check("short output untouched", capShellTextOutput("hi") === "hi");
    const long = "x".repeat(SHELL_TEXT_OUTPUT_CAP + 10);
    const capped = capShellTextOutput(long);
    check("long output truncated with marker", capped.endsWith("[truncated: output exceeded 32KB]"));

    check("127 + not-found is unsupported", isCommandNotFound(127, "bash: gcc: command not found") === true);
    check("other exit is supported", isCommandNotFound(1, "bash: gcc: command not found") === false);
    check("127 without marker is supported", isCommandNotFound(127, "killed") === false);

    const formatted = formatShellTextOutput({ stdout: "a", stderr: "b", exitCode: 0, timedOut: false });
    check(
        "formatted output shape",
        formatted.includes("stdout:\na") && formatted.includes("stderr:\nb") && formatted.includes("exitCode: 0"),
    );
    check(
        "empty result still reports exit code (parity with VM formatter)",
        formatShellTextOutput({ stdout: "", stderr: "", exitCode: 0, timedOut: false }) === "exitCode: 0",
    );

    // Live engine parity: the same just-bash the client lazy-loads.
    const fs = new InMemoryFs();
    const bash = new Bash({ cwd: "/home/user", fs });
    const piped = await bash.exec("echo hello | tr a-z A-Z");
    check("live pipe exec", piped.stdout === "HELLO\n" && piped.exitCode === 0, JSON.stringify(piped).slice(0, 120));

    const missing = await bash.exec("gcc --version");
    check(
        "live 127 fallback signal",
        missing.exitCode === 127 && isCommandNotFound(missing.exitCode, missing.stderr),
        missing.stderr.slice(0, 80),
    );

    await bash.exec('echo "artifact-bytes" > /home/user/note.txt');
    const bytes = await fs.readFileBuffer("/home/user/note.txt");
    const text = new TextDecoder().decode(bytes);
    check("live file round-trip", text.trim() === "artifact-bytes", text.slice(0, 40));

    if (failures > 0) {
        console.error(`${failures} shell-text check(s) failed`);
        process.exit(1);
    }
    console.log("All shell-text checks passed.");
}

await main();
