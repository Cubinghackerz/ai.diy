import type { ProviderId } from "~/lib/types";

export type ImageSize = "1024x1024" | "1536x1024" | "1024x1536";

export const IMAGE_SIZE_OPTIONS: Array<{
    id: ImageSize;
    label: string;
    detail: string;
}> = [
    { id: "1024x1024", label: "Square", detail: "1024 × 1024" },
    { id: "1536x1024", label: "Landscape", detail: "1536 × 1024" },
    { id: "1024x1536", label: "Portrait", detail: "1024 × 1536" },
];

type ImageGenerationSettings = {
    sizes: readonly ImageSize[];
    counts: readonly number[];
    sizeMode: "size" | "aspect-ratio" | "default";
};

export function getImageGenerationSettings(
    provider: ProviderId,
): ImageGenerationSettings {
    switch (provider) {
        case "openai":
        case "azure":
        case "gateway":
        case "xai":
            return {
                sizes: IMAGE_SIZE_OPTIONS.map((option) => option.id),
                counts: [1, 2, 4],
                sizeMode: "size",
            };
        case "gemini":
        case "vertex":
            return {
                sizes: IMAGE_SIZE_OPTIONS.map((option) => option.id),
                counts: [1, 2, 4],
                sizeMode: "aspect-ratio",
            };
        case "togetherai":
            return {
                sizes: ["1024x1024"],
                counts: [1, 2, 4],
                sizeMode: "default",
            };
        case "fireworks":
            return {
                sizes: IMAGE_SIZE_OPTIONS.map((option) => option.id),
                counts: [1],
                sizeMode: "aspect-ratio",
            };
        case "bedrock":
            return {
                sizes: ["1024x1024"],
                counts: [1],
                sizeMode: "default",
            };
        default:
            return {
                sizes: ["1024x1024"],
                counts: [1],
                sizeMode: "default",
            };
    }
}

export function imageRequestOptions(
    provider: ProviderId,
    requestedSize: ImageSize | undefined,
    requestedCount: number | undefined,
): {
    n: number;
    size?: ImageSize;
    aspectRatio?: "1:1" | "3:2" | "2:3";
} {
    const settings = getImageGenerationSettings(provider);
    const selectedSize = requestedSize ?? "1024x1024";
    const size = settings.sizes.includes(selectedSize)
        ? selectedSize
        : settings.sizes[0];
    const selectedCount = requestedCount ?? 1;
    const n = settings.counts.includes(selectedCount)
        ? selectedCount
        : settings.counts[0];

    if (settings.sizeMode === "size") return { n, size };
    if (settings.sizeMode === "aspect-ratio") {
        return {
            n,
            aspectRatio:
                size === "1536x1024"
                    ? "3:2"
                    : size === "1024x1536"
                      ? "2:3"
                      : "1:1",
        };
    }
    return { n };
}
