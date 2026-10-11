import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDraftSetting } from "~/lib/hooks/useDraftSetting";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function Field({ committed, commit }: { committed: string; commit: (value: string) => void }) {
    const draft = useDraftSetting(committed, commit, 400);
    return (
        <input
            aria-label="field"
            value={draft.value}
            onChange={(event) => draft.onChange(event.target.value)}
            onBlur={draft.flush}
        />
    );
}

const type = (value: string) =>
    fireEvent.change(screen.getByLabelText("field"), { target: { value } });

describe("useDraftSetting", () => {
    it("keeps typing local and commits once after a pause, not on every keystroke", () => {
        const commit = vi.fn();
        render(<Field committed="" commit={commit} />);
        for (const text of ["h", "he", "hel", "hell", "hello"]) type(text);

        expect(commit).not.toHaveBeenCalled();
        expect((screen.getByLabelText("field") as HTMLInputElement).value).toBe("hello");

        act(() => vi.advanceTimersByTime(399));
        expect(commit).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(2));
        expect(commit).toHaveBeenCalledTimes(1);
        expect(commit).toHaveBeenCalledWith("hello");
    });

    it("commits immediately on blur", () => {
        const commit = vi.fn();
        render(<Field committed="" commit={commit} />);
        type("abc");
        fireEvent.blur(screen.getByLabelText("field"));
        expect(commit).toHaveBeenCalledWith("abc");
        act(() => vi.advanceTimersByTime(1_000));
        expect(commit).toHaveBeenCalledTimes(1);
    });

    it("saves unsaved edits when the field unmounts (switching sections, closing Settings)", () => {
        const commit = vi.fn();
        const { unmount } = render(<Field committed="" commit={commit} />);
        type("unsaved");
        unmount();
        expect(commit).toHaveBeenCalledWith("unsaved");
    });

    it("saves unsaved edits when the page is hidden", () => {
        const commit = vi.fn();
        render(<Field committed="" commit={commit} />);
        type("draft");
        window.dispatchEvent(new Event("pagehide"));
        expect(commit).toHaveBeenCalledWith("draft");
    });

    it("follows the committed value when there are no unsaved edits (reset, import)", () => {
        const commit = vi.fn();
        const { rerender } = render(<Field committed="old" commit={commit} />);
        rerender(<Field committed="new" commit={commit} />);
        expect((screen.getByLabelText("field") as HTMLInputElement).value).toBe("new");
    });

    it("does not overwrite what the user is typing when the committed value changes", () => {
        const commit = vi.fn();
        const { rerender } = render(<Field committed="" commit={commit} />);
        type("typing");
        rerender(<Field committed="something else" commit={commit} />);
        expect((screen.getByLabelText("field") as HTMLInputElement).value).toBe("typing");
    });

    it("commitNow replaces the field and saves immediately, without a second save later", () => {
        const commit = vi.fn();
        function WithClear() {
            const draft = useDraftSetting("keep", commit, 400);
            return (
                <>
                    <input
                        aria-label="field"
                        value={draft.value}
                        onChange={(event) => draft.onChange(event.target.value)}
                    />
                    <button onClick={() => draft.commitNow("")}>clear</button>
                </>
            );
        }
        render(<WithClear />);
        type("edited");
        fireEvent.click(screen.getByText("clear"));
        expect(commit).toHaveBeenCalledTimes(1);
        expect(commit).toHaveBeenCalledWith("");
        expect((screen.getByLabelText("field") as HTMLInputElement).value).toBe("");
        act(() => vi.advanceTimersByTime(1_000));
        expect(commit).toHaveBeenCalledTimes(1);
    });
});
