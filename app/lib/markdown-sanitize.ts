/**
 * Markdown sanitization shared by the chat renderer and its tests.
 *
 * Model output and tool results may embed raw HTML; rehype-raw turns it into a
 * hast tree and this schema strips active content (script, iframe, style,
 * form, embed, object, event handlers) before KaTeX runs. KaTeX output is
 * generated after sanitization, so its classes are untouched.
 */

import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Schema } from "hast-util-sanitize";
import { defaultUrlTransform, type Options } from "react-markdown";

const sanitizeSchema: Schema = {
    ...defaultSchema,
    attributes: {
        ...defaultSchema.attributes,
        // remark-math marks math nodes with these classes; the default schema
        // only allows `language-*` on code, which would strip math before
        // rehype-katex ever sees it.
        code: [
            ...(defaultSchema.attributes?.code ?? []),
            ["className", "language-math", "math-inline", "math-display"],
        ],
    },
    protocols: {
        ...defaultSchema.protocols,
        // Inline data/blob images are local; remote http(s) sources survive
        // sanitization but the markdown image component gates them behind a
        // click-to-load placeholder so a conversation's contents are never
        // leaked to a remote host by a stray request.
        src: [...(defaultSchema.protocols?.src ?? []), "data", "blob"],
        href: ["http", "https", "mailto"],
    },
};

/**
 * react-markdown's defaultUrlTransform blanks `data:`/`blob:` URLs. Local
 * inline sources are safe to render, so `src` keeps them while every other
 * attribute falls back to the default protocol allowlist.
 */
export const markdownUrlTransform: Options["urlTransform"] = (value, key) => {
    if (key === "src" && /^(data:|blob:)/i.test(value)) return value;
    return defaultUrlTransform(value);
};

export const markdownRehypePlugins: Options["rehypePlugins"] = [
    rehypeRaw,
    [rehypeSanitize, sanitizeSchema],
    rehypeKatex,
];
