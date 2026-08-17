export type AskUserRequest = {
    question: string;
    questionType?: "single" | "multiple" | "short";
    options?: string[];
};

export type PendingAsk = AskUserRequest & {
    id: string;
    resolve: (answer: string) => void;
};

const pending = new Map<string, PendingAsk>();
const listeners = new Set<() => void>();

function notify() {
    for (const listener of listeners) listener();
}

export function askUserInChat(
    id: string,
    input: AskUserRequest,
): Promise<string> {
    return new Promise((resolve) => {
        pending.set(id, {
            id,
            question: input.question,
            questionType: input.questionType,
            options: input.options,
            resolve,
        });
        notify();
    });
}

export function getPendingAsk(id: string): PendingAsk | null {
    return pending.get(id) ?? null;
}

export function answerAskUser(id: string, answer: string): void {
    const item = pending.get(id);
    if (!item) return;
    pending.delete(id);
    item.resolve(answer);
    notify();
}

export function skipAskUser(id: string): void {
    answerAskUser(id, "The user skipped this question.");
}

export function subscribeAskUser(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
