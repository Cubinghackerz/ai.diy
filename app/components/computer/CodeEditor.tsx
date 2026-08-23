export function CodeEditor({
    value,
    onChange,
    filename,
}: {
    value: string;
    onChange: (next: string) => void;
    filename?: string;
}) {
    return (
        <label className="flex min-h-0 flex-1 flex-col">
            <span className="sr-only">Edit {filename || "file"}</span>
            <textarea
                value={value}
                onChange={(event) => onChange(event.target.value)}
                spellCheck={false}
                className="min-h-40 flex-1 resize-none bg-transparent p-3 font-mono text-[12px] leading-relaxed text-foreground outline-none"
            />
        </label>
    );
}