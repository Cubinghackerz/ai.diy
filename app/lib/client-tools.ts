export async function askUserInBrowser(input: {
    question: string;
    questionType?: "single" | "multiple" | "short";
    options?: string[];
}): Promise<string> {
    if (typeof window === "undefined") return "The user interface is unavailable.";
    const options = input.options ?? [];
    const prompt = options.length
        ? `${input.question}\n\n${options.map((option, index) => `${index + 1}. ${option}`).join("\n")}\n\n${input.questionType === "multiple" ? "Enter comma-separated option numbers:" : "Enter an option number:"}`
        : input.question;
    return window.prompt(prompt) ?? "The user skipped this question.";
}
