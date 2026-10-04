"use client";

/**
 * Markdown image rendering with a remote-image gate.
 *
 * `data:` and `blob:` sources are local and render directly. A remote
 * http(s) source renders as a click-to-load placeholder first: fetching it
 * would send the user's conversation data (via the URL) to that host, so the
 * user decides per image. The URL itself was already sanitized in
 * `markdown-sanitize.ts` (protocols limited, event handlers stripped).
 */

import { useState, type FC } from "react";

function hostOf(src: string): string {
  try {
    return new URL(src).hostname;
  } catch {
    return "this site";
  }
}

export const MarkdownImage: FC<React.ImgHTMLAttributes<HTMLImageElement> & { node?: unknown }> = ({
  src,
  alt,
  title,
  node: _node,
  className,
  ...props
}) => {
  const [showRemote, setShowRemote] = useState(false);

  if (!src) return null;

  if (/^https?:/i.test(src) && !showRemote) {
    return (
      <button
        type="button"
        onClick={() => setShowRemote(true)}
        className="aui-md-remote-image my-2 inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title={title ?? `Remote image: ${src}`}
      >
        Load image from {hostOf(src)}
      </button>
    );
  }

  return (
    <img src={src} alt={alt ?? ""} title={title} loading="lazy" className={className} {...props} />
  );
};
