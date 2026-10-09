import { Renderer } from "@openuidev/react-lang";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { richLibrary } from "~/components/generative-ui/library";

const canvas = vi.hoisted(() => ({ artifacts: [] as unknown[] }));
vi.mock("~/lib/canvas", () => ({ useOptionalCanvas: () => ({ artifacts: canvas.artifacts }) }));

// 1x1 PNG
const PNG =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const program = `root = Card([RichFigure("sales.png", "Monthly sales")])`;

beforeEach(() => {
    vi.stubGlobal(
        "URL",
        Object.assign(URL, { createObjectURL: vi.fn(() => "blob:fig"), revokeObjectURL: vi.fn() }),
    );
});
afterEach(() => {
    canvas.artifacts = [];
    vi.unstubAllGlobals();
});

describe("RichFigure", () => {
    it("shows a Python-generated image from the thread's files, locally", async () => {
        canvas.artifacts = [
            {
                id: "1",
                kind: "file",
                title: "sales.png",
                filename: "sales.png",
                mimeType: "image/png",
                content: PNG,
                contentEncoding: "base64",
                createdAt: 0,
            },
        ];
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        const { container } = render(
            <Renderer response={program} library={richLibrary} isStreaming={false} />,
        );
        await waitFor(() =>
            expect(container.querySelector("img")?.getAttribute("src")).toBe("blob:fig"),
        );
        expect(screen.getByText("Monthly sales")).toBeTruthy();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("explains when the file is not in this chat instead of showing nothing", () => {
        render(<Renderer response={program} library={richLibrary} isStreaming={false} />);
        expect(screen.getByRole("status").textContent).toContain("sales.png is not available");
    });
});
