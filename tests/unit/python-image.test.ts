import { describe, expect, it } from "vitest";
import { findImageArtifact } from "~/components/generative-ui/python-image";
import type { Artifact } from "~/lib/canvas";

const base = { kind: "file", title: "t", content: "x", createdAt: 0 } as const;
const artifact = (over: Partial<Artifact>): Artifact => ({ id: "a", ...base, ...over });

describe("findImageArtifact", () => {
    it("returns the newest image with the requested filename", () => {
        const found = findImageArtifact(
            [
                artifact({ id: "old", filename: "chart.png", mimeType: "image/png" }),
                artifact({ id: "new", filename: "chart.png", mimeType: "image/png" }),
            ],
            "chart.png",
        );
        expect(found?.id).toBe("new");
    });
    it("infers the type from the extension when the mime type is missing", () => {
        expect(findImageArtifact([artifact({ filename: "plot.svg" })], "plot.svg")).not.toBeNull();
    });
    it("rejects non-images, active content, and path tricks", () => {
        const items = [
            artifact({ filename: "report.docx" }),
            artifact({ filename: "page.html", mimeType: "text/html" }),
            artifact({ filename: "a.png", mimeType: "text/html" }),
        ];
        expect(findImageArtifact(items, "report.docx")).toBeNull();
        expect(findImageArtifact(items, "page.html")).toBeNull();
        expect(findImageArtifact(items, "a.png")).toBeNull();
        expect(findImageArtifact(items, undefined)).toBeNull();
        expect(findImageArtifact([artifact({ filename: "x_y.png" })], "x/y.png")?.filename).toBe(
            "x_y.png",
        );
    });
});
