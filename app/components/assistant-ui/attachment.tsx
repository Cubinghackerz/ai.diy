"use client";

import {
  type PropsWithChildren,
  useEffect,
  useState,
  type FC,
  isValidElement,
} from "react";
import {
  XIcon,
  PlusIcon,
  FileText,
  Loader2Icon,
  AlertCircleIcon,
} from "lucide-react";
import {
  AttachmentPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  useAuiState,
  useAui,
} from "@assistant-ui/react";
import { useShallow } from "zustand/shallow";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { TooltipIconButton } from "~/components/assistant-ui/tooltip-icon-button";
import { cn } from "~/lib/utils";
import { attachmentAcceptHint } from "~/lib/attachments";
import { getModelModalities } from "~/lib/model-modalities";
import { useSettings } from "~/lib/providers/SettingsProvider";

const useFileSrc = (file: File | undefined) => {
  const [src, setSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!file) {
      setSrc(undefined);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setSrc(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  return src;
};

const useAttachmentSrc = () => {
  const { file, src } = useAuiState(
    useShallow((s): { file?: File; src?: string } => {
      if (s.attachment.type !== "image") return {};
      if (s.attachment.file) return { file: s.attachment.file };
      const src = s.attachment.content?.filter((c) => c.type === "image")[0]
        ?.image;
      if (!src) return {};
      return { src };
    }),
  );

  return useFileSrc(file) ?? src;
};

type AttachmentPreviewProps = {
  src: string;
};

const AttachmentPreview: FC<AttachmentPreviewProps> = ({ src }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  return (
    <img
      src={src}
      alt="Attachment preview"
      className={cn(
        "block h-auto max-h-[80vh] w-auto max-w-full rounded-sm object-contain transition-opacity duration-300 motion-reduce:transition-none",
        isLoaded
          ? "aui-attachment-preview-image-loaded opacity-100"
          : "aui-attachment-preview-image-loading opacity-0",
      )}
      onLoad={() => setIsLoaded(true)}
    />
  );
};

const AttachmentPreviewDialog: FC<PropsWithChildren> = ({ children }) => {
  const src = useAttachmentSrc();

  if (!src) return children;

  return (
    <Dialog>
      <DialogTrigger
        nativeButton={false}
        className="aui-attachment-preview-trigger cursor-zoom-in"
        render={isValidElement(children) ? children : <button type="button" />}
      />
      <DialogContent className="aui-attachment-preview-dialog-content [&>button]:bg-foreground/60 [&>button]:hover:bg-foreground/80 [&_svg]:text-background p-2 sm:max-w-3xl [&>button]:rounded-full [&>button]:p-1 [&>button]:opacity-100 [&>button]:ring-0!">
        <DialogTitle className="aui-sr-only sr-only">
          Image Attachment Preview
        </DialogTitle>
        <div className="aui-attachment-preview bg-background relative mx-auto flex max-h-[80dvh] w-full items-center justify-center overflow-hidden rounded-sm">
          <AttachmentPreview src={src} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

const AttachmentThumb: FC = () => {
  const src = useAttachmentSrc();

  return (
    <Avatar className="aui-attachment-tile-avatar h-full w-full rounded-none after:hidden">
      <AvatarImage
        src={src}
        alt="Attachment preview"
        className="aui-attachment-tile-image object-cover"
      />
      <AvatarFallback>
        <FileText className="aui-attachment-tile-fallback-icon text-muted-foreground/80 size-6 stroke-[1.5]" />
      </AvatarFallback>
    </Avatar>
  );
};

const AttachmentUI: FC = () => {
  const aui = useAui();
  const isComposer = aui.attachment.source !== "message";

  const isImage = useAuiState((s) => s.attachment.type === "image");
  const typeLabel = useAuiState((s) => {
    const type = s.attachment.type;
    switch (type) {
      case "image":
        return "Image";
      case "document":
        return "Document";
      case "file":
        return "File";
      default:
        return type;
    }
  });

  const uploadState = useAuiState((s) =>
    s.attachment.status.type === "running"
      ? "uploading"
      : s.attachment.status.type === "incomplete" &&
          s.attachment.status.reason === "error"
        ? "error"
        : undefined,
  );
  const isUploading = uploadState === "uploading";
  const isError = uploadState === "error";

  const errorMessage = useAuiState((s) =>
    s.attachment.status.type === "incomplete" &&
    s.attachment.status.reason === "error"
      ? (s.attachment.status.message ?? "Upload failed")
      : undefined,
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <AttachmentPrimitive.Root
          className={cn(
            "aui-attachment-root relative",
            isComposer &&
              "animate-in fade-in-0 zoom-in-95 duration-200 motion-reduce:animate-none",
            isImage &&
              !isComposer &&
              "aui-attachment-root-message only:*:first:size-24",
          )}
        >
          <AttachmentPreviewDialog>
            <TooltipTrigger
              render={
                <div
                  className={cn(
                    "aui-attachment-tile bg-muted hover:after:bg-foreground/10 focus-visible:ring-ring/50 relative size-14 cursor-pointer overflow-hidden rounded-[calc(var(--composer-radius)-var(--composer-padding))] transition-transform outline-none after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-black/10 after:transition-colors after:ring-inset focus-visible:ring-3 active:scale-[0.96] motion-reduce:transition-none dark:after:ring-white/10",
                    isError &&
                      "after:ring-destructive/60 dark:after:ring-destructive/60",
                  )}
                  role="button"
                  tabIndex={0}
                  aria-label={`${typeLabel} attachment${
                    isError
                      ? ", upload failed"
                      : isUploading
                        ? ", uploading"
                        : ""
                  }`}
                />
              }
            >
              <AttachmentThumb />
              {isUploading && (
                <div
                  aria-hidden="true"
                  className="aui-attachment-tile-uploading bg-background/60 animate-in fade-in-0 absolute inset-0 flex items-center justify-center backdrop-blur-[2px] motion-reduce:animate-none"
                >
                  <Loader2Icon className="text-muted-foreground size-4 animate-spin" />
                </div>
              )}
              {isError && (
                <div
                  aria-hidden="true"
                  className="aui-attachment-tile-error bg-background/70 animate-in fade-in-0 absolute inset-0 flex items-center justify-center backdrop-blur-[2px] motion-reduce:animate-none"
                >
                  <AlertCircleIcon className="text-destructive size-4" />
                </div>
              )}
            </TooltipTrigger>
          </AttachmentPreviewDialog>
          {isComposer && <AttachmentRemove />}
        </AttachmentPrimitive.Root>
        <TooltipContent side="top">
          <AttachmentPrimitive.Name />
          {errorMessage && (
            <p className="aui-attachment-error-message">{errorMessage}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const AttachmentRemove: FC = () => {
  return (
    <AttachmentPrimitive.Remove
      render={
        <TooltipIconButton
          tooltip="Remove file"
          className="aui-attachment-tile-remove absolute end-0.5 top-0.5 z-20 size-5 rounded-full bg-black/70! text-white opacity-100 shadow-sm backdrop-blur-sm hover:bg-black/85! hover:text-white! active:scale-[0.96] motion-reduce:transition-none"
          side="top"
        />
      }
    >
      <XIcon className="aui-attachment-remove-icon size-3 stroke-[2.5]" />
    </AttachmentPrimitive.Remove>
  );
};

export const UserMessageAttachments: FC = () => {
  return (
    <div className="aui-user-message-attachments-end col-span-full col-start-1 row-start-1 flex w-full flex-row justify-end gap-2">
      <MessagePrimitive.Attachments>
        {() => <AttachmentUI />}
      </MessagePrimitive.Attachments>
    </div>
  );
};

export const ComposerAttachments: FC = () => {
  return (
    <div className="aui-composer-attachments flex w-full flex-row items-center gap-2 overflow-x-auto empty:hidden">
      <ComposerPrimitive.Attachments>
        {() => <AttachmentUI />}
      </ComposerPrimitive.Attachments>
    </div>
  );
};

/** Remove pending files that became invalid after a model switch. */
export const ComposerAttachmentGuard: FC = () => {
  const aui = useAui();
  const { settings } = useSettings();
  const modalities = getModelModalities(
    settings.chat.model,
    settings.chat.provider,
  );
  const attachments = useAuiState((state) => state.composer.attachments);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const unsupported = attachments
      .map((attachment, index) => ({ attachment, index }))
      .filter(({ attachment }) => {
        if (attachment.type === "image") return !modalities.vision;
        if (modalities.documents) return false;
        const contentType = attachment.contentType?.toLowerCase() ?? "";
        const name = attachment.name.toLowerCase();
        if (contentType === "application/pdf" || /\.(pdf|docx?)$/.test(name)) {
          return false;
        }
        const textLike =
          contentType.startsWith("text/") ||
          /json|javascript|typescript|xml|csv|markdown|yaml/.test(contentType) ||
          /\.(txt|md|markdown|csv|json|js|jsx|ts|tsx|css|html|xml|yaml|yml)$/.test(name);
        return !textLike;
      });

    if (unsupported.length === 0) return;
    for (const { index } of [...unsupported].reverse()) {
      void aui.composer.attachment({ index }).remove();
    }

    const removedImages = unsupported.some(({ attachment }) => attachment.type === "image");
    const removedDocuments = unsupported.some(({ attachment }) => attachment.type !== "image");
    const kinds = [
      removedImages ? "images" : "",
      removedDocuments ? "PDF/binary files" : "",
    ].filter(Boolean).join(" and ");
    setNotice(
      `Removed ${unsupported.length} unsupported attachment${unsupported.length === 1 ? "" : "s"}: this model cannot process ${kinds}.`,
    );
    const timer = window.setTimeout(() => setNotice(null), 7000);
    return () => window.clearTimeout(timer);
  }, [aui.composer, attachments, modalities.documents, modalities.vision]);

  useEffect(() => {
    if (modalities.vision) return;
    const documentWithPossibleImages = attachments.some(({ name, contentType }) =>
      contentType?.toLowerCase() === "application/pdf" ||
      /\.(pdf|docx?)$/i.test(name),
    );
    if (!documentWithPossibleImages) return;
    setNotice(
      "This model cannot see embedded images in PDF/Word attachments. Readable text is still sent.",
    );
    const timer = window.setTimeout(() => setNotice(null), 7000);
    return () => window.clearTimeout(timer);
  }, [attachments, modalities.vision]);

  if (!notice) return null;
  return (
    <p role="status" className="text-[11px] leading-relaxed text-destructive">
      {notice}
    </p>
  );
};

export const ComposerAddAttachment: FC = () => {
  const { settings } = useSettings();
  const modalities = getModelModalities(
    settings.chat.model,
    settings.chat.provider,
  );
  const hint = attachmentAcceptHint(modalities);

  return (
    <ComposerPrimitive.AddAttachment
      multiple
      render={
        <TooltipIconButton
          tooltip={hint}
          side="bottom"
          variant="ghost"
          size="icon"
          className="aui-composer-add-attachment hover:bg-muted-foreground/15 dark:border-muted-foreground/15 dark:hover:bg-muted-foreground/30 size-7 rounded-full p-1 text-xs font-semibold outline-none focus-visible:ring-0 active:scale-[0.96] motion-reduce:transition-none"
          aria-label="Add Attachment"
        />
      }
    >
      <PlusIcon className="aui-attachment-add-icon size-4.5 stroke-[1.5px]" />
    </ComposerPrimitive.AddAttachment>
  );
};
