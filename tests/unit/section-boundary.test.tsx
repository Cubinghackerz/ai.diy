import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SectionBoundary } from "~/components/ui/SectionBoundary";

describe("section recovery", () => {
    it("isolates a rendering failure and retries without losing siblings", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        let broken = true;
        function Content() {
            if (broken) throw new Error("private conversation and key contents");
            return <p>Recovered</p>;
        }
        render(
            <>
                <SectionBoundary label="Message">
                    <Content />
                </SectionBoundary>
                <textarea aria-label="composer" defaultValue="unsent draft" />
            </>,
        );
        expect(screen.getByRole("alert").textContent).toContain("Message couldn’t be displayed");
        expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("unsent draft");
        broken = false;
        fireEvent.click(screen.getByRole("button", { name: "Retry Message" }));
        expect(screen.getByText("Recovered")).toBeDefined();
    });
    it("copies diagnostics without raw error contents", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
        function Broken(): never {
            throw new Error("sk-private-key private conversation");
        }
        render(
            <SectionBoundary label="Canvas">
                <Broken />
            </SectionBoundary>,
        );
        fireEvent.click(screen.getByRole("button", { name: "Copy error" }));
        await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
        expect(writeText.mock.calls[0][0]).not.toContain("sk-private-key");
        expect(writeText.mock.calls[0][0]).not.toContain("private conversation");
    });
});
