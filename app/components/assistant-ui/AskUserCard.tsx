import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import {
    answerAskUser,
    getPendingAsk,
    skipAskUser,
    subscribeAskUser,
} from "~/lib/ask-user";
import { cn } from "~/lib/utils";

export function AskUserCard({ toolCallId }: { toolCallId: string }) {
    const [, setTick] = useState(0);
    const [draft, setDraft] = useState("");
    const [selected, setSelected] = useState<string[]>([]);
    const pending = getPendingAsk(toolCallId);

    useEffect(() => subscribeAskUser(() => setTick((value) => value + 1)), []);

    if (!pending) return null;

    const options = pending.options ?? [];
    const type = pending.questionType ?? (options.length ? "single" : "short");

    const toggle = (option: string) => {
        setSelected((current) =>
            type === "multiple"
                ? current.includes(option)
                    ? current.filter((item) => item !== option)
                    : [...current, option]
                : [option],
        );
    };

    const submit = () => {
        if (type === "short") {
            const answer = draft.trim();
            if (!answer) return;
            answerAskUser(toolCallId, answer);
            return;
        }
        if (selected.length === 0) return;
        answerAskUser(toolCallId, selected.join(", "));
    };

    return (
        <div className="mt-2 max-w-xl rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
            <p className="text-sm font-medium leading-relaxed text-foreground">
                {pending.question}
            </p>
            {options.length > 0 && type !== "short" ? (
                <div className="mt-3 flex flex-col gap-1.5">
                    {options.map((option) => {
                        const active = selected.includes(option);
                        return (
                            <button
                                key={option}
                                type="button"
                                onClick={() => toggle(option)}
                                className={cn(
                                    "rounded-xl border px-3 py-2 text-left text-sm outline-none transition-colors",
                                    active
                                        ? "border-primary/40 bg-primary/10 text-foreground"
                                        : "border-border/70 text-muted-foreground hover:bg-accent hover:text-foreground",
                                )}
                            >
                                {option}
                            </button>
                        );
                    })}
                </div>
            ) : (
                <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Type your answer…"
                    rows={3}
                    className="mt-3 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
                />
            )}
            <div className="mt-3 flex items-center justify-end gap-2">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => skipAskUser(toolCallId)}
                >
                    Skip
                </Button>
                <Button type="button" size="sm" onClick={submit}>
                    Send answer
                </Button>
            </div>
        </div>
    );
}
