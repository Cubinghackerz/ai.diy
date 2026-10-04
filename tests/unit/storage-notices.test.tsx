import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PersistenceBanner } from "~/components/ui/StorageNotices";
import {
    clearStorageIssue,
    getStorageIssues,
    observeStorage,
    reportStorageFailure,
    requestPersistentStorage,
} from "~/lib/storage-notices";

afterEach(() => {
    for (const issue of getStorageIssues()) clearStorageIssue(issue.id);
    localStorage.clear();
});

describe("persistence recovery", () => {
    it("does not clear a newer failure when an older write completes", async () => {
        let complete!: () => void;
        const oldWrite = observeStorage(
            "chat:test",
            "Chat",
            () =>
                new Promise<void>((resolve) => {
                    complete = resolve;
                }),
        );
        reportStorageFailure("chat:test", "Chat", new DOMException("full", "QuotaExceededError"));
        complete();
        await oldWrite;
        expect(getStorageIssues()).toHaveLength(1);
    });
    it("deduplicates overlapping first-run persistence requests", async () => {
        let complete!: (value: boolean) => void;
        const persist = vi.fn(
            () =>
                new Promise<boolean>((resolve) => {
                    complete = resolve;
                }),
        );
        Object.defineProperty(navigator, "storage", {
            configurable: true,
            value: { persist, persisted: vi.fn().mockResolvedValue(false) },
        });
        const first = requestPersistentStorage();
        const second = requestPersistentStorage();
        expect(persist).toHaveBeenCalledOnce();
        complete(false);
        await Promise.all([first, second]);
    });
    it("surfaces quota failures and clears only after a successful retry", async () => {
        let full = true;
        const operation = vi.fn(async () => {
            if (full) throw new DOMException("private payload", "QuotaExceededError");
        });
        await expect(observeStorage("chat:test", "Chat", operation)).rejects.toThrow();
        render(<PersistenceBanner />);
        expect(screen.getByRole("alert").textContent).toContain("browser storage is full");
        expect(screen.getByRole("alert").textContent).not.toContain("private payload");
        full = false;
        fireEvent.click(screen.getByRole("button", { name: "Retry saving chat" }));
        await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
        expect(operation).toHaveBeenCalledTimes(2);
    });
    it("keeps unrelated failure notices when one operation recovers", async () => {
        reportStorageFailure("artifact:test", "Artifact", new Error("failed"));
        await observeStorage("chat:test", "Chat", async () => {});
        expect(getStorageIssues()).toHaveLength(1);
    });
    it("never suggests deleting a newer database", () => {
        reportStorageFailure("database", "Local storage", new DOMException("v17", "VersionError"));
        expect(getStorageIssues()[0].message).toContain("do not clear site data");
    });
    it("requests persistent storage only once unless explicitly retried", async () => {
        const persist = vi.fn().mockResolvedValue(false);
        Object.defineProperty(navigator, "storage", {
            configurable: true,
            value: { persist, persisted: vi.fn().mockResolvedValue(false) },
        });
        await requestPersistentStorage();
        await requestPersistentStorage();
        expect(persist).toHaveBeenCalledOnce();
        await requestPersistentStorage(true);
        expect(persist).toHaveBeenCalledTimes(2);
    });
});
