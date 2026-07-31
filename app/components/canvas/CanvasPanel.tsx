/**
 * CanvasPanel — Slide-out side panel for interactive artifacts
 *
 * Supports:
 * - HTML interactive previews inside sandboxed iframe
 * - Python code & execution stdout viewer
 * - Code & file downloads (CSV, Markdown, JSON, SVG)
 */

import { useCanvas } from "~/lib/canvas";
import { X, Download, Code, Play, Eye, FileText, Check, Copy } from "@phosphor-icons/react";
import { useState, useRef, useEffect } from "react";

export function CanvasPanel() {
    const { artifacts, activeArtifactId, canvasOpen, closeCanvas, setActiveArtifactId, canvasWidth, setCanvasWidth } = useCanvas();
    const [viewMode, setViewMode] = useState<"preview" | "code">("preview");
    const [copied, setCopied] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const panelRef = useRef<HTMLElement>(null);
    const startXRef = useRef(0);
    const startWidthRef = useRef(0);

    const handleResizeStart = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
        startXRef.current = e.clientX;
        startWidthRef.current = canvasWidth;
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

    const handleDownload = () => {
        if (!activeArtifact) return;
        const blob = new Blob([activeArtifact.content], {
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
            className={`fixed inset-y-0 right-0 z-40 flex flex-col border-l border-border bg-card shadow-2xl animate-slide-up`}
            style={{ width: canvasWidth, maxWidth: "50vw" }}
        >
            {/* Resize handle */}
            <div
                className="absolute top-0 left-0 h-full w-1.5 cursor-col-resize touch-none"
                onMouseDown={handleResizeStart}
                style={{ zIndex: 1 }}
            >
                <div className={`h-full w-full rounded-r-sm transition-colors ${
                    isResizing ? "bg-accent" : "hover:bg-accent/50"
                }`}></div>
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
                    {activeArtifact?.kind === "html" && (
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
                                art.id === activeArtifact?.id
                                    ? "bg-card text-foreground shadow-sm"
                                    : "text-muted-foreground hover:bg-accent"
                            }`}
                        >
                            <FileText size={12} />
                            <span className="max-w-[100px] truncate">{art.title}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-auto bg-background p-4">
                {activeArtifact?.kind === "html" && viewMode === "preview" ? (
                    <iframe
                        srcDoc={activeArtifact.content}
                        title={activeArtifact.title}
                        className="h-full w-full rounded-xl border border-border bg-white shadow-sm"
                        sandbox="allow-scripts allow-modals"
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
                ) : (
                    <pre className="h-full w-full overflow-auto rounded-xl border border-border bg-card p-4 font-mono text-xs text-foreground leading-relaxed">
                        <code>{activeArtifact?.content}</code>
                    </pre>
                )}
            </div>
        </aside>
    );
}
