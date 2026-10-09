import { createServer } from "node:http";

const model = "gpt-4o-mini";

// Canned OpenUI Lang programs streamed as a present_openui tool call.
const RICH_PROGRAM = [
    'root = Card([head, gallery, timeline, map, more, FollowUpBlock(["Make it cheaper"])])',
    'head = RichHeading("Mock plan", "Rendered from a tool call")',
    'a = RichItem("a", "Colosseum", "09:00", "Book ahead.", "landmark", "Landmark", 41.8902, 12.4922, "Colosseum")',
    'b = RichItem("b", "Roman Forum", "11:30", "Next door.", "museum", "Landmark", 41.8925, 12.4853, "Roman Forum")',
    'gallery = RichGallery([a, b], "Photos")',
    'timeline = RichTimeline([a, b], "The day")',
    'map = RichMap([a, b], "Route", true)',
    'c = RichItem("c", "Borghese Gallery", null, "Reserve a slot.", "art")',
    'more = RichSuggestions([c], "More ideas")',
].join("\n");

// A json-render spec, passed to present_jsonrender as a JSON string.
const JSON_SPEC = JSON.stringify({
    root: "main",
    elements: {
        main: { type: "Stack", props: {}, children: ["h", "m1", "m2", "bars", "tbl", "ask"] },
        h: { type: "Heading", props: { text: "Mock dashboard" }, children: [] },
        m1: {
            type: "Metric",
            props: { label: "Revenue", value: "$48k", change: "+8%", trend: "up" },
            children: [],
        },
        m2: {
            type: "Metric",
            props: { label: "Churn", value: "1.8%", change: "-0.3%", trend: "down" },
            children: [],
        },
        bars: {
            type: "BarChart",
            props: { title: "Signups", labels: ["Mon", "Tue", "Wed"], values: [4, 9, 6] },
            children: [],
        },
        tbl: {
            type: "Table",
            props: {
                columns: ["Plan", "Users"],
                rows: [
                    ["Free", "120"],
                    ["Pro", "34"],
                ],
            },
            children: [],
        },
        ask: {
            type: "Button",
            props: { label: "Show by region" },
            children: [],
            on: { press: { action: "ask", params: { message: "mock-slow Show by region" } } },
        },
    },
});

// One unsafe and one safe link button, to prove only http(s) targets open.
const RICH_LINKS_PROGRAM = [
    "root = Card([Buttons([unsafe, safe])])",
    'unsafe = Button("Open unsafe", Action([@OpenUrl("javascript:window.__pwned=1")]), "secondary")',
    'safe = Button("Open safe", Action([@OpenUrl("https://example.com/ok")]), "primary")',
].join("\n");
const server = createServer(async (request, response) => {
    if (request.url === "/health") {
        response.end("ok");
        return;
    }
    if (request.url === "/v1/models") {
        response.setHeader("Content-Type", "application/json");
        response.end(
            JSON.stringify({
                object: "list",
                data: [{ id: model, object: "model", created: 0, owned_by: "mock" }],
            }),
        );
        return;
    }
    if (request.method !== "POST" || request.url !== "/v1/chat/completions") {
        response.writeHead(404).end();
        return;
    }
    let raw = "";
    for await (const chunk of request) {
        raw += chunk;
        if (raw.length > 1_000_000) {
            response.writeHead(413).end();
            return;
        }
    }
    let body;
    try {
        body = JSON.parse(raw);
    } catch {
        response.writeHead(400).end();
        return;
    }
    if (body.stream !== true) {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(
            JSON.stringify({
                id: "mock-title",
                object: "chat.completion",
                created: 0,
                model,
                choices: [
                    {
                        index: 0,
                        message: { role: "assistant", content: "Regression test chat" },
                        finish_reason: "stop",
                    },
                ],
                usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 },
            }),
        );
        return;
    }
    const prompt = body.messages?.findLast((message) => message.role === "user")?.content ?? "";
    if (JSON.stringify(prompt).includes("mock-error")) {
        response.writeHead(429, { "Content-Type": "application/json" });
        response.end(
            JSON.stringify({
                error: { message: "Mock provider rate limit", type: "rate_limit_error" },
            }),
        );
        return;
    }
    response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
    const id = `mock-${Date.now()}`;
    const send = (delta, finish_reason = null) => {
        response.write(
            `data: ${JSON.stringify({ id, object: "chat.completion.chunk", created: 0, model, choices: [{ index: 0, delta, finish_reason }] })}\n\n`,
        );
    };
    send({ role: "assistant", content: "" });
    const promptText = JSON.stringify(prompt);
    const richCall = promptText.includes("mock-rich-links")
        ? { name: "present_openui", args: { ui: RICH_LINKS_PROGRAM } }
        : promptText.includes("mock-rich")
          ? { name: "present_openui", args: { ui: RICH_PROGRAM } }
          : promptText.includes("mock-json")
            ? { name: "present_jsonrender", args: { spec: JSON_SPEC } }
            : null;
    const offeredTools = new Set((body.tools ?? []).map((tool) => tool.function?.name));
    // A tool result already follows the call: end the turn with text, never loop.
    const continuation = body.messages?.at(-1)?.role === "tool";
    if (richCall && offeredTools.has(richCall.name) && !continuation) {
        send({
            tool_calls: [
                {
                    index: 0,
                    id: `call_mock_${id}`,
                    type: "function",
                    function: { name: richCall.name, arguments: "" },
                },
            ],
        });
        const args = JSON.stringify(richCall.args);
        for (const part of args.match(/[\s\S]{1,48}/g)) {
            if (response.destroyed) return;
            send({ tool_calls: [{ index: 0, function: { arguments: part } }] });
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
        send({}, "tool_calls");
        response.write(
            `data: ${JSON.stringify({ id, object: "chat.completion.chunk", created: 0, model, choices: [], usage: { prompt_tokens: 12, completion_tokens: 10, total_tokens: 22 } })}\n\n`,
        );
        response.end("data: [DONE]\n\n");
        return;
    }
    if (promptText.includes("mock-drop")) {
        send({ content: "Mo" });
        send({ content: "ck" });
        response.destroy();
        return;
    }
    if (promptText.includes("mock-slow")) {
        const tokens = "Mock reply: still streaming this slow response.".slice(0, 40).split("");
        for (const content of tokens) {
            if (response.destroyed) return;
            send({ content });
            await new Promise((resolve) => setTimeout(resolve, 150));
        }
        if (response.destroyed) return;
        send({}, "stop");
        response.write(
            `data: ${JSON.stringify({ id, object: "chat.completion.chunk", created: 0, model, choices: [], usage: { prompt_tokens: 12, completion_tokens: 10, total_tokens: 22 } })}\n\n`,
        );
        response.end("data: [DONE]\n\n");
        return;
    }
    const hostile = promptText.includes("hostile-html");
    const text = hostile
        ? [
              "Hostile reply delivered.",
              "",
              "<script>globalThis.__pwned = 1</script>",
              "",
              '<img src="http://127.0.0.1:18765/pixel?leak=conversation" alt="leak">',
              "",
              '<iframe src="http://127.0.0.1:18765/frame"></iframe>',
              "",
              "Math still works: $a^2$ and $$\\int x\\,dx$$",
          ].join("\n")
        : "Mock reply: your message arrived and streamed successfully.";
    for (const content of text.match(/.{1,8}/g)) {
        if (response.destroyed) return;
        send({ content });
        await new Promise((resolve) => setTimeout(resolve, 40));
    }
    send({}, "stop");
    response.write(
        `data: ${JSON.stringify({ id, object: "chat.completion.chunk", created: 0, model, choices: [], usage: { prompt_tokens: 12, completion_tokens: 10, total_tokens: 22 } })}\n\n`,
    );
    response.end("data: [DONE]\n\n");
});
server.listen(18765, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close());
