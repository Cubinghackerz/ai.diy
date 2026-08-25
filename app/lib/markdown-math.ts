const MARKDOWN_CODE_PATTERN =
    /(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\1[ \t]*(?=\n|$)|(`+)(?!`)[\s\S]*?\2/g;

function convertMathDelimiters(markdown: string): string {
    return markdown
        .replace(
            /(?<!\\)\\\[([\s\S]*?)(?<!\\)\\\]/g,
            (_match, expression: string) => `$$\n${expression.trim()}\n$$`,
        )
        .replace(
            /(?<!\\)\\\(([\s\S]*?)(?<!\\)\\\)/g,
            (_match, expression: string) => `$${expression}$`,
        );
}

/** Normalize LaTeX delimiters that remark-math does not parse by default. */
export function normalizeMathDelimiters(markdown: string): string {
    let normalized = "";
    let cursor = 0;

    for (const match of markdown.matchAll(MARKDOWN_CODE_PATTERN)) {
        const index = match.index ?? cursor;
        normalized += convertMathDelimiters(markdown.slice(cursor, index));
        normalized += match[0];
        cursor = index + match[0].length;
    }

    return normalized + convertMathDelimiters(markdown.slice(cursor));
}
