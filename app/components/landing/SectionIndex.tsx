export function SectionIndex({ index, label }: { index: string; label: string }) {
    return (
        <p
            aria-hidden
            className="mb-5 text-left font-mono text-[11px] tracking-[0.18em] text-zinc-600"
        >
            {index} / {label}
        </p>
    );
}
