import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsProvider, useSettings } from "~/lib/providers/SettingsProvider";
import { PersistenceBanner } from "~/components/ui/StorageNotices";
import { clearStorageIssue, getStorageIssues } from "~/lib/storage-notices";
import { SETTINGS_ENC_KEY } from "~/lib/settings-crypto";

const { decrypt, encrypt } = vi.hoisted(() => ({ decrypt: vi.fn(), encrypt: vi.fn() }));
vi.mock("~/lib/settings-crypto", async (original) => ({
    ...(await original<typeof import("~/lib/settings-crypto")>()),
    settingsCryptoAvailable: () => true,
    decryptSettingsPayload: decrypt,
    encryptSettingsPayload: encrypt,
}));

beforeEach(() => {
    localStorage.clear();
    decrypt.mockResolvedValue(null);
    encrypt.mockResolvedValue("test-ciphertext");
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    });
});
afterEach(() => {
    for (const issue of getStorageIssues()) clearStorageIssue(issue.id);
    localStorage.clear();
});

function Harness() {
    const { loaded, settings, updateSettings } = useSettings();
    return (
        <>
            <PersistenceBanner />
            <p>{loaded ? `Loaded ${settings.theme}` : "Loading"}</p>
            <button onClick={() => updateSettings({ theme: "light" })}>Change theme</button>
        </>
    );
}

describe("settings write failures", () => {
    it("reports quota failure while retaining updated settings in memory", async () => {
        const set = Storage.prototype.setItem;
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
            this: Storage,
            key,
            value,
        ) {
            if (key === SETTINGS_ENC_KEY) throw new DOMException("full", "QuotaExceededError");
            set.call(this, key, value);
        });
        render(
            <SettingsProvider>
                <Harness />
            </SettingsProvider>,
        );
        await waitFor(() =>
            expect(screen.getByRole("alert").textContent).toContain("storage is full"),
        );
        fireEvent.click(screen.getByRole("button", { name: "Change theme" }));
        expect(screen.getByText("Loaded light")).toBeDefined();
    });
    it("never overwrites unreadable encrypted settings", async () => {
        localStorage.setItem(SETTINGS_ENC_KEY, "unreadable-test-payload");
        render(
            <SettingsProvider>
                <Harness />
            </SettingsProvider>,
        );
        await waitFor(() =>
            expect(screen.getByRole("alert").textContent).toContain("original data is untouched"),
        );
        fireEvent.click(screen.getByRole("button", { name: "Change theme" }));
        await waitFor(() => expect(screen.getByText("Loaded light")).toBeDefined());
        expect(localStorage.getItem(SETTINGS_ENC_KEY)).toBe("unreadable-test-payload");
        expect(encrypt).not.toHaveBeenCalled();
    });
});
