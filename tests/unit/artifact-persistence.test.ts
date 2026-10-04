import { afterEach, describe, expect, it, vi } from "vitest";
import { getStorageIssues, clearStorageIssue } from "~/lib/storage-notices";
import { persistArtifactForScope } from "~/lib/artifact-persist.client";
import type { Artifact } from "~/lib/canvas";

const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("~/lib/db", () => ({ saveArtifactToDB: save }));
afterEach(() => {
    save.mockReset();
    for (const issue of getStorageIssues()) clearStorageIssue(issue.id);
});
const artifact: Artifact = {
    id: "artifact-test",
    kind: "code",
    title: "Test",
    filename: "test.txt",
    content: "keep me",
    createdAt: 1,
};

describe("artifact persistence", () => {
    it("surfaces a failed write without dropping the in-memory artifact", async () => {
        save.mockRejectedValue(new DOMException("full", "QuotaExceededError"));
        persistArtifactForScope("test", artifact);
        await vi.waitFor(() => expect(getStorageIssues()).toHaveLength(1));
        expect(getStorageIssues()[0].message).toContain("storage is full");
        expect(artifact.content).toBe("keep me");
    });
    it("explains when an artifact is too large to persist", () => {
        persistArtifactForScope("test", { ...artifact, content: "x".repeat(3_000_001) });
        expect(save).not.toHaveBeenCalled();
        expect(getStorageIssues()[0].message).toContain("download it");
    });
});
