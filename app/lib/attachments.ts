/**
 * Attachment adapters gated by model modalities (vision / documents / text).
 */

import {
    CompositeAttachmentAdapter,
    SimpleTextAttachmentAdapter,
    type AttachmentAdapter,
} from "@assistant-ui/core";
import type { ModelModalities } from "~/lib/model-modalities";
import { extractKnowledgeText } from "~/lib/knowledge/extract.client";
import {
    BINARY_DOCUMENT_EXTENSIONS,
    DEFAULT_ATTACHMENT_POLICY,
    EXTRACTABLE_DOCUMENT_EXTENSIONS,
    TEXT_ATTACHMENT_EXTENSIONS,
    attachmentLimitHint,
    isExtractableDocument,
    isTextAttachment,
    normalizeAttachmentMimeType,
    validateAttachmentFile,
    type AttachmentDescriptor,
    type AttachmentPolicy,
} from "~/lib/attachment-policy";

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
    return normalizeAttachmentMimeType(file.type, file.name);
}

const DOCUMENT_MIME_ACCEPT = [
    "application/pdf",
    "application/msword",
    "application/rtf",
    "application/vnd.ms-powerpoint",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.oasis.opendocument.text",
    "application/vnd.oasis.opendocument.spreadsheet",
    "application/vnd.oasis.opendocument.presentation",
].join(",");

const DOCUMENT_ACCEPT = [
    ...BINARY_DOCUMENT_EXTENSIONS.map((extension) => `.${extension}`),
    DOCUMENT_MIME_ACCEPT,
].join(",");

const EXTRACTABLE_DOCUMENT_ACCEPT = [
    ...EXTRACTABLE_DOCUMENT_EXTENSIONS.map((extension) => `.${extension}`),
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
].join(",");

const TEXT_MIME_ACCEPT = [
    "text/*",
    "application/json",
    "application/javascript",
    "application/x-javascript",
    "application/xml",
    "application/x-yaml",
    "application/sql",
].join(",");

const TEXT_EXT_ACCEPT = TEXT_ATTACHMENT_EXTENSIONS.map(
    (extension) => `.${extension}`,
).join(",");
const TEXT_ATTACHMENT_ACCEPT = `${TEXT_MIME_ACCEPT},${TEXT_EXT_ACCEPT}`;

function isTextLike(file: File): boolean {
    return isTextAttachment({ name: file.name, type: file.type });
}

const textDocumentAdapter = {
    accept: TEXT_ATTACHMENT_ACCEPT,
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

function isPdfOrDocx(file: File): boolean {
    return isExtractableDocument({ name: file.name, type: file.type });
}

function createBinaryDocumentAdapter(supportsDocuments: boolean): AttachmentAdapter {
    return {
        accept: supportsDocuments ? DOCUMENT_ACCEPT : EXTRACTABLE_DOCUMENT_ACCEPT,
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
            if (!supportsDocuments) {
                let extracted = "";
                try {
                    if (isPdfOrDocx(file)) {
                        extracted = (await extractKnowledgeText(file)).text;
                    }
                } catch (error) {
                    const reason = error instanceof Error ? error.message : String(error);
                    extracted = `[Readable text unavailable: ${reason.slice(0, 300)}]`;
                }
                if (!extracted) {
                    extracted = "[This attachment has no readable text layer for this text-only model.]";
                }
                return {
                    ...attachment,
                    type: "document",
                    status: { type: "complete" },
                    content: [
                        {
                            type: "text",
                            text: `<attachment name="${attachment.name}">\n${extracted}\n</attachment>`,
                        },
                    ],
                };
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
    };
}

export function createAttachmentAdapter(
    modalities: ModelModalities,
    policy: AttachmentPolicy = {
        ...DEFAULT_ATTACHMENT_POLICY,
        modalities,
    },
): CompositeAttachmentAdapter {
    const guardAdapter = (adapter: AttachmentAdapter): AttachmentAdapter => ({
        ...adapter,
        add({ file }) {
            const error = validateAttachmentFile(
                {
                    name: file.name,
                    type: file.type,
                    sizeBytes: file.size,
                } satisfies AttachmentDescriptor,
                policy,
                { allowTextExtraction: true },
            );
            if (error) return Promise.reject(new Error(error));
            return adapter.add({ file });
        },
    });

    const adapters: AttachmentAdapter[] = [
        guardAdapter(new SimpleTextAttachmentAdapter()),
    ];

    if (modalities.vision) {
        adapters.unshift(guardAdapter(imageAttachmentAdapter));
    }

    // Always allow text-like docs (inlined as text — works with any chat model).
    adapters.push(guardAdapter(textDocumentAdapter));

    // Text-only models receive a local text extraction instead of a file part.
    // Vision/document-capable models retain the original binary attachment.
    adapters.push(guardAdapter(createBinaryDocumentAdapter(modalities.documents)));

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

export function attachmentAcceptHint(
    modalities: ModelModalities,
    policy: AttachmentPolicy = { ...DEFAULT_ATTACHMENT_POLICY, modalities },
): string {
    const parts = ["text", "markdown"];
    if (modalities.vision) parts.unshift("images");
    if (modalities.documents) parts.push("PDF, Word, slides, spreadsheets");
    else parts.push("PDF/Word text extraction");
    return `Add files (${parts.join(", ")}; ${attachmentLimitHint(policy)})`;
}

export function attachmentAcceptForPolicy(
    policy: AttachmentPolicy,
    options: { allowTextExtraction?: boolean } = {},
): string {
    const accepts = [TEXT_ATTACHMENT_ACCEPT];
    if (policy.modalities.vision) accepts.unshift("image/*");
    if (policy.modalities.documents) {
        accepts.push(DOCUMENT_ACCEPT);
    } else if (options.allowTextExtraction) {
        accepts.push(EXTRACTABLE_DOCUMENT_ACCEPT);
    }
    return accepts.join(",");
}
