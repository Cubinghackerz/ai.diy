/**
 * Attachment adapters gated by model modalities (vision / documents / text).
 */

import {
    CompositeAttachmentAdapter,
    SimpleTextAttachmentAdapter,
    type AttachmentAdapter,
} from "@assistant-ui/core";
import type { ModelModalities } from "~/lib/model-modalities";

async function fileToDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = String(reader.result);
            const mimeType = getFileMimeType(file);
            resolve(
                mimeType && dataUrl.startsWith("data:;base64,")
                    ? dataUrl.replace("data:;base64,", `data:${mimeType};base64,`)
                    : dataUrl,
            );
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

function getFileMimeType(file: File): string {
    if (file.type) return file.type.split(";", 1)[0];
    const extension = file.name.split(".").pop()?.toLowerCase();
    return (
        {
            pdf: "application/pdf",
            doc: "application/msword",
            docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            rtf: "application/rtf",
        } as Record<string, string>
    )[extension ?? ""] ?? "application/octet-stream";
}

const DOCUMENT_ACCEPT = [
    "application/pdf",
    ".pdf",
    "application/msword",
    ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".docx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".pptx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xlsx",
    "application/rtf",
    ".rtf",
].join(",");

const TEXT_EXT_ACCEPT = [
    "text/markdown",
    ".md",
    ".markdown",
    "text/csv",
    ".csv",
    "application/json",
    ".json",
    "text/plain",
    ".txt",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".py",
    ".css",
    ".html",
    ".xml",
    ".yaml",
    ".yml",
].join(",");

function isTextLike(file: File): boolean {
    return (
        file.type.startsWith("text/") ||
        /\.(md|markdown|txt|csv|json|ts|tsx|js|jsx|py|css|html|xml|ya?ml)$/i.test(
            file.name,
        )
    );
}

const textDocumentAdapter = {
    accept: TEXT_EXT_ACCEPT,
    async add({ file }) {
        return {
            id: crypto.randomUUID(),
            type: "document",
            name: file.name,
            contentType: file.type || "text/plain",
            file,
            content: [],
            status: { type: "requires-action", reason: "composer-send" },
        };
    },
    async send(attachment) {
        const file = attachment.file;
        if (!file) {
            return { ...attachment, status: { type: "complete" }, content: [] };
        }
        const text = await file.text();
        return {
            ...attachment,
            status: { type: "complete" },
            content: [
                {
                    type: "text",
                    text: `<attachment name="${attachment.name}">\n${text}\n</attachment>`,
                },
            ],
        };
    },
    async remove() {},
} satisfies AttachmentAdapter;

const imageAttachmentAdapter = {
    accept: "image/*",
    async add({ file }) {
        return {
            id: crypto.randomUUID(),
            type: "image",
            name: file.name,
            contentType: getFileMimeType(file),
            file,
            content: [],
            status: { type: "requires-action", reason: "composer-send" },
        };
    },
    async send(attachment) {
        const file = attachment.file;
        if (!file) {
            return { ...attachment, status: { type: "complete" }, content: [] };
        }
        return {
            ...attachment,
            status: { type: "complete" },
            content: [
                {
                    type: "image",
                    image: await fileToDataURL(file),
                },
            ],
        };
    },
    async remove() {},
} satisfies AttachmentAdapter;

const binaryDocumentAdapter = {
    accept: DOCUMENT_ACCEPT,
    async add({ file }) {
        if (isTextLike(file)) {
            return textDocumentAdapter.add({ file });
        }
        return {
            id: crypto.randomUUID(),
            type: "file",
            name: file.name,
            contentType: getFileMimeType(file),
            file,
            content: [],
            status: { type: "requires-action", reason: "composer-send" },
        };
    },
    async send(attachment) {
        const file = attachment.file;
        if (!file) {
            return { ...attachment, status: { type: "complete" }, content: [] };
        }
        if (isTextLike(file)) {
            return textDocumentAdapter.send(attachment);
        }
        return {
            ...attachment,
            status: { type: "complete" },
            content: [
                {
                    type: "file",
                mimeType: attachment.contentType ?? getFileMimeType(file),
                    filename: attachment.name,
                    data: await fileToDataURL(file),
                },
            ],
        };
    },
    async remove() {},
} satisfies AttachmentAdapter;

export function createAttachmentAdapter(
    modalities: ModelModalities,
): CompositeAttachmentAdapter {
    const adapters: AttachmentAdapter[] = [new SimpleTextAttachmentAdapter()];

    if (modalities.vision) {
        adapters.unshift(imageAttachmentAdapter);
    }

    // Always allow text-like docs (inlined as text — works with any chat model).
    adapters.push(textDocumentAdapter);

    if (modalities.documents) {
        adapters.push(binaryDocumentAdapter);
    }

    return new CompositeAttachmentAdapter(adapters);
}

/** Default: full support (back-compat). */
export const prismiumAttachmentAdapter = createAttachmentAdapter({
    tools: true,
    vision: true,
    documents: true,
    reasoning: true,
    imageGeneration: true,
});

export function attachmentAcceptHint(modalities: ModelModalities): string {
    const parts = ["text", "markdown"];
    if (modalities.vision) parts.unshift("images");
    if (modalities.documents) parts.push("PDF", "Word");
    return `Add files (${parts.join(", ")}…)`;
}
