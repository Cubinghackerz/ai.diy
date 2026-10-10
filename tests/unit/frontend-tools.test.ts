import { describe, expect, it } from "vitest";
import { frontendToolsFromBody, sanitizeModelInstructions } from "~/lib/server/frontend-tools";
import { normalizeToolAccess, toolAccessAllows } from "~/lib/tool-access";

const definition = { description: "Render a card", parameters: { type: "object", properties: {} } };

describe("frontend tool boundaries", () => {
    it("enables generative UI by default but honors a stored opt-out", () => {
        expect(normalizeToolAccess(undefined).generativeUi).toBe(true);
        expect(toolAccessAllows(normalizeToolAccess(undefined), "present_openui")).toBe(true);
        const optedOut = normalizeToolAccess({ generativeUi: false });
        expect(optedOut.generativeUi).toBe(false);
        expect(toolAccessAllows(optedOut, "present_openui")).toBe(false);
    });
    it("keeps external media on by default and persists an opt-out", () => {
        expect(normalizeToolAccess(undefined).externalMedia).toBe(true);
        expect(normalizeToolAccess({ externalMedia: false }).externalMedia).toBe(false);
    });
    it("only forwards enabled OpenUI tools without executors", () => {
        expect(frontendToolsFromBody({ present_openui: definition }, new Set(), false)).toEqual({});
        const tools = frontendToolsFromBody({ present_openui: definition }, new Set(), true);
        expect(tools.present_openui).toBeDefined();
        expect(tools.present_openui.execute).toBeUndefined();
    });
    it("gates the json-render tool with the same Generative UI switch", () => {
        const tools = { present_jsonrender: definition };
        expect(frontendToolsFromBody(tools, new Set(), false)).toEqual({});
        expect(frontendToolsFromBody(tools, new Set(), true).present_jsonrender).toBeDefined();
        expect(
            toolAccessAllows(normalizeToolAccess({ generativeUi: false }), "present_jsonrender"),
        ).toBe(false);
        expect(toolAccessAllows(normalizeToolAccess(undefined), "present_jsonrender")).toBe(true);
    });
    it("gates the skill tools with the Skills switch and keeps them executor-free", () => {
        const tools = {
            find_skill: definition,
            use_skill: definition,
            save_skill: definition,
        };
        expect(frontendToolsFromBody(tools, new Set(), true, false)).toEqual({});
        const allowed = frontendToolsFromBody(tools, new Set(), false, true);
        expect(Object.keys(allowed).sort()).toEqual(["find_skill", "save_skill", "use_skill"]);
        expect(allowed.save_skill.execute).toBeUndefined();
        // Existing callers that do not pass the argument keep the tools.
        expect(frontendToolsFromBody(tools, new Set(), false).use_skill).toBeDefined();
        expect(toolAccessAllows(normalizeToolAccess({ skills: false }), "save_skill")).toBe(false);
        expect(toolAccessAllows(normalizeToolAccess(undefined), "use_skill")).toBe(true);
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
        expect(sanitizeModelInstructions("x".repeat(80_000))).toHaveLength(70_000);
    });
});
