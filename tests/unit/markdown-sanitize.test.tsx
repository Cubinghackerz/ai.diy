import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { markdownRehypePlugins, markdownUrlTransform } from "~/lib/markdown-sanitize";
import { MarkdownImage } from "~/components/assistant-ui/markdown-image";

vi.mock("~/lib/canvas", () => ({ useOptionalCanvas: () => undefined }));

const Markdown = ({ children }: { children: string }) => (
    <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={markdownRehypePlugins}
        urlTransform={markdownUrlTransform}
        components={{ img: MarkdownImage }}
    >
        {children}
    </ReactMarkdown>
);

describe("rendered markdown sanitization", () => {
    it.each(["script", "iframe", "style", "form", "object", "embed", "button"])(
        "strips <%s> from model-emitted HTML",
        (tag) => {
            const { container } = render(
                <Markdown>{`before <${tag}>payload</${tag}> after`}</Markdown>,
            );
            expect(container.querySelector(tag)).toBeNull();
            expect(container.textContent).toContain("before");
        },
    );

    it("strips event handlers from raw HTML images", () => {
        const { container } = render(
            <Markdown>{`<img src="https://example.com/a.png" onerror="globalThis.__pwned = 1">`}</Markdown>,
        );
        expect(container.querySelector("img")).toBeNull();
        expect(container.innerHTML).not.toContain("onerror");
        expect(screen.getByRole("button", { name: /load image from example\.com/i })).toBeDefined();
    });

    it("renders remote markdown images as click-to-load placeholders, never auto-fetching", async () => {
        const { container } = render(<Markdown>{`![chart](https://example.com/a.png)`}</Markdown>);
        expect(container.querySelector("img[src^='http']")).toBeNull();
        const trigger = screen.getByRole("button", { name: /load image from example\.com/i });
        trigger.click();
        await waitFor(() => {
            const img = container.querySelector("img");
            expect(img?.getAttribute("src")).toBe("https://example.com/a.png");
            expect(img?.getAttribute("alt")).toBe("chart");
        });
    });

    it("renders inline data URLs directly", () => {
        const { container } = render(
            <Markdown>{"![dot](data:image/png;base64,iVBORw0KGgo=)"}</Markdown>,
        );
        const img = container.querySelector("img");
        expect(img?.getAttribute("src")).toContain("data:image/png");
        expect(screen.queryByRole("button")).toBeNull();
    });

    it("keeps KaTeX math working after sanitization", () => {
        const { container } = render(<Markdown>{"Inline $a^2$ and $$\\int x\\,dx$$"}</Markdown>);
        expect(container.querySelector(".katex")).not.toBeNull();
        expect(container.textContent).toContain("a2");
    });

    it("keeps code fences with language-math classes for KaTeX", () => {
        const { container } = render(<Markdown>{"$$\n\\frac{1}{2}\n$$"}</Markdown>);
        expect(container.querySelector(".katex-display")).not.toBeNull();
    });

    it("keeps GFM tables and details", () => {
        const { container } = render(
            <Markdown>
                {"| a | b |\n| - | - |\n| 1 | 2 |\n\n<details><summary>s</summary>x</details>"}
            </Markdown>,
        );
        expect(container.querySelector("table")).not.toBeNull();
        expect(container.querySelector("details summary")?.textContent).toContain("s");
    });

    it("limits link protocols to http, https, and mailto", () => {
        const { container } = render(
            <Markdown>{`[a](javascript:alert(1)) [b](https://ok.example) [c](vbscript:x)`}</Markdown>,
        );
        const liveAnchors = [...container.querySelectorAll("a[href]")];
        expect(liveAnchors.map((a) => a.getAttribute("href"))).toEqual(["https://ok.example"]);
        // Unsafe links keep their text but get no navigable href.
        expect(container.textContent).toContain("a");
        expect(container.textContent).toContain("c");
    });
});
