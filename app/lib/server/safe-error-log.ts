export type DiagnosticArea =
    "chat" | "chat-stream" | "chat-image" | "chat-video" | "chat-audio" | "document-render";

export function reportSafeServerError(area: DiagnosticArea, error: unknown): void {
    let kind = "Error";
    let statusCode: number | undefined;
    // Allowlist metadata instead of attempting to scrub arbitrary payloads.
    // SDK errors can hold full prompts, response bodies, URLs and credentials.
    try {
        if (error !== null && typeof error === "object") {
            const record = error as { name?: unknown; statusCode?: unknown };
            if (
                typeof record.name === "string" &&
                [
                    "Error",
                    "TypeError",
                    "RangeError",
                    "AbortError",
                    "TimeoutError",
                    "AI_APICallError",
                    "AI_RetryError",
                ].includes(record.name)
            )
                kind = record.name;
            if (
                typeof record.statusCode === "number" &&
                Number.isInteger(record.statusCode) &&
                record.statusCode >= 400 &&
                record.statusCode <= 599
            )
                statusCode = record.statusCode;
        }
    } catch {
        kind = "Error";
        statusCode = undefined;
    }
    console.error(`[ai.diy:${area}]`, {
        kind,
        ...(statusCode === undefined ? {} : { statusCode }),
    });
}
