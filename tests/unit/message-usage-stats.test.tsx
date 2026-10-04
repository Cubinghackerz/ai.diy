import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ message: null as unknown }));

vi.mock("@assistant-ui/react", () => ({
    useAuiState: (selector: (value: unknown) => unknown) => selector({ message: state.message }),
}));
vi.mock("@assistant-ui/react-ai-sdk", () => ({
    getThreadMessageTokenUsage: () => undefined,
}));
vi.mock("~/lib/model-catalog-cache", () => ({
    useModelCatalog: () => [],
    lookupInCatalog: () => undefined,
}));

const { MessageUsageStats, MessageModelBadge } =
    await import("~/components/assistant-ui/MessageUsageStats");

beforeEach(() => {
    state.message = undefined;
});

describe("per-message usage metadata", () => {
    it("shows provider-reported tokens for a completed message", () => {
        state.message = {
            role: "assistant",
            metadata: {
                custom: { usage: { inputTokens: 1200, outputTokens: 300 }, model: "gpt-test" },
            },
        };
        render(<MessageUsageStats />);
        expect(screen.getByText("1,500")).toBeDefined();
    });

    it("shows a placeholder when usage is unavailable", () => {
        state.message = { role: "assistant" };
        render(<MessageUsageStats />);
        expect(screen.getByText("-")).toBeDefined();
    });

    it("shows which model answered", () => {
        state.message = {
            role: "assistant",
            metadata: { custom: { model: "claude-test" } },
        };
        const { container } = render(<MessageModelBadge />);
        expect(container.textContent).toContain("claude-test");
    });

    it("renders nothing without a model", () => {
        state.message = { role: "assistant" };
        const { container } = render(<MessageModelBadge />);
        expect(container.textContent).toBe("");
    });
});
