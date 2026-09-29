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
const errors = await vite.ssrLoadModule(path.join(root, "app/lib/chatgpt-errors.ts"));
const {
    chatGPTErrorCode,
    describeChatGPTError,
    formatCountdown,
    formatPlan,
    secondsUntil,
    splitDeviceCode,
} = errors;

let failures = 0;

function check(name, condition, detail = "") {
    if (condition) console.log(`ok - ${name}`);
    else {
        failures += 1;
        console.error(`FAIL - ${name}${detail ? `: ${detail}` : ""}`);
    }
}

const disabled = describeChatGPTError("device_code_disabled");
check("device_code_disabled -> 502", disabled.status === 502, String(disabled.status));
check("device_code_disabled not retryable", disabled.retryable === false);
check(
    "device_code_disabled names the fix",
    /device code/i.test(disabled.message),
    disabled.message,
);

const network = describeChatGPTError("network_error");
check("network_error -> 503", network.status === 503, String(network.status));
check("network_error retryable", network.retryable === true);

check(
    "unknown code falls back to 500",
    describeChatGPTError("nope").status === 500 &&
        describeChatGPTError(undefined).status === 500,
);

const sdkError = Object.assign(new Error("x"), {
    name: "ChatGPTAuthError",
    code: "network_error",
});
check("chatGPTErrorCode reads sdk error", chatGPTErrorCode(sdkError) === "network_error");
check("chatGPTErrorCode ignores plain Error", chatGPTErrorCode(new Error("x")) === undefined);
check("chatGPTErrorCode ignores non-Error", chatGPTErrorCode("x") === undefined);

check(
    "splitDeviceCode splits on dash",
    JSON.stringify(splitDeviceCode("ABCD-EFGH")) === JSON.stringify(["ABCD", "EFGH"]),
);
check(
    "splitDeviceCode keeps one group",
    JSON.stringify(splitDeviceCode("ABCD")) === JSON.stringify(["ABCD"]),
);
check(
    "splitDeviceCode handles undefined",
    splitDeviceCode(undefined).length === 0,
);

check("countdown formats minutes", formatCountdown(605) === "10:05", formatCountdown(605));
check("countdown pads seconds", formatCountdown(9) === "0:09", formatCountdown(9));
check("secondsUntil ceils", secondsUntil(1000, 400) === 1, String(secondsUntil(1000, 400)));
check("secondsUntil floors at 0", secondsUntil(1000, 5000) === 0);
check("secondsUntil handles missing", secondsUntil(undefined, 0) === 0);

check("formatPlan capitalizes", formatPlan("plus") === "Plus", formatPlan("plus") ?? "");
check("formatPlan empty -> null", formatPlan("") === null);
check("formatPlan missing -> null", formatPlan(undefined) === null);

await vite.close();
if (failures > 0) {
    console.error(`${failures} chatgpt-session check(s) failed`);
    process.exit(1);
}
console.log("All ChatGPT session checks passed.");
