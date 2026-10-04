import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
    AssistantRuntimeProvider,
    useLocalRuntime,
    unstable_useComposerInput,
    type ChatModelAdapter,
} from "@assistant-ui/react";

const adapter: ChatModelAdapter = {
    async run() {
        return { content: [{ type: "text", text: "reply" }] };
    },
};
function Input() {
    const { value, setText } = unstable_useComposerInput();
    return (
        <textarea
            aria-label="draft"
            value={value}
            onChange={(event) => setText(event.target.value)}
        />
    );
}
function Harness() {
    const runtime = useLocalRuntime(adapter);
    return (
        <AssistantRuntimeProvider runtime={runtime}>
            <Input />
        </AssistantRuntimeProvider>
    );
}

describe("composer store subscriptions", () => {
    for (const strict of [false, true]) {
        it(`retains text with StrictMode ${strict ? "on" : "off"}`, async () => {
            render(
                strict ? (
                    <StrictMode>
                        <Harness />
                    </StrictMode>
                ) : (
                    <Harness />
                ),
            );
            const input = screen.getByRole("textbox", { name: "draft" }) as HTMLTextAreaElement;
            fireEvent.change(input, { target: { value: "hello" } });
            await waitFor(() => expect(input.value).toBe("hello"));
        });
    }
});
