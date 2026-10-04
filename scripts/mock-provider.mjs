import { createServer } from "node:http";

const model = "gpt-4o-mini";
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
