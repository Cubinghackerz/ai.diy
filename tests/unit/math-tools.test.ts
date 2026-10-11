// @vitest-environment node
import { describe, expect, it } from "vitest";
import { analyzeMath, derivativeAt, findRoots, integrate, toFunction } from "~/lib/math-analysis";
import { buildGraph, niceTicks } from "~/lib/math-graph";
import { evaluateMathExpression, formatMathResult } from "~/lib/math-evaluator";
import { buildChatTools } from "~/lib/server/chat-tools";
import { formatActiveToolsReminder } from "~/lib/server/prompt";
import { toolAccessKeyForTool } from "~/lib/tool-access";

const near = (actual: number, expected: number, digits = 6) =>
    expect(actual).toBeCloseTo(expected, digits);

describe("calculator", () => {
    it("keeps the arithmetic it always had", () => {
        expect(evaluateMathExpression("sqrt(144) + 2^3")).toBe(20);
        expect(evaluateMathExpression("-2^2")).toBe(-4);
        expect(evaluateMathExpression("10 % 4")).toBe(2);
        expect(formatMathResult("1/0")).toBe("Result: Infinity");
        expect(formatMathResult("2 +")).toMatch(/^Error:/);
        expect(formatMathResult("nope(1)")).toMatch(/Unknown function/);
    });

    it("binds variables and understands how students write algebra", () => {
        expect(evaluateMathExpression("2*x^2 - 3", { x: 4 })).toBe(29);
        expect(evaluateMathExpression("2x + 1", { x: 5 })).toBe(11);
        expect(evaluateMathExpression("3(x+1)", { x: 2 })).toBe(9);
        expect(evaluateMathExpression("(x+1)(x-1)", { x: 5 })).toBe(24);
        near(evaluateMathExpression("2pi"), 2 * Math.PI);
        expect(() => evaluateMathExpression("y + 1", { x: 1 })).toThrow(/Unknown identifier/);
    });

    it("supports factorials, combinatorics, and degree trig", () => {
        expect(evaluateMathExpression("5!")).toBe(120);
        expect(evaluateMathExpression("fact(10)")).toBe(3628800);
        expect(evaluateMathExpression("ncr(5, 2)")).toBe(10);
        expect(evaluateMathExpression("npr(5, 2)")).toBe(20);
        expect(evaluateMathExpression("gcd(12, 18)")).toBe(6);
        expect(evaluateMathExpression("lcm(4, 6)")).toBe(12);
        near(evaluateMathExpression("sind(30)"), 0.5, 12);
        near(evaluateMathExpression("gamma(5)"), 24, 8);
        near(evaluateMathExpression("atan2(1, 1)"), Math.PI / 4, 12);
        expect(evaluateMathExpression("cbrt(-8)")).toBe(-2);
        expect(evaluateMathExpression("root(-27, 3)")).toBeCloseTo(-3, 12);
        expect(evaluateMathExpression("median(3, 1, 2, 10)")).toBe(2.5);
        near(evaluateMathExpression("stdev(2, 4, 4, 4, 5, 5, 7, 9)"), 2.138089935, 8);
        expect(() => evaluateMathExpression("fact(-1)")).toThrow(/Factorial/);
        expect(() => evaluateMathExpression("fact(171)")).toThrow(/limited/);
    });

    it("accepts pasted math symbols", () => {
        expect(evaluateMathExpression("6 × 7")).toBe(42);
        expect(evaluateMathExpression("9 ÷ 3 − 1")).toBe(2);
    });
});

describe("numeric calculus", () => {
    it("differentiates", () => {
        near(derivativeAt(toFunction("x^3"), 2), 12, 6);
        near(derivativeAt(toFunction("sin(x)"), 0), 1, 8);
        near(derivativeAt(toFunction("x^3"), 2, 2), 12, 4);
        expect(analyzeMath({ operation: "derivative", expression: "x^2", at: 3 })).toContain("≈ 6");
    });

    it("integrates, including a removable singularity", () => {
        near(integrate(toFunction("sin(x)"), 0, Math.PI), 2, 8);
        near(integrate(toFunction("x^2"), 0, 3), 9, 8);
        near(integrate(toFunction("sin(x)/x"), 0, Math.PI), 1.851937052, 6);
        near(integrate(toFunction("x"), 2, 0), -2, 8);
        expect(() =>
            analyzeMath({ operation: "integral", expression: "1/x", from: -1, to: 1 }),
        ).toThrow(/diverges|undefined/);
    });

    it("finds zeros, including ones a curve only touches", () => {
        const crossing = findRoots(toFunction("x^2 - 4"), -10, 10);
        expect(crossing).toHaveLength(2);
        near(crossing[0]!, -2, 8);
        near(crossing[1]!, 2, 8);
        const touching = findRoots(toFunction("(x-1)^2"), -5, 5);
        expect(touching).toHaveLength(1);
        near(touching[0]!, 1, 5);
        // 1/x changes sign at 0 but has no zero there.
        expect(findRoots(toFunction("1/x"), -1, 1)).toEqual([]);
        expect(analyzeMath({ operation: "roots", expression: "cos(x)", from: 0, to: 4 })).toContain(
            "1.570796",
        );
    });

    it("finds extrema and the range on an interval", () => {
        const text = analyzeMath({
            operation: "extrema",
            expression: "x^3 - 3*x",
            from: -3,
            to: 3,
        });
        expect(text).toContain("local max at x ≈ -1");
        expect(text).toContain("local min at x ≈ 1");
        expect(text).toContain("lowest value on the interval ≈ -18 at x ≈ -3");
    });

    it("takes limits, and says when they do not exist", () => {
        expect(analyzeMath({ operation: "limit", expression: "sin(x)/x", at: 0 })).toContain(
            ": 1 ",
        );
        expect(analyzeMath({ operation: "limit", expression: "(x^2-1)/(x-1)", at: 1 })).toContain(
            ": 2 ",
        );
        expect(analyzeMath({ operation: "limit", expression: "1/x", at: 0 })).toContain(
            "does not exist",
        );
        expect(analyzeMath({ operation: "limit", expression: "1/x^2", at: 0 })).toContain("∞");
    });

    it("sums series and tabulates values", () => {
        expect(analyzeMath({ operation: "sum", expression: "n", from: 1, to: 100 })).toContain(
            "= 5050",
        );
        expect(analyzeMath({ operation: "sum", expression: "1/n^2", from: 1, to: 1000 })).toContain(
            "1.64393",
        );
        const table = analyzeMath({
            operation: "table",
            expression: "x^2",
            from: 0,
            to: 4,
            step: 1,
        });
        expect(table).toContain("3 → 9");
        expect(table.split("\n")).toHaveLength(7);
    });

    it("binds extra constants and reports bad input plainly", () => {
        expect(
            analyzeMath({
                operation: "derivative",
                expression: "a*x^2",
                at: 2,
                constants: { a: 3 },
            }),
        ).toContain("≈ 12");
        expect(() => analyzeMath({ operation: "derivative", expression: "x^2" })).toThrow(
            /at is required/,
        );
        expect(() => analyzeMath({ operation: "roots", expression: "x +" })).toThrow();
        expect(() =>
            analyzeMath({ operation: "sum", expression: "n", from: 1, to: 5_000_000 }),
        ).toThrow(/limited/);
    });
});

describe("graphs", () => {
    it("draws an accessible, self-contained SVG with a useful summary", () => {
        const { svg, summary } = buildGraph({
            functions: [{ expression: "x^2 - 4" }],
            title: "A parabola",
        });
        expect(svg.startsWith("<svg")).toBe(true);
        expect(svg).toContain('role="img"');
        expect(svg).toContain("A parabola");
        expect(svg).toContain("<path");
        expect(svg).not.toMatch(/<script|href=|onload/i);
        expect(summary).toContain("y-intercept (0, -4)");
        expect(summary).toContain("x-intercepts -2, 2");
        expect(summary).toContain("local min at (0, -4)");
    });

    it("overlays several curves with a legend and marks points", () => {
        const { svg } = buildGraph({
            functions: [{ expression: "x" }, { expression: "x^2", label: "square" }],
            points: [{ x: 1, y: 1, label: "meet" }],
            xMin: -3,
            xMax: 3,
        });
        expect(svg).toContain("square");
        expect(svg).toContain("meet");
        expect((svg.match(/<path /g) ?? []).length).toBe(2);
    });

    it("lifts the pen at asymptotes instead of drawing across them", () => {
        const { svg } = buildGraph({
            functions: [{ expression: "tan(x)" }],
            xMin: -5,
            xMax: 5,
            yMin: -5,
            yMax: 5,
        });
        const d = /<path d="([^"]+)"/.exec(svg)![1]!;
        expect((d.match(/M/g) ?? []).length).toBeGreaterThan(2);
        const hyperbola = buildGraph({ functions: [{ expression: "1/x" }], xMin: -5, xMax: 5 });
        expect((/<path d="([^"]+)"/.exec(hyperbola.svg)![1]!.match(/M/g) ?? []).length).toBe(2);
    });

    it("escapes labels and rejects bad input", () => {
        const { svg } = buildGraph({
            functions: [{ expression: "x", label: "<img onerror=1> & more" }, { expression: "2x" }],
        });
        expect(svg).not.toContain("<img");
        expect(svg).toContain("&lt;img");
        expect(() => buildGraph({ functions: [] })).toThrow(/at least one/);
        expect(() => buildGraph({ functions: [{ expression: "x" }], xMin: 5, xMax: 1 })).toThrow(
            /greater/,
        );
        expect(() => buildGraph({ functions: [{ expression: "x +" }] })).toThrow();
        expect(() => buildGraph({ functions: [{ expression: "wat(x)" }] })).toThrow(/Unknown/);
    });

    it("picks readable axis ticks", () => {
        expect(niceTicks(-10, 10, 5)).toEqual([-10, -5, 0, 5, 10]);
        expect(niceTicks(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    });
});

describe("math tools in the chat", () => {
    const build = (calculator: boolean) =>
        buildChatTools(
            { calculatorEnabled: calculator, toolAccess: { calculator } },
            { provider: "openai", messages: [] },
        );

    it("registers the calculator, analysis, and graph tools together under the calculator gate", async () => {
        const on = await build(true);
        expect(Object.keys(on)).toEqual(
            expect.arrayContaining(["calculator", "math_analyze", "graph_function"]),
        );
        const off = await build(false);
        expect(off.calculator).toBeUndefined();
        expect(off.math_analyze).toBeUndefined();
        expect(off.graph_function).toBeUndefined();
        expect(toolAccessKeyForTool("graph_function")).toBe("calculator");
        expect(toolAccessKeyForTool("math_analyze")).toBe("calculator");
    });

    it("graph_function hands the model a small spec and summary, not a picture", async () => {
        const tools = await build(true);
        const run = (
            tools.graph_function as unknown as { execute: (input: unknown) => Promise<string> }
        ).execute;
        const raw = await run({ functions: [{ expression: "x^2" }], title: "Parabola" });
        const out = JSON.parse(raw);
        expect(out.__aidiy_graph).toBe(true);
        expect(out.title).toBe("Parabola");
        expect(out.input.functions[0].expression).toBe("x^2");
        expect(out.summary).toContain("local min");
        expect(raw).not.toContain("<svg");
        expect(raw.length).toBeLessThan(800);
        expect(await run({ functions: [{ expression: "x +" }] })).toMatch(/^Error:/);
    });

    it("math_analyze never throws into the model loop", async () => {
        const tools = await build(true);
        const run = (
            tools.math_analyze as unknown as { execute: (input: unknown) => Promise<string> }
        ).execute;
        expect(await run({ operation: "integral", expression: "x^2", from: 0, to: 3 })).toContain(
            "≈ 9",
        );
        expect(await run({ operation: "derivative", expression: "x^2" })).toMatch(/^Error:/);
    });

    it("tells the model how to use them, only when they are active", () => {
        expect(
            formatActiveToolsReminder(["calculator", "graph_function", "math_analyze"]),
        ).toContain("sympy");
        expect(formatActiveToolsReminder(["calculator"])).not.toContain("sympy");
    });
});
