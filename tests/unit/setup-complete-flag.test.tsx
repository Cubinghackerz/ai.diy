import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsProvider, useSettings } from "~/lib/providers/SettingsProvider";

const { decrypt, encrypt } = vi.hoisted(() => ({ decrypt: vi.fn(), encrypt: vi.fn() }));
vi.mock("~/lib/settings-crypto", async (original) => ({
    ...(await original<typeof import("~/lib/settings-crypto")>()),
    settingsCryptoAvailable: () => true,
    decryptSettingsPayload: decrypt,
    encryptSettingsPayload: encrypt,
}));

const FLAG = "prismium-lite:setup-complete";
let api: ReturnType<typeof useSettings> | null = null;
function Probe() {
    api = useSettings();
    return null;
}

beforeEach(() => {
    localStorage.clear();
    decrypt.mockResolvedValue(null);
    encrypt.mockResolvedValue("test-ciphertext");
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    });
});
afterEach(() => localStorage.clear());

const mount = async () => {
    render(
        <SettingsProvider>
            <Probe />
        </SettingsProvider>,
    );
    await waitFor(() => expect(api?.loaded).toBe(true));
    await waitFor(() => expect(encrypt).toHaveBeenCalled());
};

describe("the setup-complete flag the landing page reads", () => {
    it("is not written for a visitor who has not finished setup", async () => {
        await mount();
        expect(localStorage.getItem(FLAG)).toBeNull();
        // The root provider persists defaults on every page; that alone must not count.
        expect(localStorage.getItem("prismium-lite:theme")).not.toBeNull();
    });

    it("is written once setup is complete", async () => {
        await mount();
        act(() => api!.updateSettings({ setupComplete: true }));
        await waitFor(() => expect(localStorage.getItem(FLAG)).toBe("1"));
    });

    it("is written on load for someone who finished setup before the flag existed", async () => {
        localStorage.setItem("prismium-lite:settings", JSON.stringify({ setupComplete: true }));
        await mount();
        await waitFor(() => expect(localStorage.getItem(FLAG)).toBe("1"));
    });
});

describe("interface mode for stored settings", () => {
    it("keeps the full interface for settings saved before the simple one existed", async () => {
        localStorage.setItem("prismium-lite:settings", JSON.stringify({ setupComplete: true }));
        await mount();
        expect(api!.settings.interfaceMode).toBe("full");
    });

    it("gives new installs and unfinished setups the simple interface", async () => {
        await mount();
        expect(api!.settings.interfaceMode).toBe("simple");
    });

    it("respects an explicit choice either way", async () => {
        localStorage.setItem(
            "prismium-lite:settings",
            JSON.stringify({ setupComplete: false, interfaceMode: "full" }),
        );
        await mount();
        expect(api!.settings.interfaceMode).toBe("full");
    });
});
