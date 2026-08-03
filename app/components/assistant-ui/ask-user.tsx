"use client";

/**
 * AskUser — in-app ask_user panel.
 *
 * When the model calls `ask_user`, the browser shows an interactive popup
 * card (single choice, multi-select, or short answer) instead of the native
 * prompt dialog. The model's tool call stays pending until the user answers
 * or skips the question.
 */

import { Check, HelpCircle, X } from "lucide-react";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
    type ReactNode,
} from "react";
import { cn } from "~/lib/utils";

export type AskUserQuestionType = "single" | "multiple" | "short";

export type AskUserQuestionStatus = "pending" | "answered" | "skipped";

export type AskUserQuestion = {
    id: string;
    question: string;
    questionType: AskUserQuestionType;
    options?: string[];
    status: AskUserQuestionStatus;
};

type AskUserContextValue = {
    questions: AskUserQuestion[];
    ask: (
        question: string,
        questionType?: AskUserQuestionType,
        options?: string[],
    ) => Promise<string>;
    answer: (id: string, value: string) => void;
    skip: (id: string) => void;
};

const AskUserContext = createContext<AskUserContextValue | null>(null);

export function AskUserProvider({ children }: { children: ReactNode }) {
    const [questions, setQuestions] = useState<AskUserQuestion[]>([]);
    const resolversRef = useRef(new Map<string, (value: string) => void>());

    const settle = useCallback(
        (id: string, value: string, status: AskUserQuestionStatus) => {
            resolversRef.current.get(id)?.(value);
            resolversRef.current.delete(id);
            setQuestions((current) =>
                current.map((q) => (q.id === id ? { ...q, status } : q)),
            );
            window.setTimeout(() => {
                setQuestions((current) => current.filter((q) => q.id !== id));
            }, 1200);
        },
        [],
    );

    const ask = useCallback(
        (
            question: string,
            questionType: AskUserQuestionType = "short",
            options?: string[],
        ) => {
            return new Promise<string>((resolve) => {
                const id = `ask_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                resolversRef.current.set(id, resolve);
                setQuestions((current) => [
                    ...current,
                    { id, question, questionType, options, status: "pending" },
                ]);
            });
        },
        [],
    );

    const answer = useCallback(
        (id: string, value: string) => settle(id, value, "answered"),
        [settle],
    );

    const skip = useCallback(
        (id: string) => settle(id, "The user skipped this question.", "skipped"),
        [settle],
    );

    const value = useMemo<AskUserContextValue>(
        () => ({ questions, ask, answer, skip }),
        [questions, ask, answer, skip],
    );

    return (
        <AskUserContext.Provider value={value}>
            {children}
            <AskUserPopup />
        </AskUserContext.Provider>
    );
}

export function useAskUser() {
    const ctx = useContext(AskUserContext);
    if (!ctx) throw new Error("useAskUser requires AskUserProvider");
    return ctx;
}

const STATUS_LABEL: Record<AskUserQuestionStatus, string> = {
    pending: "Question",
    answered: "Answered",
    skipped: "Skipped",
};

function AskUserPopup() {
    const { questions } = useAskUser();
    if (questions.length === 0) return null;
    return (
        <div className="fixed bottom-4 right-4 z-50 flex w-[21rem] max-w-[calc(100vw-2rem)] flex-col gap-2">
            {questions.map((question) => (
                <AskUserCard key={question.id} question={question} />
            ))}
        </div>
    );
}

function AskUserCard({ question }: { question: AskUserQuestion }) {
    const { answer, skip } = useAskUser();
    const [single, setSingle] = useState<string | null>(null);
    const [multiple, setMultiple] = useState<string[]>([]);
    const [text, setText] = useState("");
    const options = question.options ?? [];
    const pending = question.status === "pending";

    useEffect(() => {
        if (!pending) return;
        const targetId =
            question.questionType === "short" || options.length === 0
                ? `ask-user-text-${question.id}`
                : `ask-user-option-${question.id}-0`;
        document.getElementById(targetId)?.focus();
    }, [pending, question.id, question.questionType, options.length]);

    const canSubmit =
        question.questionType === "single"
            ? single !== null
            : question.questionType === "multiple"
              ? multiple.length > 0
              : text.trim().length > 0;

    const submit = () => {
        if (!pending) return;
        const value =
            question.questionType === "single"
                ? single ?? ""
                : question.questionType === "multiple"
                  ? multiple.join(", ")
                  : text.trim();
        if (!value) return;
        answer(question.id, value);
    };

    const toggleOption = (option: string) => {
        if (question.questionType === "single") {
            setSingle(option);
        } else {
            setMultiple((current) =>
                current.includes(option)
                    ? current.filter((o) => o !== option)
                    : [...current, option],
            );
        }
    };

    const onCardKeyDown = (event: ReactKeyboardEvent) => {
        if (event.key === "Escape") {
            event.preventDefault();
            if (pending) skip(question.id);
        }
    };

    return (
        <div className="overflow-hidden rounded-xl border border-border/80 bg-background shadow-lg">
            <div className="flex items-center gap-2 px-3 py-2">
                <HelpCircle
                    size={14}
                    className={cn(
                        "shrink-0",
                        pending
                            ? "text-primary"
                            : question.status === "answered"
                              ? "text-success"
                              : "text-muted-foreground",
                    )}
                />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                    {STATUS_LABEL[question.status]}
                </span>
                <span
                    className={cn(
                        "shrink-0 text-[10px]",
                        pending
                            ? "text-warning"
                            : question.status === "answered"
                              ? "text-success"
                              : "text-muted-foreground",
                    )}
                >
                    {pending ? "Answer required" : question.status}
                </span>
            </div>

            <div
                className="border-t border-border/60 px-3 py-2"
                onKeyDown={onCardKeyDown}
            >
                <p className="mb-2 whitespace-pre-wrap text-[11px] leading-relaxed text-foreground">
                    {question.question}
                </p>

                {pending ? (
                    <div className="flex flex-col gap-1.5">
                        {question.questionType === "short" || options.length === 0 ? (
                            <textarea
                                id={`ask-user-text-${question.id}`}
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        submit();
                                    }
                                }}
                                rows={2}
                                placeholder="Type your answer…"
                                className="w-full resize-none rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
                            />
                        ) : (
                            <div className="flex max-h-44 flex-col gap-1 overflow-y-auto">
                                {options.map((option, index) => {
                                    const checked =
                                        question.questionType === "single"
                                            ? single === option
                                            : multiple.includes(option);
                                    return (
                                        <label
                                            key={option}
                                            htmlFor={`ask-user-option-${question.id}-${index}`}
                                            className={cn(
                                                "flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-[11px]",
                                                checked
                                                    ? "border-primary/40 bg-primary/10 text-foreground"
                                                    : "border-border text-foreground hover:bg-accent/50",
                                            )}
                                        >
                                            <input
                                                id={`ask-user-option-${question.id}-${index}`}
                                                type={
                                                    question.questionType === "single"
                                                        ? "radio"
                                                        : "checkbox"
                                                }
                                                name={
                                                    question.questionType === "single"
                                                        ? `ask-user-${question.id}`
                                                        : undefined
                                                }
                                                checked={checked}
                                                onChange={() => toggleOption(option)}
                                                className="size-3 shrink-0 accent-primary"
                                            />
                                            <span className="min-w-0 flex-1">
                                                {option}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}

                        <div className="flex gap-1.5 pt-0.5">
                            <button
                                type="button"
                                onClick={() => skip(question.id)}
                                className="flex-1 rounded-lg border border-border px-2 py-1.5 text-[11px] font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground"
                            >
                                Skip
                            </button>
                            <button
                                type="button"
                                onClick={submit}
                                disabled={!canSubmit}
                                className="flex-1 rounded-lg bg-primary px-2 py-1.5 text-[11px] font-semibold text-primary-foreground outline-none hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Answer
                            </button>
                        </div>
                    </div>
                ) : (
                    <p
                        className={cn(
                            "flex items-center gap-1.5 text-[11px]",
                            question.status === "answered"
                                ? "text-success"
                                : "text-muted-foreground",
                        )}
                    >
                        {question.status === "answered" ? (
                            <Check size={12} className="shrink-0" />
                        ) : (
                            <X size={12} className="shrink-0" />
                        )}
                        {question.status === "answered"
                            ? "Answered"
                            : "Skipped"}
                    </p>
                )}
            </div>
        </div>
    );
}
