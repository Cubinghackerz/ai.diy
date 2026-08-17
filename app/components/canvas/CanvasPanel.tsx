/**
 * CanvasPanel — Slide-out side panel for interactive artifacts
 *
 * Supports:
 * - HTML interactive previews inside sandboxed iframe
 * - Inline image previews for Python / binary image artifacts
 * - Python code & execution stdout viewer
 * - Code & file downloads (CSV, Markdown, JSON, SVG)
 */

import { useCanvas, type Artifact } from "~/lib/canvas";
import {
    decodeArtifactContent,
    isImageMimeType,
    preparePreviewDocument,
} from "~/lib/artifacts";
import {
    X,
    Download,
    Code,
    Eye,
    FileText,
    Check,
    Copy,
    Image as ImageIcon,
} from "@phosphor-icons/react";
import { useState, useRef, useEffect, useMemo } from "react";
import { BorderBeam } from "~/components/ui/border-beam";

function isImageArtifact(artifact: Artifact | undefined | null): boolean {
    if (!artifact) return false;
    if (isImageMimeType(artifact.mimeType)) return true;
    return Boolean(artifact.filename?.match(/\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i));
}

function isHtmlArtifact(artifact: Artifact | undefined | null): boolean {
    if (!artifact) return false;
    if (artifact.kind === "html") return true;
    if (artifact.mimeType && /text\/html/i.test(artifact.mimeType)) return true;
    return Boolean(artifact.filename?.match(/\.html?$/i));
}

function artifactHtmlSource(artifact: Artifact): string | null {
    if (artifact.contentEncoding) {
        const binary = decodeArtifactContent(artifact.content, artifact.contentEncoding);
        if (!binary) return null;
        return new TextDecoder().decode(binary);
    }
    return artifact.content;
}

function ArtifactImagePreview({ artifact }: { artifact: Artifact }) {
    const [failed, setFailed] = useState(false);
    const objectUrl = useMemo(() => {
        if (typeof URL === "undefined") return null;
        const mime = artifact.mimeType || "image/png";

        if (artifact.contentEncoding) {
            const binary = decodeArtifactContent(artifact.content, artifact.contentEncoding);
            if (!binary) return null;
            return URL.createObjectURL(new Blob([binary], { type: mime }));
        }

        // Text SVG (or other image markup) saved without binary encoding.
        if (mime === "image/svg+xml" || artifact.filename?.toLowerCase().endsWith(".svg")) {
            return URL.createObjectURL(
                new Blob([artifact.content], { type: "image/svg+xml" }),
            );
        }

        if (/^data:image\//i.test(artifact.content.trim())) {
            return artifact.content.trim();
        }

        return null;
    }, [artifact.content, artifact.contentEncoding, artifact.filename, artifact.mimeType]);

    useEffect(() => {
        return () => {
            if (objectUrl && objectUrl.startsWith("blob:")) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [objectUrl]);

    if (!objectUrl || failed) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card p-6 text-center">
                <ImageIcon size={28} className="text-muted-foreground" />
                <p className="text-sm font-medium">Image preview unavailable</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                    Use Download to save the original file.
                </p>
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-[12rem] items-center justify-center overflow-auto rounded-xl border border-border bg-[radial-gradient(circle_at_1px_1px,rgba(127,127,127,0.18)_1px,transparent_0)] bg-size-[12px_12px] p-6">
            <img
                src={objectUrl}
                alt={artifact.title || artifact.filename || "Generated image"}
                className="max-h-full max-w-full object-contain shadow-sm"
                onError={() => setFailed(true)}
            />
        </div>
    );
}

export function CanvasPanel() {
    const { artifacts, activeArtifactId, canvasOpen, closeCanvas, setActiveArtifactId, canvasWidth, setCanvasWidth } = useCanvas();
    const [viewMode, setViewMode] = useState<"preview" | "code">("preview");
    const [copied, setCopied] = useState(false);
    const [downloadError, setDownloadError] = useState<string | null>(null);
    const [isResizing, setIsResizing] = useState(false);
    const [glowingArtifactId, setGlowingArtifactId] = useState<string | null>(null);
    const panelRef = useRef<HTMLElement>(null);
    const startXRef = useRef(0);
    const startWidthRef = useRef(0);

    useEffect(() => {
        setViewMode("preview");
        setDownloadError(null);
        setCopied(false);
    }, [activeArtifactId]);

    useEffect(() => {
        const artifact = artifacts.find((item) => item.id === activeArtifactId);
        if (!artifact || Date.now() - artifact.createdAt > 10_000) return;
        setGlowingArtifactId(artifact.id);
        const timeout = window.setTimeout(() => {
            setGlowingArtifactId((current) =>
                current === artifact.id ? null : current,
            );
        }, 1800);
        return () => window.clearTimeout(timeout);
    }, [activeArtifactId]);

    const handleResizeStart = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
        startXRef.current = e.clientX;
        startWidthRef.current = canvasWidth;
    };

    const handleResizeKeyDown = (e: React.KeyboardEvent) => {
        const step = e.shiftKey ? 64 : 16;
        const maxWidth =
            typeof window === "undefined" ? 640 : Math.round(window.innerWidth * 0.5);
        if (e.key === "ArrowLeft") {
            e.preventDefault();
            setCanvasWidth(canvasWidth - step);
        } else if (e.key === "ArrowRight") {
            e.preventDefault();
            setCanvasWidth(canvasWidth + step);
        } else if (e.key === "Home") {
            e.preventDefault();
            setCanvasWidth(320);
        } else if (e.key === "End") {
            e.preventDefault();
            setCanvasWidth(maxWidth);
        }
    };

    useEffect(() => {
        if (!isResizing) return;
        const handleMouseMove = (e: MouseEvent) => {
            const delta = startXRef.current - e.clientX;
            setCanvasWidth(startWidthRef.current + delta);
        };
        const handleMouseUp = () => setIsResizing(false);
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isResizing, setCanvasWidth]);

    if (!canvasOpen || !artifacts.length) return null;

    const activeArtifact = artifacts.find((a) => a.id === activeArtifactId) ?? artifacts[artifacts.length - 1];
    const artifactIsFresh = glowingArtifactId === activeArtifact?.id;
    const showImagePreview = isImageArtifact(activeArtifact);
    const showHtmlPreview =
        Boolean(activeArtifact) &&
        isHtmlArtifact(activeArtifact) &&
        viewMode === "preview";
    const htmlSource = showHtmlPreview && activeArtifact
        ? artifactHtmlSource(activeArtifact)
        : null;

    const handleDownload = () => {
        if (!activeArtifact) return;
        const binary = decodeArtifactContent(
            activeArtifact.content,
            activeArtifact.contentEncoding,
        );
        if (activeArtifact.contentEncoding && !binary) {
            setDownloadError("The artifact bytes are invalid. Regenerate the file before downloading it.");
            return;
        }
        setDownloadError(null);
        const blob = new Blob([binary ?? activeArtifact.content], {
            type: activeArtifact.mimeType || "text/plain;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = activeArtifact.filename || `${activeArtifact.title.toLowerCase().replace(/\s+/g, "_")}.${activeArtifact.kind === "html" ? "html" : "txt"}`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleCopy = () => {
        if (!activeArtifact) return;
        navigator.clipboard.writeText(activeArtifact.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <aside
            ref={panelRef}
            className={`relative z-40 flex h-full shrink-0 flex-col border-l border-border bg-card shadow-2xl animate-slide-up ${isResizing ? "transition-none" : "transition-[width] duration-200"}`}
            style={{ width: canvasWidth, maxWidth: "50vw" }}
        >
            {/* Resize handle */}
            <div
                className="absolute top-0 left-0 h-full w-1.5 cursor-col-resize touch-none"
                onMouseDown={handleResizeStart}
                onKeyDown={handleResizeKeyDown}
                role="separator"
                aria-label="Resize artifact panel"
                aria-orientation="vertical"
                aria-valuemin={320}
                aria-valuemax={Math.round(
                    typeof window === "undefined" ? 640 : window.innerWidth * 0.5,
                )}
                aria-valuenow={Math.round(canvasWidth)}
                tabIndex={0}
                title="Drag or use arrow keys to resize"
                style={{ zIndex: 1 }}
            >
                <div
                    className={`h-full w-full rounded-r-sm transition-colors ${
                        isResizing ? "bg-accent" : "hover:bg-accent/50"
                    }`}
                />
            </div>

            {/* Header */}
            <div className="flex h-13 items-center justify-between border-b border-border px-4 pl-[8px]">
                <div className="flex items-center gap-2 overflow-hidden">
                    <span className="truncate text-sm font-semibold">{activeArtifact?.title || "Canvas Artifact"}</span>
                    {activeArtifact?.filename && (
                        <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                            {activeArtifact.filename}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1.5">
                    {/* View mode toggle for HTML */}
                    {activeArtifact && isHtmlArtifact(activeArtifact) && (
                        <div className="flex items-center rounded-lg border border-border bg-secondary/50 p-0.5">
                            <button
                                onClick={() => setViewMode("preview")}
                                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
                                    viewMode === "preview" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                                }`}
                            >
                                <Eye size={12} />
                                <span>Preview</span>
                            </button>
                            <button
                                onClick={() => setViewMode("code")}
                                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
                                    viewMode === "code" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                                }`}
                            >
                                <Code size={12} />
                                <span>Code</span>
                            </button>
                        </div>
                    )}

                    <button
                        onClick={handleCopy}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                        title="Copy content"
                    >
                        {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                    </button>

                    <button
                        onClick={handleDownload}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                        title="Download file"
                    >
                        <Download size={14} />
                    </button>

                    <button
                        onClick={closeCanvas}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                        title="Close panel"
                    >
                        <X size={15} />
                    </button>
                </div>
            </div>

            {/* Artifact Tab Bar (if multiple) */}
            {artifacts.length > 1 && (
                <div className="flex items-center gap-1 border-b border-border bg-secondary/30 px-3 py-1.5 overflow-x-auto">
                    {artifacts.map((art) => (
                        <button
                            key={art.id}
                            onClick={() => setActiveArtifactId(art.id)}
                            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                                art.id === (activeArtifactId ?? activeArtifact?.id)
                                    ? "bg-card text-foreground shadow-sm"
                                    : "text-muted-foreground hover:bg-accent"
                            }`}
                        >
                            {isImageArtifact(art) ? <ImageIcon size={12} /> : <FileText size={12} />}
                            <span className="max-w-[100px] truncate">{art.title}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Body — key forces remount so iframe/image state tracks the active tab */}
            <div
                key={activeArtifact?.id ?? "empty"}
                className="relative flex-1 overflow-auto bg-background p-4"
            >
                <BorderBeam
                    active={artifactIsFresh}
                    className="aidiy-border-beam-on-card aidiy-artifact-beam"
                    duration={3.5}
                />
                {downloadError ? (
                    <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
                        {downloadError}
                    </p>
                ) : null}
                {showHtmlPreview && htmlSource ? (
                    <iframe
                        srcDoc={preparePreviewDocument(htmlSource)}
                        title={activeArtifact?.title}
                        className="h-full w-full rounded-xl border border-border bg-white shadow-sm"
                        sandbox="allow-scripts allow-modals allow-popups allow-popups-to-escape-sandbox"
                        referrerPolicy="no-referrer"
                    />
                ) : activeArtifact?.kind === "python" ? (
                    <div className="space-y-4">
                        <div>
                            <div className="mb-1 text-xs font-semibold text-muted-foreground">Python Source Code</div>
                            <pre className="overflow-x-auto rounded-xl border border-border bg-card p-4 font-mono text-xs text-foreground">
                                <code>{activeArtifact.content}</code>
                            </pre>
                        </div>
                        {activeArtifact.output && (
                            <div>
                                <div className="mb-1 text-xs font-semibold text-muted-foreground">Console Execution Output</div>
                                <pre className="overflow-x-auto rounded-xl border border-border bg-secondary/80 p-4 font-mono text-xs text-foreground">
                                    <code>{activeArtifact.output}</code>
                                </pre>
                            </div>
                        )}
                    </div>
                ) : showImagePreview && activeArtifact ? (
                    <ArtifactImagePreview artifact={activeArtifact} />
                ) : activeArtifact?.contentEncoding ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card p-6 text-center">
                        <FileText size={28} className="text-muted-foreground" />
                        <p className="text-sm font-medium">Binary file ready</p>
                        <p className="max-w-xs text-xs text-muted-foreground">
                            Use Download to save the original file without converting its bytes.
                        </p>
                    </div>
                ) : (
                    <pre className="h-full w-full overflow-auto rounded-xl border border-border bg-card p-4 font-mono text-xs text-foreground leading-relaxed">
                        <code>{activeArtifact?.content}</code>
                    </pre>
                )}
            </div>
        </aside>
    );
}
