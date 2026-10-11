import { findExtrema, findRoots, fmt, toFunction, type MathFn } from "~/lib/math-analysis";

/**
 * Function graphs as a self-contained SVG: no Python, no network, instant.
 * y = f(x) curves (up to six), optional marked points, nice axis ticks, a
 * legend, and breaks at asymptotes instead of lines shooting across the plot.
 */

export type GraphInput = {
    /** Curves y = f(x). Use "x" as the variable. */
    functions: Array<{ expression: string; label?: string }>;
    xMin?: number;
    xMax?: number;
    yMin?: number;
    yMax?: number;
    title?: string;
    /** Points to mark, e.g. intersections or the answer to a problem. */
    points?: Array<{ x: number; y: number; label?: string }>;
};

export type GraphResult = {
    svg: string;
    /** Plain-text facts the model can quote without re-reading the picture. */
    summary: string;
};

/** Marks a graph_function result: the spec to draw plus a text summary for the model. */
export const GRAPH_MARKER = "__aidiy_graph";

export type GraphToolResult = {
    [GRAPH_MARKER]: true;
    title: string;
    input: GraphInput;
    summary: string;
};

const WIDTH = 640;
const HEIGHT = 420;
const MARGIN = { top: 34, right: 20, bottom: 36, left: 52 };
const SAMPLES = 480;
const MAX_FUNCTIONS = 6;
// Okabe–Ito-style colors: distinguishable for color-blind readers and on white.
const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#0891b2"];

function escapeXml(text: string): string {
    return text.replace(/[<>&"']/g, (char) =>
        char === "<"
            ? "&lt;"
            : char === ">"
              ? "&gt;"
              : char === "&"
                ? "&amp;"
                : char === '"'
                  ? "&quot;"
                  : "&#39;",
    );
}

/** Tick positions at 1, 2, 2.5 or 5 × 10ⁿ that give roughly `target` ticks. */
export function niceTicks(min: number, max: number, target = 8): number[] {
    const span = max - min;
    if (!(span > 0)) return [min];
    const rough = span / target;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
    const step =
        [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= rough) ??
        10 * magnitude;
    const ticks: number[] = [];
    for (let tick = Math.ceil(min / step) * step; tick <= max + step * 1e-9; tick += step) {
        ticks.push(Number(tick.toPrecision(12)));
    }
    return ticks;
}

function autoYRange(values: number[]): [number, number] {
    const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (finite.length < 2) return [-1, 1];
    // Ignore asymptote blow-ups: size the window from the middle 96% of values.
    const lo = finite[Math.floor(finite.length * 0.02)]!;
    const hi = finite[Math.ceil(finite.length * 0.98) - 1]!;
    if (lo === hi) return [lo - 1, hi + 1];
    const pad = (hi - lo) * 0.1;
    return [lo - pad, hi + pad];
}

function buildPath(
    f: MathFn,
    xMin: number,
    xMax: number,
    yMin: number,
    yMax: number,
    toX: (x: number) => number,
    toY: (y: number) => number,
): string {
    const yRange = yMax - yMin;
    const segments: string[] = [];
    let current: string[] = [];
    let previous: number | null = null;
    const flush = () => {
        if (current.length > 1) segments.push(`M${current.join("L")}`);
        current = [];
    };
    for (let index = 0; index <= SAMPLES; index += 1) {
        const x = xMin + ((xMax - xMin) * index) / SAMPLES;
        const y = f(x);
        const visible = Number.isFinite(y) && y >= yMin - yRange && y <= yMax + yRange;
        if (!visible) {
            flush();
            previous = null;
            continue;
        }
        // A jump of more than the whole window between neighbours is a pole (tan, 1/x): lift the pen.
        if (previous !== null && Math.abs(y - previous) > yRange) flush();
        previous = y;
        current.push(`${toX(x).toFixed(1)},${toY(y).toFixed(1)}`);
    }
    flush();
    return segments.join("");
}

function describeFunction(f: MathFn, expression: string, xMin: number, xMax: number): string {
    const parts: string[] = [];
    const atZero = f(0);
    if (xMin <= 0 && xMax >= 0 && Number.isFinite(atZero)) {
        parts.push(`y-intercept (0, ${fmt(atZero, 6)})`);
    }
    const roots = findRoots(f, xMin, xMax);
    if (roots.length) {
        parts.push(
            `x-intercepts ${roots
                .slice(0, 6)
                .map((root) => fmt(root, 6))
                .join(", ")}${roots.length > 6 ? ", …" : ""}`,
        );
    }
    const extrema = findExtrema(f, xMin, xMax).slice(0, 4);
    for (const e of extrema) parts.push(`local ${e.kind} at (${fmt(e.x, 6)}, ${fmt(e.y, 6)})`);
    return `y = ${expression.trim()}: ${parts.length ? parts.join("; ") : "no intercepts or turning points in view"}`;
}

export function buildGraph(input: GraphInput, options: { summary?: boolean } = {}): GraphResult {
    const curves = input.functions.slice(0, MAX_FUNCTIONS);
    if (!curves.length) throw new Error("Give at least one function to graph");
    const xMin = input.xMin ?? -10;
    const xMax = input.xMax ?? 10;
    if (!(xMax > xMin)) throw new Error("xMax must be greater than xMin");

    const compiled = curves.map((curve) => ({
        ...curve,
        f: toFunction(curve.expression, "x"),
    }));

    let yMin = input.yMin;
    let yMax = input.yMax;
    if (yMin === undefined || yMax === undefined) {
        const values: number[] = [];
        for (const { f } of compiled) {
            for (let index = 0; index <= 200; index += 1) {
                values.push(f(xMin + ((xMax - xMin) * index) / 200));
            }
        }
        for (const point of input.points ?? []) values.push(point.y);
        const [autoMin, autoMax] = autoYRange(values);
        yMin ??= autoMin;
        yMax ??= autoMax;
    }
    if (!(yMax > yMin)) throw new Error("yMax must be greater than yMin");

    const plotW = WIDTH - MARGIN.left - MARGIN.right;
    const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
    const toX = (x: number) => MARGIN.left + ((x - xMin) / (xMax - xMin)) * plotW;
    const toY = (y: number) => MARGIN.top + (1 - (y - yMin!) / (yMax! - yMin!)) * plotH;

    const xTicks = niceTicks(xMin, xMax, 10);
    const yTicks = niceTicks(yMin, yMax, 8);
    const axisX = yMin <= 0 && yMax >= 0 ? toY(0) : toY(yMin);
    const axisY = xMin <= 0 && xMax >= 0 ? toX(0) : toX(xMin);

    const grid = [
        ...xTicks.map(
            (tick) =>
                `<line x1="${toX(tick).toFixed(1)}" y1="${MARGIN.top}" x2="${toX(tick).toFixed(1)}" y2="${MARGIN.top + plotH}" stroke="#e5e7eb"/>`,
        ),
        ...yTicks.map(
            (tick) =>
                `<line x1="${MARGIN.left}" y1="${toY(tick).toFixed(1)}" x2="${MARGIN.left + plotW}" y2="${toY(tick).toFixed(1)}" stroke="#e5e7eb"/>`,
        ),
    ].join("");

    const tickLabels = [
        ...xTicks
            .filter((tick) => Math.abs(tick) > 1e-12 || axisY !== toX(0))
            .map(
                (tick) =>
                    `<text x="${toX(tick).toFixed(1)}" y="${MARGIN.top + plotH + 16}" text-anchor="middle">${escapeXml(fmt(tick))}</text>`,
            ),
        ...yTicks.map(
            (tick) =>
                `<text x="${MARGIN.left - 8}" y="${(toY(tick) + 4).toFixed(1)}" text-anchor="end">${escapeXml(fmt(tick))}</text>`,
        ),
    ].join("");

    const paths = compiled
        .map(({ f }, index) => {
            const d = buildPath(f, xMin, xMax, yMin!, yMax!, toX, toY);
            return d
                ? `<path d="${d}" fill="none" stroke="${COLORS[index % COLORS.length]}" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round"/>`
                : "";
        })
        .join("");

    const marks = (input.points ?? [])
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
        .slice(0, 20)
        .map((p) => {
            const label = p.label ? escapeXml(p.label) : `(${fmt(p.x)}, ${fmt(p.y)})`;
            return `<circle cx="${toX(p.x).toFixed(1)}" cy="${toY(p.y).toFixed(1)}" r="4" fill="#111827" stroke="#fff" stroke-width="1.5"/><text x="${(toX(p.x) + 7).toFixed(1)}" y="${(toY(p.y) - 7).toFixed(1)}" font-weight="600">${label}</text>`;
        })
        .join("");

    const legendLabels = compiled.map(
        (curve) => curve.label?.trim() || `y = ${curve.expression.trim()}`,
    );
    const showLegend = compiled.length > 1 || compiled.some((c) => c.label);
    // A white panel keeps the labels readable where a curve passes underneath.
    const legendWidth = Math.min(
        plotW - 12,
        46 + Math.max(...legendLabels.map((l) => l.length)) * 6.4,
    );
    const legend = showLegend
        ? `<rect x="${MARGIN.left + 4}" y="${MARGIN.top + 4}" width="${legendWidth.toFixed(0)}" height="${legendLabels.length * 16 + 8}" rx="6" fill="#ffffff" fill-opacity="0.9" stroke="#e5e7eb"/>` +
          legendLabels
              .map((text, index) => {
                  const y = MARGIN.top + 20 + index * 16;
                  return `<line x1="${MARGIN.left + 12}" y1="${y - 4}" x2="${MARGIN.left + 30}" y2="${y - 4}" stroke="${COLORS[index % COLORS.length]}" stroke-width="2.5"/><text x="${MARGIN.left + 36}" y="${y}">${escapeXml(text)}</text>`;
              })
              .join("")
        : "";

    const title = input.title?.trim()
        ? `<text x="${WIDTH / 2}" y="20" text-anchor="middle" font-size="14" font-weight="600">${escapeXml(input.title.trim())}</text>`
        : "";

    const description = escapeXml(
        `Graph of ${compiled.map((c) => `y = ${c.expression.trim()}`).join(", ")} for x from ${fmt(xMin)} to ${fmt(xMax)}`,
    );

    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="100%" role="img" aria-label="${description}" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="11" fill="#374151">` +
        `<rect width="${WIDTH}" height="${HEIGHT}" fill="#ffffff"/>` +
        title +
        grid +
        `<line x1="${MARGIN.left}" y1="${axisX.toFixed(1)}" x2="${MARGIN.left + plotW}" y2="${axisX.toFixed(1)}" stroke="#111827" stroke-width="1.25"/>` +
        `<line x1="${axisY.toFixed(1)}" y1="${MARGIN.top}" x2="${axisY.toFixed(1)}" y2="${MARGIN.top + plotH}" stroke="#111827" stroke-width="1.25"/>` +
        tickLabels +
        `<svg x="${MARGIN.left}" y="${MARGIN.top}" width="${plotW}" height="${plotH}" viewBox="${MARGIN.left} ${MARGIN.top} ${plotW} ${plotH}">${paths}</svg>` +
        marks +
        legend +
        `</svg>`;

    // The browser redraws from the spec and has no use for the text.
    if (options.summary === false) return { svg, summary: "" };
    const summary = [
        `Graph drawn for x ∈ [${fmt(xMin, 4)}, ${fmt(xMax, 4)}], y ∈ [${fmt(yMin, 4)}, ${fmt(yMax, 4)}].`,
        ...compiled.map(({ f, expression }) => describeFunction(f, expression, xMin, xMax)),
    ].join("\n");

    return { svg, summary };
}
