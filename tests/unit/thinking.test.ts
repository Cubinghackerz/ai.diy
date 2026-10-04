import { describe, expect, it } from "vitest";
import { extractThinkingHeadline } from "~/components/assistant-ui/thinking-state";

describe("streamed progress headings", () => {
    it.each([
        ["", null],
        ["Plain text\n", null],
        ["**Comparing options**\n", "Comparing options"],
        ["__Reviewing evidence__\n", "Reviewing evidence"],
        ["## Planning\n", "Planning"],
        ["## Planning\n**Checking sources**\n", "Checking sources"],
        ["## Planning\n**Checking sour", "Planning"],
        ["**Incomplete heading**", null],
    ])("extracts only the latest completed heading in %j", (input, expected) => {
        expect(extractThinkingHeadline(input as string)).toBe(expected);
    });
});
