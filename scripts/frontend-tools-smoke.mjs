import {
    frontendToolsFromBody,
    sanitizeModelInstructions,
} from "../app/lib/server/frontend-tools.ts";

let failures = 0;
function check(name, condition, detail = "") {
    if (condition) console.log(`ok - ${name}`);
    else {
        failures++;
        console.error(`FAIL - ${name} ${detail}`);
    }
}

const openuiTool = {
    description: "Render an OpenUI Lang program",
    parameters: { type: "object", properties: { program: { type: "string" } } },
};
const genericTool = {
    description: "A normal frontend tool",
    parameters: { type: "object", properties: {} },
};

const accepted = frontendToolsFromBody(
    { present_openui: openuiTool, prompt_openui: openuiTool, my_card: genericTool },
    new Set(),
    true,
);
check(
    "openui tools accepted when enabled",
    "present_openui" in accepted && "prompt_openui" in accepted && "my_card" in accepted,
);
check(
    "forwarded tools never carry executors",
    Object.values(accepted).every((t) => t.execute === undefined),
);

const gated = frontendToolsFromBody(
    { present_openui: openuiTool, prompt_openui: openuiTool, my_card: genericTool },
    new Set(),
    false,
);
check(
    "openui tools stripped when disabled",
    !("present_openui" in gated) && !("prompt_openui" in gated),
);
check("non-openui tools still pass when disabled", "my_card" in gated);

const shadowed = frontendToolsFromBody(
    { web_search: genericTool, my_card: genericTool },
    new Set(["web_search"]),
    true,
);
check("server-tool collision dropped", !("web_search" in shadowed));
check("non-colliding tools survive", "my_card" in shadowed);

const malformed = frontendToolsFromBody(
    {
        "1bad-name": genericTool,
        missing_params: { description: "no schema" },
        null_def: null,
        str_def: "not an object",
        good_tool: genericTool,
    },
    new Set(),
    true,
);
check(
    "malformed entries dropped",
    Object.keys(malformed).length === 1 && "good_tool" in malformed,
);

const oversized = frontendToolsFromBody(
    { big_schema: { parameters: { type: "object", pad: "x".repeat(40_000) } } },
    new Set(),
    true,
);
check("oversized schema dropped", Object.keys(oversized).length === 0);

const longDesc = frontendToolsFromBody(
    { t: { description: "y".repeat(5_000), parameters: { type: "object" } } },
    new Set(),
    true,
);
check(
    "description capped",
    longDesc.t?.description?.length === 2_000,
    String(longDesc.t?.description?.length),
);

const capped = frontendToolsFromBody(
    Object.fromEntries(
        Array.from({ length: 40 }, (_, i) => [`tool_${i}`, genericTool]),
    ),
    new Set(),
    true,
);
check("tool count capped at 16", Object.keys(capped).length === 16);

check("non-string instructions empty", sanitizeModelInstructions(42) === "");
check(
    "instructions capped at 64k",
    sanitizeModelInstructions("z".repeat(70_000)).length === 64_000,
);
check(
    "instructions trimmed",
    sanitizeModelInstructions("  hi  ") === "hi",
);
check(
    "control chars stripped",
    sanitizeModelInstructions(`a${String.fromCharCode(1)}b${String.fromCharCode(0)}c`) === "abc",
);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
