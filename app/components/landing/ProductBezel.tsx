import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Play, X } from "@phosphor-icons/react";
import { cn } from "~/lib/utils";
import { EASE_OUT } from "./motion";
import { usePrefersReducedMotion } from "./hooks";
import { StatusPill } from "./StatusPill";
import { TiltedCard } from "./TiltedCard";

const DEMO_VIDEO_SRC = "/AI-DIY_DEMO.mp4";

export function ProductBezel({ className }: { className?: string }) {
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const reduced = usePrefersReducedMotion();
    const modalVideoRef = useRef<HTMLVideoElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const titleId = useId();

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!open) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        window.addEventListener("keydown", onKey);
        const t = window.setTimeout(() => closeRef.current?.focus(), 20);
        return () => {
            document.body.style.overflow = prevOverflow;
            window.removeEventListener("keydown", onKey);
            window.clearTimeout(t);
        };
    }, [open]);

    useEffect(() => {
        const video = modalVideoRef.current;
        if (!open || !video) return;
        video.currentTime = 0;
        void video.play().catch(() => {});
        return () => {
            video.pause();
        };
    }, [open]);

    return (
        <div className={cn("w-full", className)} aria-label="Workspace product demo">
            <TiltedCard maxTilt={3}>
                <div className="overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0a0a0a] shadow-[0_48px_120px_-48px_rgba(0,0,0,0.95)]">
                    <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-2.5">
                        <span className="size-2 rounded-full bg-zinc-700" />
                        <span className="size-2 rounded-full bg-zinc-700" />
                        <span className="size-2 rounded-full bg-zinc-700" />
                        <span className="ml-3 font-mono text-[10px] tracking-wide text-zinc-500">
                            ai.diy — workspace
                        </span>
                        <div className="ml-auto flex items-center gap-2">
                            <StatusPill tone="live" pulse>
                                Live
                            </StatusPill>
                            <button
                                type="button"
                                onClick={() => setOpen(true)}
                                className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-2.5 font-mono text-[10px] tracking-wide text-zinc-300 transition-[background-color,border-color,color] duration-200 hover:border-white/25 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                                style={{ transitionTimingFunction: EASE_OUT }}
                            >
                                <Play weight="fill" className="size-3" />
                                Watch demo
                            </button>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="group relative block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/50"
                        aria-label="Play the ai.diy workspace demo fullscreen"
                    >
                        <img
                            src="/workspace-demo.png"
                            alt="ai.diy workspace: local-first chat with model switching and tools"
                            width={1280}
                            height={800}
                            className="block h-auto w-full transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                            style={{ transitionTimingFunction: EASE_OUT }}
                        />
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-[opacity,background-color] duration-200 group-hover:bg-black/30 group-hover:opacity-100 group-focus-visible:bg-black/30 group-focus-visible:opacity-100">
                            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/75 px-4 py-2.5 font-mono text-[11px] text-white shadow-[0_12px_40px_-16px_rgba(0,0,0,0.8)]">
                                <Play weight="fill" className="size-3.5" />
                                Play fullscreen demo
                            </span>
                        </span>
                    </button>
                </div>
            </TiltedCard>
            <p className="mt-4 text-center font-mono text-[10px] tracking-[0.16em] text-zinc-600">
                Real workspace · click to expand
            </p>

            {mounted && open
                ? createPortal(
                      <div
                          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/92 p-2 sm:p-4"
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby={titleId}
                          onClick={() => setOpen(false)}
                      >
                          <h2 id={titleId} className="sr-only">
                              ai.diy workspace demo
                          </h2>
                          <div
                              className="relative flex h-full w-full max-h-[100dvh] max-w-[100vw] items-center justify-center"
                              onClick={(e) => e.stopPropagation()}
                          >
                              <video
                                  ref={modalVideoRef}
                                  src={DEMO_VIDEO_SRC}
                                  autoPlay={!reduced}
                                  controls
                                  playsInline
                                  className="h-full max-h-[100dvh] w-full max-w-[100vw] rounded-none object-contain sm:rounded-2xl"
                              />
                              <button
                                  ref={closeRef}
                                  type="button"
                                  onClick={() => setOpen(false)}
                                  className="absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white transition-colors hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:right-5 sm:top-5"
                                  aria-label="Close fullscreen demo"
                              >
                                  <X weight="light" className="size-5" />
                              </button>
                          </div>
                      </div>,
                      document.body,
                  )
                : null}
        </div>
    );
}
