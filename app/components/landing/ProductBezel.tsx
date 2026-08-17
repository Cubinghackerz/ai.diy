import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Play, X } from "@phosphor-icons/react";
import { cn } from "~/lib/utils";
import { DoubleBezel } from "./DoubleBezel";
import { EASE_OUT } from "./motion";
import { usePrefersReducedMotion } from "./hooks";

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
        void video.play().catch(() => {
            // Native controls remain available when autoplay is blocked.
        });
        return () => {
            video.pause();
        };
    }, [open]);

    return (
        <div className={cn("w-full", className)} aria-label="Workspace product demo">
            <DoubleBezel>
                <div className="flex items-center gap-2 border-b border-white/[0.08] bg-[#0c0c0f] px-4 py-2.5">
                    <span className="size-2 rounded-full bg-zinc-600" />
                    <span className="size-2 rounded-full bg-zinc-600" />
                    <span className="size-2 rounded-full bg-zinc-600" />
                    <span className="ml-3 font-mono text-[10px] text-zinc-500">
                        ai.diy — workspace
                    </span>
                </div>
                <div className="group relative bg-[#09090b]">
                    <video
                        src={DEMO_VIDEO_SRC}
                        poster="/workspace-demo.png"
                        aria-label="ai.diy workspace demo: local-first chat with model switching and tools"
                        width={1280}
                        height={800}
                        className="block h-auto w-full object-cover"
                        preload="metadata"
                        autoPlay={!reduced}
                        muted
                        loop={!reduced}
                        playsInline
                    />
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition-[opacity,background-color] duration-200 hover:bg-black/25 hover:opacity-100 focus-visible:bg-black/25 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70 group-hover:bg-black/25 group-hover:opacity-100 group-focus-within:bg-black/25 group-focus-within:opacity-100"
                        aria-label="Play the ai.diy workspace demo fullscreen"
                        style={{ transitionTimingFunction: EASE_OUT }}
                    >
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/70 px-4 py-2.5 font-mono text-[11px] shadow-[0_12px_40px_-16px_rgba(255,255,255,0.55)] backdrop-blur-sm transition-transform duration-200 group-hover:scale-[1.04]">
                            <Play weight="fill" className="size-3.5" />
                            Play fullscreen demo
                        </span>
                    </button>
                </div>
            </DoubleBezel>
            <p className="mt-3 text-center font-mono text-[10px] tracking-wide text-zinc-600">
                Workspace demo · click to expand
            </p>

            {mounted && open
                ? createPortal(
                      <div
                          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/92 p-2 backdrop-blur-md sm:p-4"
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
                                  autoPlay
                                  controls
                                  playsInline
                                  className="h-full max-h-[100dvh] w-full max-w-[100vw] rounded-none object-contain sm:rounded-2xl"
                              />
                              <button
                                  ref={closeRef}
                                  type="button"
                                  onClick={() => setOpen(false)}
                                  className="absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white backdrop-blur-md transition-colors hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:right-5 sm:top-5"
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
