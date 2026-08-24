type Token =
    | { kind: "number"; value: number }
    | { kind: "identifier"; value: string }
    | { kind: "operator"; value: "+" | "-" | "*" | "/" | "%" | "^" }
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

const MATH_FUNCTIONS: Record<string, MathFunction> = {
    sqrt: { fn: (value) => Math.sqrt(value), minArgs: 1, maxArgs: 1 },
    sin: { fn: (value) => Math.sin(value), minArgs: 1, maxArgs: 1 },
    cos: { fn: (value) => Math.cos(value), minArgs: 1, maxArgs: 1 },
    tan: { fn: (value) => Math.tan(value), minArgs: 1, maxArgs: 1 },
    log: { fn: (value) => Math.log(value), minArgs: 1, maxArgs: 1 },
    log2: { fn: (value) => Math.log2(value), minArgs: 1, maxArgs: 1 },
    log10: { fn: (value) => Math.log10(value), minArgs: 1, maxArgs: 1 },
    pow: { fn: (left, right) => Math.pow(left, right), minArgs: 2, maxArgs: 2 },
    abs: { fn: (value) => Math.abs(value), minArgs: 1, maxArgs: 1 },
    round: { fn: (value) => Math.round(value), minArgs: 1, maxArgs: 1 },
    floor: { fn: (value) => Math.floor(value), minArgs: 1, maxArgs: 1 },
    ceil: { fn: (value) => Math.ceil(value), minArgs: 1, maxArgs: 1 },
    min: { fn: (...values) => Math.min(...values), minArgs: 1, maxArgs: Number.MAX_SAFE_INTEGER },
    max: { fn: (...values) => Math.max(...values), minArgs: 1, maxArgs: Number.MAX_SAFE_INTEGER },
    exp: { fn: (value) => Math.exp(value), minArgs: 1, maxArgs: 1 },
};

const MATH_CONSTANTS: Record<string, number> = {
    PI: Math.PI,
    E: Math.E,
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
        const numberMatch = remainder.match(
            /^(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?/,
        );
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
        } else if (char === "(" || char === ")" || char === ",") {
            tokens.push({
                kind: char === "(" ? "lparen" : char === ")" ? "rparen" : "comma",
            });
            index += 1;
        } else if (char === "*" && expression[index + 1] === "*") {
            tokens.push({ kind: "operator", value: "^" });
            index += 2;
        } else if (["+", "-", "*", "/", "%", "^"].includes(char)) {
            tokens.push({
                kind: "operator",
                value: char as "+" | "-" | "*" | "/" | "%" | "^",
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

    constructor(tokens: Token[]) {
        this.tokens = tokens;
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
            this.match("operator", "%")
        ) {
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

    private parsePower(): number {
        const value = this.parsePrimary();
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

export function evaluateMathExpression(rawExpression: string): number {
    const expression = rawExpression.trim();
    if (!expression) throw new Error("No expression provided");
    return new MathParser(tokenize(expression)).parse();
}

export function formatMathResult(rawExpression: unknown): string {
    try {
        return `Result: ${evaluateMathExpression(String(rawExpression ?? ""))}`;
    } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
}
