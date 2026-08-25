"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ComposerPrimitive } from "@assistant-ui/react";
import { Paperclip, Plus } from "@phosphor-icons/react";
import { hapticSelect } from "~/lib/haptics";
import { useAnchoredMenu } from "~/lib/use-anchored-menu";
import { cn } from "~/lib/utils";
import { attachmentAcceptHint } from "~/lib/attachments";
import { getAttachmentPolicy } from "~/lib/attachment-policy";
import { getModelModalities } from "~/lib/model-modalities";
import { useSettings } from "~/lib/providers/SettingsProvider";

export function ComposerPlusMenu() {
    const { settings } = useSettings();
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const onDoc = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                !rootRef.current?.contains(target) &&
                !menuRef.current?.contains(target)
            ) {
                setOpen(false);
            }
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDoc);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const menuStyle = useAnchoredMenu(open, triggerRef, menuRef, {
        width: 240,
        maxHeight: 280,
        align: "left",
        zIndex: 100,
    });
    const modalities = getModelModalities(
        settings.chat.model,
        settings.chat.provider,
    );
    const attachmentHint = attachmentAcceptHint(
        modalities,
        getAttachmentPolicy(settings.chat.provider, settings.chat.model),
    );

    return (
        <div ref={rootRef} className="relative shrink-0">
            <button
                ref={triggerRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="Composer extras"
                onClick={() => {
                    hapticSelect();
                    setOpen((value) => !value);
                }}
                className={cn(
                    "hover:bg-muted-foreground/15 dark:border-muted-foreground/15 dark:hover:bg-muted-foreground/30 size-7 rounded-full p-1 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/40 active:scale-[0.96]",
                 )}
            >
                <Plus className="size-4.5" weight="bold" />
            </button>

            {open && menuStyle
                ? createPortal(
                      <div
                          ref={menuRef}
                          style={menuStyle}
                          role="menu"
                          className="overflow-hidden rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl"
                      >
                          <ComposerPrimitive.AddAttachment
                              multiple
                              render={
                                  <button
                                      type="button"
                                      role="menuitem"
                                      title={attachmentHint}
                                      aria-label={attachmentHint}
                                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs outline-none hover:bg-accent"
                                      onClick={() => setOpen(false)}
                                  />
                              }
                          >
                              <Paperclip className="size-3.5 shrink-0" />
                              Attach files
                          </ComposerPrimitive.AddAttachment>
                       </div>,
                      document.body,
                  )
                : null}
        </div>
    );
}
