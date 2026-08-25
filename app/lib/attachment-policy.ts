import { getModelModalities, type ModelModalities } from "~/lib/model-modalities";
import { DEFAULT_MODELS, type ProviderId } from "~/lib/types";

const DEFAULT_CONTEXT_WINDOW = 128_000;
const BYTES_PER_MB = 1_000_000;

/**
 * Vercel Functions cap request bodies at 4.5 MB. Binary attachments are sent
 * as base64 data URLs, so the usable source-file budget must stay below that
 * platform ceiling to leave room for the conversation and request metadata.
 */
const MULTIMODAL_MAX_FILE_BYTES = 2 * BYTES_PER_MB;
const TEXT_MAX_FILE_BYTES = 1.5 * BYTES_PER_MB;
const MULTIMODAL_MAX_TOTAL_BYTES = 3 * BYTES_PER_MB;
const TEXT_MAX_TOTAL_BYTES = 2 * BYTES_PER_MB;

export const TEXT_ATTACHMENT_EXTENSIONS = [
    "md",
    "markdown",
    "mdx",
    "txt",
    "log",
    "csv",
    "tsv",
    "json",
    "jsonl",
    "js",
    "jsx",
    "mjs",
    "cjs",
    "ts",
    "tsx",
    "py",
    "rb",
    "php",
    "java",
    "kt",
    "swift",
    "go",
    "rs",
    "c",
    "h",
    "cc",
    "cpp",
    "cxx",
    "css",
    "scss",
    "sass",
    "less",
    "html",
    "htm",
    "xml",
    "yaml",
    "yml",
    "toml",
    "ini",
    "conf",
    "sql",
    "sh",
    "bash",
    "zsh",
    "tex",
    "bib",
    "r",
    "rmd",
    "jl",
    "lua",
    "pl",
    "pm",
    "dart",
    "ex",
    "exs",
    "erl",
    "hrl",
    "fs",
    "fsx",
    "vb",
    "vue",
    "svelte",
    "astro",
    "graphql",
    "gql",
    "proto",
    "diff",
    "patch",
    "env",
    "properties",
    "dockerfile",
    "bat",
    "ps1",
    "fish",
    "ipynb",
] as const;

export const BINARY_DOCUMENT_EXTENSIONS = [
    "pdf",
    "doc",
    "docx",
    "ppt",
    "pptx",
    "xls",
    "xlsx",
    "rtf",
    "odt",
    "ods",
    "odp",
] as const;

export const EXTRACTABLE_DOCUMENT_EXTENSIONS = ["pdf", "docx"] as const;

const TEXT_MIME_TYPES = new Set([
    "application/json",
    "application/javascript",
    "application/x-javascript",
    "application/xml",
    "application/x-yaml",
    "application/sql",
    "text/csv",
    "text/css",
    "text/html",
    "text/javascript",
    "text/markdown",
    "text/plain",
    "text/xml",
    "text/yaml",
]);

const DOCUMENT_MIME_TYPES = new Set([
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
]);

const MIME_BY_EXTENSION: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    rtf: "application/rtf",
    odt: "application/vnd.oasis.opendocument.text",
    ods: "application/vnd.oasis.opendocument.spreadsheet",
    odp: "application/vnd.oasis.opendocument.presentation",
    json: "application/json",
    jsonl: "application/json",
    xml: "application/xml",
    yaml: "application/x-yaml",
    yml: "application/x-yaml",
    csv: "text/csv",
    tsv: "text/tab-separated-values",
    md: "text/markdown",
    markdown: "text/markdown",
    mdx: "text/markdown",
    txt: "text/plain",
    log: "text/plain",
    sql: "application/sql",
    js: "text/javascript",
    jsx: "text/javascript",
    mjs: "text/javascript",
    cjs: "text/javascript",
    ts: "text/typescript",
    tsx: "text/typescript",
    py: "text/x-python",
    sh: "text/x-shellscript",
    bash: "text/x-shellscript",
    zsh: "text/x-shellscript",
};

const IMAGE_EXTENSIONS = new Set([
    "avif",
    "bmp",
    "gif",
    "heic",
    "jpeg",
    "jpg",
    "png",
    "svg",
    "webp",
]);

export type AttachmentDescriptor = {
    name?: string;
    mediaType?: string;
    type?: string;
    sizeBytes?: number;
    dataUrl?: string;
    inlineText?: boolean;
};

export type AttachmentPolicy = {
    modalities: ModelModalities;
    contextWindow: number;
    maxFiles: number;
    maxFileBytes: number;
    maxTotalBytes: number;
};

export type AttachmentValidationCode =
    | "too-many-files"
    | "file-too-large"
    | "total-too-large"
    | "unsupported-image"
    | "unsupported-document"
    | "unsupported-format"
    | "invalid-data";

export type AttachmentValidationResult = {
    valid: boolean;
    message?: string;
    code?: AttachmentValidationCode;
    invalidIndexes: number[];
    totalBytes: number;
};

function extensionOf(name: string | undefined): string {
    return name?.split(".").pop()?.toLowerCase() ?? "";
}

function modelContextWindow(provider: ProviderId, model: string): number {
    const models = Array.isArray(DEFAULT_MODELS[provider])
        ? DEFAULT_MODELS[provider]
        : [];
    const exact = models.find((entry) => entry.id === model);
    if (exact?.contextWindow) return exact.contextWindow;
    const loose = models.find(
        (entry) => entry.id.endsWith(`/${model}`) || model.endsWith(entry.id),
    );
    return loose?.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
}

export function getAttachmentPolicy(
    provider: ProviderId,
    model: string,
): AttachmentPolicy {
    const knownProvider = Object.hasOwn(DEFAULT_MODELS, provider)
        ? provider
        : "custom";
    const modalities = getModelModalities(model, knownProvider);
    const contextWindow = modelContextWindow(provider, model);
    const canProcessFiles = modalities.vision || modalities.documents;
    const largeContext = contextWindow >= 200_000;

    return {
        modalities,
        contextWindow,
        maxFiles: canProcessFiles ? (largeContext ? 8 : 6) : largeContext ? 6 : 4,
        maxFileBytes: canProcessFiles
            ? MULTIMODAL_MAX_FILE_BYTES
            : TEXT_MAX_FILE_BYTES,
        maxTotalBytes: canProcessFiles
            ? MULTIMODAL_MAX_TOTAL_BYTES
            : TEXT_MAX_TOTAL_BYTES,
    };
}

export const DEFAULT_ATTACHMENT_POLICY: AttachmentPolicy = {
    modalities: {
        tools: true,
        vision: true,
        documents: true,
        reasoning: true,
        imageGeneration: true,
    },
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    maxFiles: 8,
    maxFileBytes: MULTIMODAL_MAX_FILE_BYTES,
    maxTotalBytes: MULTIMODAL_MAX_TOTAL_BYTES,
};

export function normalizeAttachmentMimeType(
    mediaType: string | undefined,
    name: string | undefined,
): string {
    const explicit = mediaType?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
    if (explicit && explicit !== "application/octet-stream") return explicit;
    return (MIME_BY_EXTENSION[extensionOf(name)] ?? explicit) || "application/octet-stream";
}

export function isTextAttachment(descriptor: AttachmentDescriptor): boolean {
    if (descriptor.inlineText) return true;
    const mime = normalizeAttachmentMimeType(
        descriptor.mediaType ?? descriptor.type,
        descriptor.name,
    );
    return (
        mime.startsWith("text/") ||
        TEXT_MIME_TYPES.has(mime) ||
        (TEXT_ATTACHMENT_EXTENSIONS as readonly string[]).includes(extensionOf(descriptor.name))
    );
}

export function isImageAttachment(descriptor: AttachmentDescriptor): boolean {
    const mime = normalizeAttachmentMimeType(
        descriptor.mediaType ?? descriptor.type,
        descriptor.name,
    );
    return mime.startsWith("image/") || IMAGE_EXTENSIONS.has(extensionOf(descriptor.name));
}

export function isBinaryDocumentAttachment(
    descriptor: AttachmentDescriptor,
): boolean {
    const mime = normalizeAttachmentMimeType(
        descriptor.mediaType ?? descriptor.type,
        descriptor.name,
    );
    return (
        DOCUMENT_MIME_TYPES.has(mime) ||
        (BINARY_DOCUMENT_EXTENSIONS as readonly string[]).includes(extensionOf(descriptor.name))
    );
}

export function isExtractableDocument(descriptor: AttachmentDescriptor): boolean {
    return (EXTRACTABLE_DOCUMENT_EXTENSIONS as readonly string[]).includes(
        extensionOf(descriptor.name),
    );
}

function dataUrlByteLength(dataUrl: string): number | null | undefined {
    if (!dataUrl.toLowerCase().startsWith("data:")) return undefined;
    const comma = dataUrl.indexOf(",");
    if (comma < 0) return null;
    const header = dataUrl.slice(0, comma);
    const payload = dataUrl.slice(comma + 1);
    if (/;base64(?:;|$)/i.test(header)) {
        const normalized = payload.replace(/\s/g, "");
        if (!/^[a-z\d+/]*={0,2}$/i.test(normalized)) return null;
        const padding = normalized.endsWith("==")
            ? 2
            : normalized.endsWith("=")
              ? 1
              : 0;
        return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
    }
    try {
        return new TextEncoder().encode(decodeURIComponent(payload)).byteLength;
    } catch {
        return null;
    }
}

function descriptorBytes(descriptor: AttachmentDescriptor): number | undefined {
    if (Number.isFinite(descriptor.sizeBytes) && (descriptor.sizeBytes ?? 0) >= 0) {
        return descriptor.sizeBytes;
    }
    const fromDataUrl = descriptor.dataUrl ? dataUrlByteLength(descriptor.dataUrl) : undefined;
    return fromDataUrl === null ? undefined : fromDataUrl;
}

function descriptorHasInvalidData(descriptor: AttachmentDescriptor): boolean {
    return Boolean(
        descriptor.dataUrl &&
            descriptor.dataUrl.toLowerCase().startsWith("data:") &&
            dataUrlByteLength(descriptor.dataUrl) === null,
    );
}

function descriptorIssue(
    descriptor: AttachmentDescriptor,
    policy: AttachmentPolicy,
    options: { allowTextExtraction?: boolean } = {},
): { code: AttachmentValidationCode; message: string } | undefined {
    if (descriptorHasInvalidData(descriptor)) {
        return {
            code: "invalid-data",
            message: `${descriptor.name || "A file"} contains an invalid data payload.`,
        };
    }
    if (isImageAttachment(descriptor) && !policy.modalities.vision) {
        return {
            code: "unsupported-image",
            message: "This model cannot process image attachments.",
        };
    }
    if (
        isBinaryDocumentAttachment(descriptor) &&
        !policy.modalities.documents &&
        !(options.allowTextExtraction && isExtractableDocument(descriptor))
    ) {
        return {
            code: "unsupported-document",
            message: "This model cannot process binary document attachments.",
        };
    }
    if (
        !isTextAttachment(descriptor) &&
        !isImageAttachment(descriptor) &&
        !isBinaryDocumentAttachment(descriptor)
    ) {
        return {
            code: "unsupported-format",
            message: `${descriptor.name || "This file"} is not a supported attachment format.`,
        };
    }
    const bytes = descriptorBytes(descriptor);
    if (bytes != null && bytes > policy.maxFileBytes) {
        return {
            code: "file-too-large",
            message: `${descriptor.name || "A file"} is ${formatAttachmentBytes(bytes)}; the limit for this model is ${formatAttachmentBytes(policy.maxFileBytes)} per file.`,
        };
    }
    return undefined;
}

export function validateAttachmentDescriptors(
    descriptors: readonly AttachmentDescriptor[],
    policy: AttachmentPolicy,
    options: { allowTextExtraction?: boolean } = {},
): AttachmentValidationResult {
    const invalid = new Map<number, { code: AttachmentValidationCode; message: string }>();
    let countExceeded = false;

    if (descriptors.length > policy.maxFiles) {
        countExceeded = true;
        for (let index = policy.maxFiles; index < descriptors.length; index += 1) {
            invalid.set(index, {
                code: "too-many-files",
                message: `This model accepts up to ${policy.maxFiles} attachments per message.`,
            });
        }
    }

    for (let index = 0; index < descriptors.length; index += 1) {
        if (invalid.has(index)) continue;
        const issue = descriptorIssue(descriptors[index]!, policy, options);
        if (issue) invalid.set(index, issue);
    }

    let totalBytes = 0;
    for (let index = 0; index < descriptors.length; index += 1) {
        if (invalid.has(index)) continue;
        totalBytes += descriptorBytes(descriptors[index]!) ?? 0;
    }

    let totalExceeded = false;
    if (totalBytes > policy.maxTotalBytes) {
        totalExceeded = true;
        for (let index = descriptors.length - 1; index >= 0; index -= 1) {
            if (invalid.has(index)) continue;
            const bytes = descriptorBytes(descriptors[index]!) ?? 0;
            invalid.set(index, {
                code: "total-too-large",
                message: `Together these files exceed the ${formatAttachmentBytes(policy.maxTotalBytes)} upload limit for this model.`,
            });
            totalBytes -= bytes;
            if (totalBytes <= policy.maxTotalBytes) break;
        }
    }

    const firstIssue = [...invalid.values()][0];
    const code = countExceeded
        ? "too-many-files"
        : totalExceeded
          ? "total-too-large"
          : firstIssue?.code;
    const message = countExceeded
        ? `This model accepts up to ${policy.maxFiles} attachments per message.`
        : totalExceeded
          ? `Together these files exceed the ${formatAttachmentBytes(policy.maxTotalBytes)} upload limit for this model.`
          : firstIssue?.message;

    return {
        valid: invalid.size === 0,
        message,
        code,
        invalidIndexes: [...invalid.keys()].sort((a, b) => a - b),
        totalBytes,
    };
}

export function validateAttachmentFile(
    descriptor: AttachmentDescriptor,
    policy: AttachmentPolicy,
    options: { allowTextExtraction?: boolean } = {},
): string | undefined {
    return validateAttachmentDescriptors([descriptor], policy, options).message;
}

function attachmentNameFromTag(tag: string): string | undefined {
    return tag.match(/\bname=["']([^"']+)["']/i)?.[1];
}

export function attachmentDescriptorsFromMessages(
    messages: readonly unknown[],
): AttachmentDescriptor[] {
    const descriptors: AttachmentDescriptor[] = [];
    for (const message of messages) {
        if (!message || typeof message !== "object") continue;
        if ((message as { role?: unknown }).role !== "user") continue;
        const parts = (message as { parts?: unknown }).parts;
        if (!Array.isArray(parts)) continue;
        for (const part of parts) {
            if (!part || typeof part !== "object") continue;
            const record = part as Record<string, unknown>;
            if (record.type === "file" || record.type === "image") {
                const url =
                    typeof record.url === "string"
                        ? record.url
                        : typeof record.data === "string"
                          ? record.data
                        : typeof record.image === "string"
                          ? record.image
                          : undefined;
                descriptors.push({
                    name:
                        typeof record.filename === "string"
                            ? record.filename
                            : typeof record.name === "string"
                              ? record.name
                              : undefined,
                    mediaType:
                        typeof record.mediaType === "string"
                            ? record.mediaType
                            : typeof record.mimeType === "string"
                              ? record.mimeType
                              : undefined,
                    dataUrl: url,
                });
                continue;
            }
            if (record.type !== "text" || typeof record.text !== "string") continue;
            const matches = record.text.matchAll(
                /<attachment\b[^>]*>([\s\S]*?)<\/attachment>/gi,
            );
            for (const match of matches) {
                const tag = match[0] ?? "";
                descriptors.push({
                    name: attachmentNameFromTag(tag),
                    inlineText: true,
                    sizeBytes: new TextEncoder().encode(match[1] ?? "").byteLength,
                });
            }
        }
    }
    return descriptors;
}

export function validateIncomingAttachmentMessages(
    messages: readonly unknown[],
    policy: AttachmentPolicy,
): AttachmentValidationResult {
    return validateAttachmentDescriptors(
        attachmentDescriptorsFromMessages(messages),
        policy,
    );
}

export function formatAttachmentBytes(bytes: number): string {
    if (bytes >= BYTES_PER_MB) {
        return `${(bytes / BYTES_PER_MB).toFixed(bytes >= 10 * BYTES_PER_MB ? 0 : 1).replace(/\.0$/, "")} MB`;
    }
    return `${Math.max(1, Math.round(bytes / 1_000))} KB`;
}

export function attachmentLimitHint(policy: AttachmentPolicy): string {
    return `up to ${policy.maxFiles} files, ${formatAttachmentBytes(policy.maxFileBytes)} each, ${formatAttachmentBytes(policy.maxTotalBytes)} total`;
}
