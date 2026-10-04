import { describe, expect, it } from "vitest";
import { frontendToolsFromBody, sanitizeModelInstructions } from "~/lib/server/frontend-tools";
import { normalizeToolAccess, toolAccessAllows } from "~/lib/tool-access";

const definition = { description: "Render a card", parameters: { type: "object", properties: {} } };

describe("frontend tool boundaries", () => {
    it("keeps generative UI opt-in after migration", () => {
        expect(normalizeToolAccess(undefined).generativeUi).toBe(false);
        expect(toolAccessAllows(normalizeToolAccess(undefined), "present_openui")).toBe(false);
    });
    it("only forwards enabled OpenUI tools without executors", () => {
        expect(frontendToolsFromBody({ present_openui: definition }, new Set(), false)).toEqual({});
        const tools = frontendToolsFromBody({ present_openui: definition }, new Set(), true);
        expect(tools.present_openui).toBeDefined();
        expect(tools.present_openui.execute).toBeUndefined();
    });
    it("never shadows server tools", () => {
        expect(
            frontendToolsFromBody({ web_search: definition }, new Set(["web_search"]), true),
        ).toEqual({});
    });
    it("caps schemas and tool count", () => {
        const tools = Object.fromEntries(
            Array.from({ length: 30 }, (_, index) => [`card_${index}`, definition]),
        );
        expect(Object.keys(frontendToolsFromBody(tools, new Set(), true))).toHaveLength(16);
        expect(
            frontendToolsFromBody(
                { large: { parameters: { description: "x".repeat(40_000) } } },
                new Set(),
                true,
            ),
        ).toEqual({});
    });
    it("bounds supplemental instructions and removes controls", () => {
        expect(sanitizeModelInstructions(null)).toBe("");
        expect(sanitizeModelInstructions("a" + String.fromCharCode(0) + "b\n")).toBe("ab");
        expect(sanitizeModelInstructions("x".repeat(70_000))).toHaveLength(64_000);
    });
});
