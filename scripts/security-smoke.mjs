import { formatMathResult } from "../app/lib/math-evaluator.ts";
import {
    assertPublicHttpUrl,
    assertPublicHttpUrlResolved,
    fetchPublicHttpUrl,
} from "../app/lib/server/ssrf.ts";

let failures = 0;

function check(name, condition, detail = "") {
    if (condition) console.log(`ok - ${name}`);
    else {
        failures += 1;
        console.error(`FAIL - ${name}${detail ? `: ${detail}` : ""}`);
    }
}

async function main() {
    check("calculator preserves arithmetic", formatMathResult("2 + 2") === "Result: 4");
    check(
        "calculator preserves functions and exponentiation",
        formatMathResult("sqrt(144) + 2^3") === "Result: 20",
    );
    for (const payload of [
        "JSON.stringify(process.env)",
        "Function(\"return process\")()",
        "process.exit()",
        "constructor.constructor(\"return process\")()",
        "__proto__",
    ]) {
        const result = formatMathResult(payload);
        check(`calculator rejects code payload: ${payload}`, result.startsWith("Error:"));
    }

    for (const url of [
        "http://127.1",
        "http://2130706433",
        "http://0177.0.0.1",
        "http://localhost.",
        "http://[::1]",
        "http://[::ffff:127.0.0.1]",
        "http://[fc00::1]",
    ]) {
        let blocked = false;
        try {
            assertPublicHttpUrl(url);
        } catch {
            blocked = true;
        }
        check(`SSRF guard blocks ${url}`, blocked);
    }

    let publicUrlAccepted = true;
    try {
        assertPublicHttpUrl("https://example.com");
    } catch {
        publicUrlAccepted = false;
    }
    check("SSRF guard accepts a public HTTPS URL", publicUrlAccepted);

    let asyncPrivateBlocked = false;
    try {
        await assertPublicHttpUrlResolved("http://localhost.");
    } catch {
        asyncPrivateBlocked = true;
    }
    check("async SSRF guard blocks private hosts", asyncPrivateBlocked);

    let redirectPrivateBlocked = false;
    try {
        await fetchPublicHttpUrl("http://127.0.0.1");
    } catch {
        redirectPrivateBlocked = true;
    }
    check("public fetch validates its first hop", redirectPrivateBlocked);

    console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
    process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
