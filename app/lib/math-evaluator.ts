type Token =
    | { kind: "number"; value: number }
    | { kind: "identifier"; value: string }
    | { kind: "operator"; value: "+" | "-" | "*" | "/" | "%" | "^" | "!" }
    | { kind: "lparen" | "rparen" | "comma" }
    | { kind: "eof" };

type MathFunction = {
    fn: (...args: number[]) => number;
    minArgs: number;
    maxArgs: number;
};

const MAX_EXPRESSION_LENGTH = 512;
const MAX_TOKENS = 256;
const MAX_DEPTH = 64;

const UNBOUNDED = Number.MAX_SAFE_INTEGER;

function factorial(value: number): number {
    if (!Number.isInteger(value) || value < 0) {
        throw new Error("Factorial needs a whole number that is 0 or more");
    }
    if (value > 170) throw new Error("Factorial is limited to 170");
    let result = 1;
    for (let n = 2; n <= value; n += 1) result *= n;
    return result;
}

/** Lanczos approximation, accurate to roughly 15 digits for positive arguments. */
function gamma(value: number): number {
    if (Number.isInteger(value) && value <= 0) throw new Error("Gamma is undefined here");
    if (value < 0.5) return Math.PI / (Math.sin(Math.PI * value) * gamma(1 - value));
    const g = 7;
    const coefficients = [
        0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
        -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
        1.5056327351493116e-7,
    ];
    const x = value - 1;
    let a = coefficients[0]!;
    const t = x + g + 0.5;
    for (let index = 1; index < g + 2; index += 1) a += coefficients[index]! / (x + index);
    return Math.sqrt(2 * Math.PI) * Math.pow(t, x + 0.5) * Math.exp(-t) * a;
}

function wholeNumber(value: number, label: string): number {
    if (!Number.isInteger(value)) throw new Error(`${label} needs whole numbers`);
    return value;
}

function choose(n: number, k: number): number {
    wholeNumber(n, "nCr");
    wholeNumber(k, "nCr");
    if (k < 0 || n < 0 || k > n) return 0;
    const m = Math.min(k, n - k);
    let result = 1;
    for (let index = 1; index <= m; index += 1) result = (result * (n - m + index)) / index;
    return Math.round(result);
}

function permute(n: number, k: number): number {
    wholeNumber(n, "nPr");
    wholeNumber(k, "nPr");
    if (k < 0 || n < 0 || k > n) return 0;
    let result = 1;
    for (let index = 0; index < k; index += 1) result *= n - index;
    return result;
}

function gcd(a: number, b: number): number {
    let x = Math.abs(wholeNumber(a, "gcd"));
    let y = Math.abs(wholeNumber(b, "gcd"));
    while (y) [x, y] = [y, x % y];
    return x;
}

function realRoot(value: number, degree: number): number {
    wholeNumber(degree, "root");
    if (degree === 0) throw new Error("root degree cannot be 0");
    if (value < 0 && degree % 2 !== 0) return -Math.pow(-value, 1 / degree);
    return Math.pow(value, 1 / degree);
}

function mean(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function sampleVariance(values: number[]): number {
    if (values.length < 2) throw new Error("stdev needs at least two values");
    const m = mean(values);
    return values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1);
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const MATH_FUNCTIONS: Record<string, MathFunction> = {
    sqrt: { fn: (value) => Math.sqrt(value), minArgs: 1, maxArgs: 1 },
    cbrt: { fn: (value) => Math.cbrt(value), minArgs: 1, maxArgs: 1 },
    root: { fn: realRoot, minArgs: 2, maxArgs: 2 },
    sin: { fn: (value) => Math.sin(value), minArgs: 1, maxArgs: 1 },
    cos: { fn: (value) => Math.cos(value), minArgs: 1, maxArgs: 1 },
    tan: { fn: (value) => Math.tan(value), minArgs: 1, maxArgs: 1 },
    sec: { fn: (value) => 1 / Math.cos(value), minArgs: 1, maxArgs: 1 },
    csc: { fn: (value) => 1 / Math.sin(value), minArgs: 1, maxArgs: 1 },
    cot: { fn: (value) => 1 / Math.tan(value), minArgs: 1, maxArgs: 1 },
    asin: { fn: (value) => Math.asin(value), minArgs: 1, maxArgs: 1 },
    acos: { fn: (value) => Math.acos(value), minArgs: 1, maxArgs: 1 },
    atan: { fn: (value) => Math.atan(value), minArgs: 1, maxArgs: 1 },
    atan2: { fn: (y, x) => Math.atan2(y, x), minArgs: 2, maxArgs: 2 },
    sinh: { fn: (value) => Math.sinh(value), minArgs: 1, maxArgs: 1 },
    cosh: { fn: (value) => Math.cosh(value), minArgs: 1, maxArgs: 1 },
    tanh: { fn: (value) => Math.tanh(value), minArgs: 1, maxArgs: 1 },
    asinh: { fn: (value) => Math.asinh(value), minArgs: 1, maxArgs: 1 },
    acosh: { fn: (value) => Math.acosh(value), minArgs: 1, maxArgs: 1 },
    atanh: { fn: (value) => Math.atanh(value), minArgs: 1, maxArgs: 1 },
    // Degree variants: sind(30) = 0.5.
    sind: { fn: (value) => Math.sin(toRadians(value)), minArgs: 1, maxArgs: 1 },
    cosd: { fn: (value) => Math.cos(toRadians(value)), minArgs: 1, maxArgs: 1 },
    tand: { fn: (value) => Math.tan(toRadians(value)), minArgs: 1, maxArgs: 1 },
    radians: { fn: toRadians, minArgs: 1, maxArgs: 1 },
    degrees: { fn: (value) => (value * 180) / Math.PI, minArgs: 1, maxArgs: 1 },
    log: { fn: (value) => Math.log(value), minArgs: 1, maxArgs: 1 },
    ln: { fn: (value) => Math.log(value), minArgs: 1, maxArgs: 1 },
    log2: { fn: (value) => Math.log2(value), minArgs: 1, maxArgs: 1 },
    log10: { fn: (value) => Math.log10(value), minArgs: 1, maxArgs: 1 },
    // logb(x, base)
    logb: { fn: (value, base) => Math.log(value) / Math.log(base), minArgs: 2, maxArgs: 2 },
    pow: { fn: (left, right) => Math.pow(left, right), minArgs: 2, maxArgs: 2 },
    abs: { fn: (value) => Math.abs(value), minArgs: 1, maxArgs: 1 },
    sign: { fn: (value) => Math.sign(value), minArgs: 1, maxArgs: 1 },
    round: { fn: (value) => Math.round(value), minArgs: 1, maxArgs: 1 },
    floor: { fn: (value) => Math.floor(value), minArgs: 1, maxArgs: 1 },
    ceil: { fn: (value) => Math.ceil(value), minArgs: 1, maxArgs: 1 },
    trunc: { fn: (value) => Math.trunc(value), minArgs: 1, maxArgs: 1 },
    min: { fn: (...values) => Math.min(...values), minArgs: 1, maxArgs: UNBOUNDED },
    max: { fn: (...values) => Math.max(...values), minArgs: 1, maxArgs: UNBOUNDED },
    exp: { fn: (value) => Math.exp(value), minArgs: 1, maxArgs: 1 },
    hypot: { fn: (...values) => Math.hypot(...values), minArgs: 1, maxArgs: UNBOUNDED },
    mod: { fn: (left, right) => ((left % right) + right) % right, minArgs: 2, maxArgs: 2 },
    fact: { fn: factorial, minArgs: 1, maxArgs: 1 },
    factorial: { fn: factorial, minArgs: 1, maxArgs: 1 },
    gamma: { fn: gamma, minArgs: 1, maxArgs: 1 },
    ncr: { fn: choose, minArgs: 2, maxArgs: 2 },
    comb: { fn: choose, minArgs: 2, maxArgs: 2 },
    npr: { fn: permute, minArgs: 2, maxArgs: 2 },
    perm: { fn: permute, minArgs: 2, maxArgs: 2 },
    gcd: { fn: gcd, minArgs: 2, maxArgs: 2 },
    lcm: {
        fn: (a, b) => (a === 0 || b === 0 ? 0 : Math.abs(a * b) / gcd(a, b)),
        minArgs: 2,
        maxArgs: 2,
    },
    sum: {
        fn: (...values) => values.reduce((total, value) => total + value, 0),
        minArgs: 1,
        maxArgs: UNBOUNDED,
    },
    mean: { fn: (...values) => mean(values), minArgs: 1, maxArgs: UNBOUNDED },
    avg: { fn: (...values) => mean(values), minArgs: 1, maxArgs: UNBOUNDED },
    median: { fn: (...values) => median(values), minArgs: 1, maxArgs: UNBOUNDED },
    stdev: { fn: (...values) => Math.sqrt(sampleVariance(values)), minArgs: 2, maxArgs: UNBOUNDED },
    variance: { fn: (...values) => sampleVariance(values), minArgs: 2, maxArgs: UNBOUNDED },
};

const MATH_CONSTANTS: Record<string, number> = {
    PI: Math.PI,
    pi: Math.PI,
    E: Math.E,
    e: Math.E,
    tau: 2 * Math.PI,
    phi: (1 + Math.sqrt(5)) / 2,
};

function tokenize(expression: string): Token[] {
    if (expression.length > MAX_EXPRESSION_LENGTH) {
        throw new Error(`Expression is limited to ${MAX_EXPRESSION_LENGTH} characters`);
    }

    const tokens: Token[] = [];
    let index = 0;
    while (index < expression.length) {
        const char = expression[index];
        if (/\s/.test(char)) {
            index += 1;
            continue;
        }

        const remainder = expression.slice(index);
        const numberMatch = remainder.match(/^(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?/);
        if (numberMatch) {
            const value = Number(numberMatch[0]);
            if (!Number.isFinite(value)) throw new Error("Number is out of range");
            tokens.push({ kind: "number", value });
            index += numberMatch[0].length;
        } else if (/[A-Za-z_]/.test(char)) {
            const identifierMatch = remainder.match(/^[A-Za-z_][A-Za-z0-9_]*/);
            if (!identifierMatch) throw new Error(`Invalid identifier at position ${index}`);
            tokens.push({ kind: "identifier", value: identifierMatch[0] });
            index += identifierMatch[0].length;
        } else if (char === "×" || char === "·" || char === "÷" || char === "−") {
            // Pasted math: × · ÷ −
            tokens.push({
                kind: "operator",
                value: char === "÷" ? "/" : char === "−" ? "-" : "*",
            });
            index += 1;
        } else if (char === "(" || char === ")" || char === ",") {
            tokens.push({
                kind: char === "(" ? "lparen" : char === ")" ? "rparen" : "comma",
            });
            index += 1;
        } else if (char === "*" && expression[index + 1] === "*") {
            tokens.push({ kind: "operator", value: "^" });
            index += 2;
        } else if (["+", "-", "*", "/", "%", "^", "!"].includes(char)) {
            tokens.push({
                kind: "operator",
                value: char as "+" | "-" | "*" | "/" | "%" | "^" | "!",
            });
            index += 1;
        } else {
            throw new Error(`Invalid character at position ${index}`);
        }

        if (tokens.length > MAX_TOKENS) {
            throw new Error(`Expression is limited to ${MAX_TOKENS} tokens`);
        }
    }

    tokens.push({ kind: "eof" });
    return tokens;
}

class MathParser {
    private index = 0;
    private depth = 0;
    private readonly tokens: Token[];
    private readonly variables: Readonly<Record<string, number>>;

    constructor(tokens: Token[], variables: Readonly<Record<string, number>> = {}) {
        this.tokens = tokens;
        this.variables = variables;
    }

    parse(): number {
        const result = this.parseAdditive();
        this.expect("eof");
        return result;
    }

    private current(): Token {
        return this.tokens[this.index] ?? { kind: "eof" };
    }

    private advance(): Token {
        const token = this.current();
        this.index += 1;
        return token;
    }

    private match(kind: Token["kind"], value?: string): boolean {
        const token = this.current();
        return (
            token.kind === kind &&
            (value === undefined || ("value" in token && token.value === value))
        );
    }

    private expect(kind: Token["kind"], value?: string): Token {
        if (!this.match(kind, value)) {
            throw new Error(`Unexpected token near position ${this.index}`);
        }
        return this.advance();
    }

    private parseAdditive(): number {
        let value = this.parseMultiplicative();
        while (this.match("operator", "+") || this.match("operator", "-")) {
            const operator = this.advance();
            if (operator.kind !== "operator") throw new Error("Invalid operator");
            const right = this.parseMultiplicative();
            value = operator.value === "+" ? value + right : value - right;
        }
        return value;
    }

    private parseMultiplicative(): number {
        let value = this.parseUnary();
        while (
            this.match("operator", "*") ||
            this.match("operator", "/") ||
            this.match("operator", "%") ||
            this.startsImplicitProduct()
        ) {
            if (this.startsImplicitProduct()) {
                // 2x, 3(x+1), (x+1)(x-1), 2pi
                value *= this.parsePower();
                continue;
            }
            const operator = this.advance();
            if (operator.kind !== "operator") throw new Error("Invalid operator");
            const right = this.parseUnary();
            if (operator.value === "*") value *= right;
            else if (operator.value === "/") value /= right;
            else value %= right;
        }
        return value;
    }

    private parseUnary(): number {
        if (this.match("operator", "+") || this.match("operator", "-")) {
            const operator = this.advance();
            if (operator.kind !== "operator") throw new Error("Invalid operator");
            const value = this.parseUnary();
            return operator.value === "-" ? -value : value;
        }
        return this.parsePower();
    }

    /** A factor that follows another without an operator: "2x", "3(x+1)", "(a)(b)". */
    private startsImplicitProduct(): boolean {
        const next = this.current();
        const previous = this.tokens[this.index - 1];
        if (!previous) return false;
        if (next.kind === "identifier" || next.kind === "lparen") {
            return (
                previous.kind === "number" ||
                previous.kind === "rparen" ||
                previous.kind === "identifier" ||
                (previous.kind === "operator" && previous.value === "!")
            );
        }
        // "(x+1)2" is not a product anyone means; a number only follows a ")" like "(2)3"? Skip it.
        return false;
    }

    private parsePower(): number {
        let value = this.parsePrimary();
        while (this.match("operator", "!")) {
            this.advance();
            value = factorial(value);
        }
        if (this.match("operator", "^")) {
            this.advance();
            return Math.pow(value, this.parseUnary());
        }
        return value;
    }

    private parsePrimary(): number {
        this.depth += 1;
        if (this.depth > MAX_DEPTH) throw new Error(`Expression is limited to ${MAX_DEPTH} levels`);

        try {
            const token = this.current();
            if (token.kind === "number") {
                this.advance();
                return token.value;
            }
            if (token.kind === "identifier") {
                const identifier = this.advance();
                if (identifier.kind !== "identifier") throw new Error("Invalid identifier");
                const name = identifier.value;
                if (this.match("lparen")) return this.parseFunctionCall(name);
                const variable = Object.hasOwn(this.variables, name)
                    ? this.variables[name]
                    : undefined;
                if (variable !== undefined) return variable;
                const constant = Object.hasOwn(MATH_CONSTANTS, name)
                    ? MATH_CONSTANTS[name]
                    : undefined;
                if (constant !== undefined) return constant;
                throw new Error(`Unknown identifier "${name}"`);
            }
            if (this.match("lparen")) {
                this.advance();
                const value = this.parseAdditive();
                this.expect("rparen");
                return value;
            }
            throw new Error(`Expected a number near position ${this.index}`);
        } finally {
            this.depth -= 1;
        }
    }

    private parseFunctionCall(name: string): number {
        const definition = Object.hasOwn(MATH_FUNCTIONS, name)
            ? MATH_FUNCTIONS[name]
            : Object.hasOwn(MATH_FUNCTIONS, name.toLowerCase())
              ? MATH_FUNCTIONS[name.toLowerCase()]
              : undefined;
        if (!definition) throw new Error(`Unknown function "${name}"`);
        this.expect("lparen");

        const args: number[] = [];
        if (!this.match("rparen")) {
            args.push(this.parseAdditive());
            while (this.match("comma")) {
                this.advance();
                args.push(this.parseAdditive());
            }
        }
        this.expect("rparen");
        if (args.length < definition.minArgs || args.length > definition.maxArgs) {
            throw new Error(`Function "${name}" received the wrong number of arguments`);
        }
        return definition.fn(...args);
    }
}

export type MathVariables = Readonly<Record<string, number>>;

export function evaluateMathExpression(rawExpression: string, variables?: MathVariables): number {
    const expression = rawExpression.trim();
    if (!expression) throw new Error("No expression provided");
    return new MathParser(tokenize(expression), variables).parse();
}

/**
 * Parse once, evaluate many times (graphing, integrals). The tokens are reused;
 * only the variable values change per call.
 */
export function compileMathExpression(
    rawExpression: string,
    variableNames: readonly string[] = ["x"],
): (...values: number[]) => number {
    const expression = rawExpression.trim();
    if (!expression) throw new Error("No expression provided");
    const tokens = tokenize(expression);
    // Validate up front so a typo fails once, not on every sample. A value can
    // be outside a function's domain (fact(-1)), so only fail when every probe
    // value fails, which is what a syntax error or unknown name does.
    let lastError: unknown = null;
    let ok = false;
    for (const probeValue of [1, 0.5, 2, 3]) {
        try {
            new MathParser(
                tokens,
                Object.fromEntries(variableNames.map((name) => [name, probeValue])),
            ).parse();
            ok = true;
            break;
        } catch (error) {
            lastError = error;
        }
    }
    if (!ok) throw lastError;
    return (...values: number[]) =>
        new MathParser(
            tokens,
            Object.fromEntries(variableNames.map((name, index) => [name, values[index] ?? 0])),
        ).parse();
}

export function formatMathResult(rawExpression: unknown, variables?: MathVariables): string {
    try {
        const value = evaluateMathExpression(String(rawExpression ?? ""), variables);
        return `Result: ${value}`;
    } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
}
