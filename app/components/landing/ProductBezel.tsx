import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { cn } from "~/lib/utils";
import { usePrefersReducedMotion } from "./hooks";
import { HeroWorkspace } from "./HeroWorkspace";
import { TiltedCard } from "./TiltedCard";

const DEMO_VIDEO_SRC = "/AI-DIY_DEMO.mp4";
/** Matches --modal-close-dur in app/styles/app.css. */
const MODAL_CLOSE_MS = 150;

export function ProductBezel({ className }: { className?: string }) {
    const [open, setOpen] = useState(false);
    const [closing, setClosing] = useState(false);
    const [shown, setShown] = useState(false);
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
        const raf = window.requestAnimationFrame(() => setShown(true));
        return () => window.cancelAnimationFrame(raf);
    }, [open]);

    const closeModal = useCallback(() => {
        if (closing) return;
        setClosing(true);
        window.setTimeout(() => {
            setOpen(false);
            setClosing(false);
            setShown(false);
        }, MODAL_CLOSE_MS);
    }, [closing]);

    useEffect(() => {
        if (!open) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") closeModal();
        };
        window.addEventListener("keydown", onKey);
        const t = window.setTimeout(() => closeRef.current?.focus(), 20);
        return () => {
            document.body.style.overflow = prevOverflow;
            window.removeEventListener("keydown", onKey);
            window.clearTimeout(t);
        };
    }, [open, closeModal]);

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
        <div className={cn("w-full", className)}>
            <TiltedCard maxTilt={3}>
                <HeroWorkspace onWatchDemo={() => setOpen(true)} />
            </TiltedCard>
            <p className="mt-4 text-center font-mono text-[10px] tracking-[0.16em] text-zinc-400">
                Illustrative playback with sample data. The real demo is one click away.
            </p>

            {mounted && open
                ? createPortal(
                      <div
                          className={cn(
                              "landing-modal-backdrop fixed inset-0 z-[80] flex items-center justify-center bg-black/92 p-2 sm:p-4",
                              shown && "is-open",
                              closing && "is-closing",
                          )}
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby={titleId}
                          onClick={closeModal}
                      >
                          <h2 id={titleId} className="sr-only">
                              ai.diy workspace demo
                          </h2>
                          <div
                              className={cn(
                                  "t-modal relative flex h-full w-full max-h-[100dvh] max-w-[100vw] items-center justify-center",
                                  shown && "is-open",
                                  closing && "is-closing",
                              )}
                              onClick={(e) => e.stopPropagation()}
                          >
                              <video
                                  ref={modalVideoRef}
                                  src={DEMO_VIDEO_SRC}
                                  autoPlay={!reduced}
                                  controls
                                  playsInline
                                  className="h-full max-h-[100dvh] w-full max-w-[100vw] rounded-none object-contain sm:rounded-[2px]"
                              />
                              <button
                                  ref={closeRef}
                                  type="button"
                                  onClick={closeModal}
                                  className="absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-[2px] border border-white/20 bg-black/70 text-white transition-colors hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:right-5 sm:top-5"
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
