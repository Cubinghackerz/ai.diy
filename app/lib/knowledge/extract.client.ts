import { unzipSync } from "fflate";

export type ExtractedKnowledgeText = {
    text: string;
    containsImages: boolean;
    format: "text" | "pdf" | "docx";
};

const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_PDF_PAGES = 200;

function extensionOf(name: string): string {
    return name.split(".").pop()?.toLowerCase() ?? "";
}

function isPdf(file: File): boolean {
    return file.type === "application/pdf" || extensionOf(file.name) === "pdf";
}

function isDocx(file: File): boolean {
    return (
        file.type ===
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        extensionOf(file.name) === "docx"
    );
}

function isLegacyWord(file: File): boolean {
    return file.type === "application/msword" || extensionOf(file.name) === "doc";
}

async function extractPdf(file: File): Promise<ExtractedKnowledgeText> {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = new Uint8Array(await file.arrayBuffer());
    const loadingTask = pdfjs.getDocument({
        data,
        useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;
    const pages: string[] = [];
    const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = content.items
            .map((item) => ("str" in item ? item.str : ""))
            .filter(Boolean)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
        if (text) pages.push(`[Page ${pageNumber}]\n${text}`);
    }
    const raw = new TextDecoder("latin1").decode(data);
    const containsImages = /\/Subtype\s*\/Image\b/.test(raw);
    const pageLimitNote = pdf.numPages > MAX_PDF_PAGES
        ? `\n[Only the first ${MAX_PDF_PAGES} pages were indexed.]`
        : "";
    return {
        text: `${pages.join("\n\n")}${pageLimitNote}`.trim(),
        containsImages,
        format: "pdf",
    };
}

async function extractDocx(file: File): Promise<ExtractedKnowledgeText> {
    const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
    const documentXml = archive["word/document.xml"];
    if (!documentXml) throw new Error("This Word file has no readable document body.");
    const xml = new TextDecoder().decode(documentXml);
    const parsed = new DOMParser().parseFromString(xml, "application/xml");
    if (parsed.querySelector("parsererror")) {
        throw new Error("The Word document XML could not be parsed.");
    }
    const paragraphs = Array.from(parsed.getElementsByTagName("w:p"))
        .map((paragraph) => paragraph.textContent?.replace(/\s+/g, " ").trim() ?? "")
        .filter(Boolean);
    const containsImages = Object.keys(archive).some((name) => name.startsWith("word/media/"));
    return {
        text: paragraphs.join("\n\n").trim(),
        containsImages,
        format: "docx",
    };
}

export async function extractKnowledgeText(file: File): Promise<ExtractedKnowledgeText> {
    if (file.size > MAX_SOURCE_BYTES) {
        throw new Error(`Files larger than ${MAX_SOURCE_BYTES / (1024 * 1024)} MiB cannot be indexed locally.`);
    }
    if (isLegacyWord(file)) {
        throw new Error("Legacy .doc files are not supported. Save the document as .docx and retry.");
    }
    if (isPdf(file)) return extractPdf(file);
    if (isDocx(file)) return extractDocx(file);
    return {
        text: await file.text(),
        containsImages: false,
        format: "text",
    };
}
