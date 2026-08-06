import { TOOL_EXECUTORS } from "~/lib/tools";
import { webSearch } from "~/lib/search";
import { connectorSearch } from "~/lib/search/connectors";
import type { ConnectorConfig } from "~/lib/types";

export async function askUserInBrowser(input: {
    question: string;
    questionType?: "single" | "multiple" | "short";
    options?: string[];
}): Promise<string> {
    if (typeof window === "undefined") return "The user interface is unavailable.";
    const options = input.options ?? [];
    const prompt = options.length
        ? `${input.question}\n\n${options.map((option, index) => `${index + 1}. ${option}`).join("\n")}\n\n${input.questionType === "multiple" ? "Enter comma-separated option numbers:" : "Enter an option number:"}`
        : input.question;
    return window.prompt(prompt) ?? "The user skipped this question.";
}

export const runCalculatorInBrowser = TOOL_EXECUTORS.calculator.execute;
export const runFetchUrlInBrowser = TOOL_EXECUTORS.fetch_url.execute;

export async function runWebSearchInBrowser(
    query: string,
    maxResults = 5,
    connectors: ConnectorConfig[] = [],
    engine: "duckduckgo" | "searxng" = "duckduckgo",
    searxngUrl?: string,
): Promise<string> {
    try {
        const active = connectors.find(
            (connector) =>
                connector.enabled &&
                Boolean(connector.apiKey?.trim()) &&
                ["tavily", "brave", "exa", "parallel"].includes(connector.kind),
        );
        let results;
        if (active) {
            results = await connectorSearch(active, query, maxResults);
        } else {
            results = await webSearch(query, { maxResults, engine, searxngUrl });
        }
        if (results.length === 0) return "No results found.";
        return results
            .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`)
            .join("\n\n");
    } catch (err) {
        return `Search error: ${err instanceof Error ? err.message : String(err)}`;
    }
}
