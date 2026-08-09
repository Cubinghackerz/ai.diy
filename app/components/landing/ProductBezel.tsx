import { cn } from "~/lib/utils";
import { DoubleBezel } from "./DoubleBezel";

export function ProductBezel({ className }: { className?: string }) {
    return (
        <div
            className={cn("w-full", className)}
            aria-label="Workspace product demo"
        >
            <DoubleBezel>
                <div className="flex items-center gap-2 border-b border-white/[0.06] bg-[#080808] px-4 py-2.5">
                    <span className="size-2 rounded-full bg-zinc-700" />
                    <span className="size-2 rounded-full bg-zinc-700" />
                    <span className="size-2 rounded-full bg-zinc-700" />
                    <span className="ml-3 font-mono text-[10px] text-zinc-600">
                        ai.diy — workspace
                    </span>
                </div>
                <div className="relative bg-black">
                    <img
                        src="/workspace-demo.gif"
                        alt="ai.diy workspace demo: local-first chat with model switching and tools"
                        width={1280}
                        height={800}
                        className="block h-auto w-full"
                        loading="eager"
                        decoding="async"
                    />
                </div>
            </DoubleBezel>
            <p className="mt-3 text-center font-mono text-[10px] text-zinc-600">
                Product demo
            </p>
        </div>
    );
}
