import { useRef, type PointerEvent } from "react";
import { Lock, MagnifyingGlass, ArrowsClockwise, Stack } from "@phosphor-icons/react";
import { DoubleBezel, Reveal } from "./DoubleBezel";
import { EASE_OUT } from "./motion";
import { cn } from "~/lib/utils";

const CELLS = [
    {
        icon: Lock,
        title: "Private by posture",
        body: "Keys in browser storage. Chats and artifacts in IndexedDB. No server-side LLM credentials.",
        span: "md:col-span-7 md:row-span-2",
    },
    {
        icon: MagnifyingGlass,
        title: "Web search out of the box",
        body: "Firecrawl and Parallel MCP ship keyless so research works on day one.",
        span: "md:col-span-5",
    },
    {
        icon: ArrowsClockwise,
        title: "Switch mid-thread",
        body: "Change provider or model on the same conversation — context stays put.",
        span: "md:col-span-5",
    },
    {
        icon: Stack,
        title: "Artifacts that stay attached",
        body: "Code and UI previews open in Canvas beside the thread — not lost in a disposable tab.",
        span: "md:col-span-12",
    },
] as const;

function LitCell({
    icon: Icon,
    title,
    body,
    span,
}: (typeof CELLS)[number]) {
    const ref = useRef<HTMLElement>(null);

    const onMove = (e: PointerEvent) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${((e.clientX - rect.left) / rect.width) * 100}%`);
        el.style.setProperty("--my", `${((e.clientY - rect.top) / rect.height) * 100}%`);
    };

    return (
        <article
            ref={ref}
            onPointerMove={onMove}
            className={cn(
                "group relative overflow-hidden rounded-[1.25rem] border border-white/[0.08] bg-[#0A0A0A] p-6 transition-[border-color] duration-200 sm:p-7",
                "before:pointer-events-none before:absolute before:inset-0 before:opacity-0 before:transition-opacity before:duration-200 before:content-[''] group-hover:before:opacity-100",
                "before:bg-[radial-gradient(420px_circle_at_var(--mx,50%)_var(--my,50%),rgba(255,255,255,0.06),transparent_55%)]",
                span,
            )}
            style={{ transitionTimingFunction: EASE_OUT }}
        >
            <Icon weight="light" className="relative size-5 text-zinc-500" />
            <h3 className="relative mt-4 text-[15px] font-medium tracking-tight text-white sm:text-base">
                {title}
            </h3>
            <p className="relative mt-2 max-w-md text-[13px] leading-relaxed text-zinc-500 sm:text-[14px]">
                {body}
            </p>
        </article>
    );
}

export function OwnershipBento() {
    return (
        <section
            id="features"
            className="mx-auto max-w-6xl scroll-mt-28 px-5 py-24 sm:px-8 sm:py-28"
            data-anim-gate="features"
        >
            <Reveal>
                <h2 className="max-w-[16ch] text-3xl font-medium tracking-[-0.035em] text-white sm:text-4xl">
                    Built for ownership, not lock-in.
                </h2>
                <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-zinc-500 sm:text-[15px]">
                    Privacy posture, bundled search, mid-thread model switching, and Canvas
                    artifacts that stay with the work.
                </p>
            </Reveal>

            <Reveal delayMs={40} className="mt-12">
                <DoubleBezel
                    padding="p-1.5"
                    outerRadius="rounded-[2rem]"
                    innerRadius="rounded-[calc(2rem-0.375rem)]"
                    innerClassName="bg-transparent border-0 shadow-none"
                >
                    <div className="grid grid-cols-1 gap-2 bg-[#050505] p-2 md:grid-cols-12">
                        {CELLS.map((cell) => (
                            <LitCell key={cell.title} {...cell} />
                        ))}
                    </div>
                </DoubleBezel>
            </Reveal>
        </section>
    );
}
