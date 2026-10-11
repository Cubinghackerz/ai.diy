import { compileMathExpression, type MathVariables } from "~/lib/math-evaluator";

/**
 * Numeric calculus and algebra for the `math_analyze` tool: derivatives,
 * definite integrals, roots, extrema, limits, series sums and value tables of
 * a one-variable function. Everything is numeric (instant, no Python load) and
 * says so; exact symbolic answers (antiderivatives, simplification, solving for
 * a variable) belong to sympy through run_python.
 */

export type MathOperation =
    "table" | "derivative" | "integral" | "roots" | "extrema" | "limit" | "sum";

export type MathAnalysisInput = {
    operation: MathOperation;
    expression: string;
    /** Name of the variable in the expression. Default "x" ("n" for sums). */
    variable?: string;
    /** Point for a derivative or a limit. */
    at?: number;
    /** Derivative order, 1 or 2. */
    order?: number;
    /** Range start for table, integral, roots, extrema and sum. */
    from?: number;
    /** Range end. */
    to?: number;
    /** Table step. */
    step?: number;
    /** Extra named constants, e.g. { a: 2 }. */
    constants?: MathVariables;
};

export type MathFn = (x: number) => number;

const SCAN_POINTS = 4000;
const MAX_SUM_TERMS = 1_000_000;
const MAX_TABLE_ROWS = 60;

/** Round to 10 significant digits and drop float noise like 0.30000000000000004. */
export function fmt(value: number, digits = 10): string {
    if (Number.isNaN(value)) return "undefined";
    if (!Number.isFinite(value)) return value > 0 ? "∞" : "-∞";
    if (Math.abs(value) < 1e-12) return "0";
    return String(Number(value.toPrecision(digits)));
}

/**
 * Golden-section search can only locate a flat minimum to about √ε (1.5e-8), so
 * a vertex at 0 comes back as 1.49e-8. Snap to the nearest clean value so the
 * answer reads as what it is.
 */
export function snap(x: number, span: number): number {
    if (Math.abs(x) < span * 1e-7) return 0;
    return Number(x.toPrecision(7));
}

/** Compile `expression` as a function of `variable`, with optional constants bound in. */
export function toFunction(
    expression: string,
    variable = "x",
    constants: MathVariables = {},
): MathFn {
    const names = Object.keys(constants);
    const fn = compileMathExpression(expression, [variable, ...names]);
    const bound = names.map((name) => constants[name]!);
    return (x) => {
        try {
            return fn(x, ...bound);
        } catch {
            return Number.NaN;
        }
    };
}

export function derivativeAt(f: MathFn, x0: number, order = 1): number {
    const scale = Math.max(1, Math.abs(x0));
    if (order === 2) {
        const h = 1e-3 * scale;
        const second = (step: number) => (f(x0 + step) - 2 * f(x0) + f(x0 - step)) / (step * step);
        // Richardson extrapolation cancels the leading error term.
        return (4 * second(h / 2) - second(h)) / 3;
    }
    const h = 1e-4 * scale;
    const central = (step: number) => (f(x0 + step) - f(x0 - step)) / (2 * step);
    return (4 * central(h / 2) - central(h)) / 3;
}

export function integrate(f: MathFn, a: number, b: number): number {
    if (a === b) return 0;
    if (a > b) return -integrate(f, b, a);
    // Evaluate just inside the ends so removable endpoints (sin(x)/x at 0) do not poison the sum.
    const edge = (x: number, toward: number) => {
        const value = f(x);
        return Number.isFinite(value) ? value : f(x + (toward - x) * 1e-9);
    };
    const simpson = (fa: number, fm: number, fb: number, lo: number, hi: number) =>
        ((hi - lo) / 6) * (fa + 4 * fm + fb);
    const recurse = (
        lo: number,
        hi: number,
        fa: number,
        fm: number,
        fb: number,
        whole: number,
        tolerance: number,
        depth: number,
    ): number => {
        const mid = (lo + hi) / 2;
        const lm = (lo + mid) / 2;
        const rm = (mid + hi) / 2;
        const flm = f(lm);
        const frm = f(rm);
        const left = simpson(fa, flm, fm, lo, mid);
        const right = simpson(fm, frm, fb, mid, hi);
        const delta = left + right - whole;
        if (depth <= 0 || Math.abs(delta) <= 15 * tolerance) return left + right + delta / 15;
        return (
            recurse(lo, mid, fa, flm, fm, left, tolerance / 2, depth - 1) +
            recurse(mid, hi, fm, frm, fb, right, tolerance / 2, depth - 1)
        );
    };
    // Start from 16 panels so a narrow feature is not missed by one coarse Simpson estimate.
    const panels = 16;
    let total = 0;
    const width = (b - a) / panels;
    for (let index = 0; index < panels; index += 1) {
        const lo = a + index * width;
        const hi = lo + width;
        const fa = index === 0 ? edge(lo, hi) : f(lo);
        const fb = index === panels - 1 ? edge(hi, lo) : f(hi);
        const fm = f((lo + hi) / 2);
        total += recurse(lo, hi, fa, fm, fb, simpson(fa, fm, fb, lo, hi), 1e-10 / panels, 18);
    }
    return total;
}

/** Zeros of f on [a, b]: sign changes and touching points, refined by bisection. */
export function findRoots(f: MathFn, a: number, b: number): number[] {
    const roots: number[] = [];
    const push = (x: number) => {
        if (!roots.some((existing) => Math.abs(existing - x) < 1e-7 * Math.max(1, Math.abs(x)))) {
            roots.push(x);
        }
    };
    const step = (b - a) / SCAN_POINTS;
    let prevX = a;
    let prevY = f(a);
    if (prevY === 0) push(a);
    for (let index = 1; index <= SCAN_POINTS; index += 1) {
        const x = index === SCAN_POINTS ? b : a + index * step;
        const y = f(x);
        if (y === 0) push(x);
        else if (Number.isFinite(prevY) && Number.isFinite(y) && prevY * y < 0) {
            let lo = prevX;
            let hi = x;
            let flo = prevY;
            for (let iteration = 0; iteration < 80; iteration += 1) {
                const mid = (lo + hi) / 2;
                const fm = f(mid);
                if (fm === 0) {
                    lo = hi = mid;
                    break;
                }
                if (flo * fm < 0) hi = mid;
                else {
                    lo = mid;
                    flo = fm;
                }
            }
            const root = (lo + hi) / 2;
            // A sign change across an asymptote (1/x at 0) is not a zero.
            if (Math.abs(f(root)) < 1e-6 * Math.max(1, Math.abs(prevY), Math.abs(y))) push(root);
        }
        prevX = x;
        prevY = y;
    }
    // Even-multiplicity roots (x^2) touch zero without crossing: look for a local minimum of |f| near 0.
    for (let index = 1; index < SCAN_POINTS; index += 1) {
        const x0 = a + (index - 1) * step;
        const x1 = a + index * step;
        const x2 = a + (index + 1) * step;
        const y0 = Math.abs(f(x0));
        const y1 = Math.abs(f(x1));
        const y2 = Math.abs(f(x2));
        if (![y0, y1, y2].every(Number.isFinite) || !(y1 < y0 && y1 <= y2)) continue;
        const refined = snap(
            goldenSection((x) => Math.abs(f(x)), x0, x2, "min"),
            b - a,
        );
        if (Math.abs(f(refined)) < 1e-9) push(refined);
    }
    return roots.sort((l, r) => l - r);
}

function goldenSection(f: MathFn, lo: number, hi: number, kind: "min" | "max"): number {
    const sign = kind === "min" ? 1 : -1;
    const ratio = (Math.sqrt(5) - 1) / 2;
    let a = lo;
    let b = hi;
    let c = b - ratio * (b - a);
    let d = a + ratio * (b - a);
    for (let iteration = 0; iteration < 100 && Math.abs(b - a) > 1e-12; iteration += 1) {
        if (sign * f(c) < sign * f(d)) b = d;
        else a = c;
        c = b - ratio * (b - a);
        d = a + ratio * (b - a);
    }
    return (a + b) / 2;
}

export type Extremum = { x: number; y: number; kind: "min" | "max" };

/** Local minima and maxima of f on [a, b]. */
export function findExtrema(f: MathFn, a: number, b: number): Extremum[] {
    const step = (b - a) / SCAN_POINTS;
    const xs: number[] = [];
    const ys: number[] = [];
    for (let index = 0; index <= SCAN_POINTS; index += 1) {
        const x = index === SCAN_POINTS ? b : a + index * step;
        xs.push(x);
        ys.push(f(x));
    }
    // Poles (tan at π/2, 1/x at 0) look like extrema to a scan. Judge "huge" against
    // the function's usual size so a genuinely large amplitude is still accepted.
    const magnitudes = ys
        .filter(Number.isFinite)
        .map(Math.abs)
        .sort((p, q) => p - q);
    const typical = magnitudes[Math.floor(magnitudes.length * 0.9)] ?? 0;
    const limit = 1000 * Math.max(1, typical);
    const nudge = (b - a) * 1e-4;
    const found: Extremum[] = [];
    for (let index = 1; index < SCAN_POINTS; index += 1) {
        const [l, m, r] = [ys[index - 1]!, ys[index]!, ys[index + 1]!];
        if (![l, m, r].every(Number.isFinite)) continue;
        const kind = m > l && m >= r ? "max" : m < l && m <= r ? "min" : null;
        if (!kind) continue;
        const x = snap(goldenSection(f, xs[index - 1]!, xs[index + 1]!, kind), b - a);
        const y = f(x);
        if (!Number.isFinite(y) || Math.abs(y) > limit) continue;
        const [before, after] = [f(x - nudge), f(x + nudge)];
        const genuine =
            kind === "max"
                ? y >= before - 1e-9 * Math.abs(y) && y >= after - 1e-9 * Math.abs(y)
                : y <= before + 1e-9 * Math.abs(y) && y <= after + 1e-9 * Math.abs(y);
        if (!genuine) continue;
        if (!found.some((e) => Math.abs(e.x - x) < 1e-6 * Math.max(1, Math.abs(x)))) {
            found.push({ x, y, kind });
        }
    }
    return found;
}

function limitAt(f: MathFn, x0: number): string {
    const sample = (direction: 1 | -1) => {
        const values = [1e-3, 1e-5, 1e-7].map((h) =>
            f(x0 + direction * h * Math.max(1, Math.abs(x0))),
        );
        const last = values[values.length - 1]!;
        if (values.some((v) => Number.isNaN(v))) return { kind: "undefined" as const };
        if (Math.abs(last) > 1e6 && Math.abs(last) > 10 * Math.abs(values[0]!)) {
            return { kind: "infinite" as const, sign: last > 0 ? 1 : -1 };
        }
        if (Math.abs(values[2]! - values[1]!) <= 1e-4 * Math.max(1, Math.abs(values[2]!))) {
            return { kind: "finite" as const, value: values[2]! };
        }
        return { kind: "none" as const };
    };
    const left = sample(-1);
    const right = sample(1);
    const describe = (side: ReturnType<typeof sample>) =>
        side.kind === "finite"
            ? fmt(side.value)
            : side.kind === "infinite"
              ? side.sign > 0
                  ? "∞"
                  : "-∞"
              : "does not settle";
    if (left.kind === "finite" && right.kind === "finite") {
        if (Math.abs(left.value - right.value) <= 1e-4 * Math.max(1, Math.abs(left.value))) {
            return `Limit as x → ${fmt(x0)}: ${fmt((left.value + right.value) / 2)} (numerical)`;
        }
    }
    if (left.kind === "infinite" && right.kind === "infinite" && left.sign === right.sign) {
        return `Limit as x → ${fmt(x0)}: ${left.sign > 0 ? "∞" : "-∞"} (the function grows without bound)`;
    }
    return `The limit as x → ${fmt(x0)} does not exist (from the left: ${describe(left)}, from the right: ${describe(right)}).`;
}

function requireNumber(value: unknown, label: string): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`${label} is required`);
    }
    return value;
}

/** Run one analysis and describe the result in plain text. Throws for bad input. */
export function analyzeMath(input: MathAnalysisInput): string {
    const variable = input.variable?.trim() || (input.operation === "sum" ? "n" : "x");
    const f = toFunction(input.expression, variable, input.constants);
    const label = `f(${variable}) = ${input.expression.trim()}`;

    switch (input.operation) {
        case "table": {
            const from = requireNumber(input.from, "from");
            const to = requireNumber(input.to, "to");
            const step = input.step ?? (to - from) / 10;
            if (!(step > 0) || to < from)
                throw new Error("table needs from ≤ to and a positive step");
            const rows: string[] = [];
            for (
                let x = from, count = 0;
                x <= to + step * 1e-9 && count < MAX_TABLE_ROWS;
                x += step, count += 1
            ) {
                rows.push(`${fmt(x)} → ${fmt(f(x))}`);
            }
            return `${label}\n${variable} → f\n${rows.join("\n")}`;
        }
        case "derivative": {
            const at = requireNumber(input.at, "at");
            const order = input.order === 2 ? 2 : 1;
            const value = derivativeAt(f, at, order);
            if (!Number.isFinite(value)) throw new Error("The derivative is undefined here");
            return `${label}\nf${order === 2 ? "″" : "′"}(${fmt(at)}) ≈ ${fmt(value)} (numerical; use sympy for the symbolic derivative)`;
        }
        case "integral": {
            const from = requireNumber(input.from, "from");
            const to = requireNumber(input.to, "to");
            const value = integrate(f, from, to);
            if (!Number.isFinite(value)) {
                throw new Error(
                    "The integral diverges or the function is undefined on the interval",
                );
            }
            return `${label}\n∫ from ${fmt(from)} to ${fmt(to)} ≈ ${fmt(value)} (numerical; use sympy for an exact antiderivative)`;
        }
        case "roots": {
            const from = input.from ?? -10;
            const to = input.to ?? 10;
            if (!(to > from)) throw new Error("roots needs from < to");
            const roots = findRoots(f, from, to);
            return roots.length
                ? `${label}\nZeros of f on [${fmt(from)}, ${fmt(to)}]: ${roots
                      .slice(0, 12)
                      .map((root) => `${variable} ≈ ${fmt(root)}`)
                      .join(", ")}${roots.length > 12 ? ` (and ${roots.length - 12} more)` : ""}`
                : `${label}\nNo zeros found on [${fmt(from)}, ${fmt(to)}].`;
        }
        case "extrema": {
            const from = input.from ?? -10;
            const to = input.to ?? 10;
            if (!(to > from)) throw new Error("extrema needs from < to");
            const found = findExtrema(f, from, to);
            const edges = [from, to]
                .map((x) => ({ x, y: f(x) }))
                .filter((p) => Number.isFinite(p.y));
            const all = [...found.map(({ x, y }) => ({ x, y })), ...edges];
            const lines = found.length
                ? found.map((e) => `local ${e.kind} at ${variable} ≈ ${fmt(e.x)}, f ≈ ${fmt(e.y)}`)
                : ["no interior local extrema"];
            if (all.length) {
                const lowest = all.reduce((best, p) => (p.y < best.y ? p : best));
                const highest = all.reduce((best, p) => (p.y > best.y ? p : best));
                lines.push(
                    `lowest value on the interval ≈ ${fmt(lowest.y)} at ${variable} ≈ ${fmt(lowest.x)}`,
                    `highest value on the interval ≈ ${fmt(highest.y)} at ${variable} ≈ ${fmt(highest.x)}`,
                );
            }
            return `${label}\nOn [${fmt(from)}, ${fmt(to)}]:\n${lines.join("\n")}`;
        }
        case "limit": {
            const at = requireNumber(input.at, "at");
            return `${label}\n${limitAt(f, at)}`;
        }
        case "sum": {
            const from = Math.round(requireNumber(input.from, "from"));
            const to = Math.round(requireNumber(input.to, "to"));
            if (to < from) throw new Error("sum needs from ≤ to");
            if (to - from + 1 > MAX_SUM_TERMS)
                throw new Error(`sum is limited to ${MAX_SUM_TERMS} terms`);
            let total = 0;
            let compensation = 0;
            for (let n = from; n <= to; n += 1) {
                // Kahan summation keeps long sums accurate.
                const term = f(n) - compensation;
                const next = total + term;
                compensation = next - total - term;
                total = next;
            }
            if (!Number.isFinite(total))
                throw new Error("A term is undefined or the sum is infinite");
            return `${label}\nΣ ${variable}=${from}..${to} = ${fmt(total)}`;
        }
        default:
            throw new Error(
                `Unknown operation "${String((input as { operation?: unknown }).operation)}"`,
            );
    }
}
