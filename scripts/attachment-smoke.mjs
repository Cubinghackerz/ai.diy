import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vite = await createServer({
    root,
    appType: "custom",
    server: { middlewareMode: true },
    resolve: { alias: { "~": path.join(root, "app") } },
});

let failures = 0;
function check(name, condition, detail = "") {
    if (condition) console.log(`ok - ${name}`);
    else {
        failures += 1;
        console.error(`FAIL - ${name}${detail ? `: ${detail}` : ""}`);
    }
}

try {
    const policyModule = await vite.ssrLoadModule(
        path.join(root, "app/lib/attachment-policy.ts"),
    );
    const {
        getAttachmentPolicy,
        validateAttachmentDescriptors,
        validateIncomingAttachmentMessages,
    } = policyModule;
    const attachmentsModule = await vite.ssrLoadModule(
        path.join(root, "app/lib/attachments.ts"),
    );
    const { createAttachmentAdapter, attachmentAcceptForPolicy } = attachmentsModule;

    const multimodal = getAttachmentPolicy("openai", "gpt-4o");
    const textOnly = getAttachmentPolicy("openai", "gpt-3.5-turbo");
    const multimodalAdapter = createAttachmentAdapter(
        multimodal.modalities,
        multimodal,
    );
    const textOnlyAdapter = createAttachmentAdapter(textOnly.modalities, textOnly);
    const textOnlyAdapterAcceptTypes = new Set(textOnlyAdapter.accept.split(","));
    const textOnlyAccept = attachmentAcceptForPolicy(textOnly, {
        allowTextExtraction: true,
    });
    const textOnlyAcceptTypes = new Set(textOnlyAccept.split(","));

    check("multimodal models expose vision and document support", multimodal.modalities.vision && multimodal.modalities.documents);
    check("text-only models do not expose image support", !textOnly.modalities.vision);
    check(
        "multimodal adapter exposes images and binary documents",
        multimodalAdapter.accept.includes("image/*") &&
            multimodalAdapter.accept.includes(".pptx"),
    );
    check(
        "text-only adapter hides unsupported images and binary documents",
        !textOnlyAdapterAcceptTypes.has("image/*") &&
            !textOnlyAdapterAcceptTypes.has(".pptx") &&
            !textOnlyAdapterAcceptTypes.has(".doc"),
    );
    check(
        "text-only adapter keeps locally extractable documents",
        textOnlyAcceptTypes.has(".pdf") && textOnlyAcceptTypes.has(".docx"),
    );
    check(
        "text-only adapter accepts additional text formats",
        textOnlyAcceptTypes.has(".graphql") && textOnlyAcceptTypes.has(".ipynb"),
    );
    check(
        "supported image passes for multimodal model",
        validateAttachmentDescriptors(
            [{ name: "diagram.png", mediaType: "image/png", sizeBytes: 500_000 }],
            multimodal,
        ).valid,
    );
    check(
        "image is rejected for text-only model",
        validateAttachmentDescriptors(
            [{ name: "diagram.png", mediaType: "image/png", sizeBytes: 500_000 }],
            textOnly,
        ).code === "unsupported-image",
    );
    check(
        "PDF can use local extraction for text-only model",
        validateAttachmentDescriptors(
            [{ name: "notes.pdf", mediaType: "application/pdf", sizeBytes: 500_000 }],
            textOnly,
            { allowTextExtraction: true },
        ).valid,
    );
    check(
        "unsupported binary document is rejected for text-only model",
        validateAttachmentDescriptors(
            [{ name: "slides.pptx", mediaType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", sizeBytes: 500_000 }],
            textOnly,
            { allowTextExtraction: true },
        ).code === "unsupported-document",
    );
    check(
        "per-file size limit is enforced",
        validateAttachmentDescriptors(
            [{ name: "large.txt", mediaType: "text/plain", sizeBytes: textOnly.maxFileBytes + 1 }],
            textOnly,
        ).code === "file-too-large",
    );
    check(
        "attachment count limit is enforced",
        validateAttachmentDescriptors(
            Array.from({ length: multimodal.maxFiles + 1 }, (_, index) => ({
                name: `file-${index}.txt`,
                mediaType: "text/plain",
                sizeBytes: 1,
            })),
            multimodal,
        ).code === "too-many-files",
    );
    check(
        "incoming validation ignores assistant-generated files",
        validateIncomingAttachmentMessages(
            [
                {
                    role: "assistant",
                    parts: [
                        {
                            type: "file",
                            mediaType: "image/png",
                            url: "data:image/png;base64,AA==",
                        },
                    ],
                },
                {
                    role: "user",
                    parts: [
                        {
                            type: "file",
                            mediaType: "image/png",
                            url: "data:image/png;base64,AA==",
                        },
                    ],
                },
            ],
            multimodal,
        ).valid,
    );
} finally {
    await vite.close();
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
