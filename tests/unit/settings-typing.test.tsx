import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsDialog } from "~/components/sidebar/AppSidebar";
import { ChatGPTSessionProvider } from "~/lib/providers/ChatGPTSessionProvider";
import { SettingsProvider, useSettings } from "~/lib/providers/SettingsProvider";
import { setSidebarPanel } from "~/lib/sidebar-panel";

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
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => Response.json({ status: "unauthenticated" })),
    );
});
afterEach(() => {
    setSidebarPanel("chats");
    localStorage.clear();
    vi.unstubAllGlobals();
});

let api: ReturnType<typeof useSettings> | null = null;
function Probe() {
    api = useSettings();
    return null;
}

async function openInstructions() {
    render(
        <SettingsProvider>
            <ChatGPTSessionProvider>
                <Probe />
                <SettingsDialog scopeId={null} />
            </ChatGPTSessionProvider>
        </SettingsProvider>,
    );
    await waitFor(() => expect(api?.loaded).toBe(true));
    act(() => setSidebarPanel("settings"));
    const nav = await screen.findByRole("button", { name: /^Instructions/ });
    fireEvent.click(nav);
    return screen.findByLabelText("Custom system instructions") as Promise<HTMLTextAreaElement>;
}

describe("Settings text fields", () => {
    it("keeps typing local, then saves the custom instructions once after a pause", async () => {
        const field = await openInstructions();
        const before = encrypt.mock.calls.length;

        for (const text of ["B", "Be", "Be concise", "Be concise."]) {
            fireEvent.change(field, { target: { value: text } });
        }
        // The workspace does not see (or re-render for) each keystroke.
        expect(api!.settings.chat.systemPrompt ?? "").toBe("");
        expect(encrypt.mock.calls.length).toBe(before);
        expect(field.value).toBe("Be concise.");

        await waitFor(() => expect(api!.settings.chat.systemPrompt).toBe("Be concise."));
    });

    it("does not lose unsaved instructions when Settings is closed straight away", async () => {
        const field = await openInstructions();
        fireEvent.change(field, { target: { value: "Always answer in French." } });
        expect(api!.settings.chat.systemPrompt ?? "").toBe("");

        act(() => setSidebarPanel("chats"));
        await waitFor(() =>
            expect(api!.settings.chat.systemPrompt).toBe("Always answer in French."),
        );
    });

    it("Clear empties the field and the saved value immediately", async () => {
        const field = await openInstructions();
        fireEvent.change(field, { target: { value: "temporary" } });
        fireEvent.blur(field);
        await waitFor(() => expect(api!.settings.chat.systemPrompt).toBe("temporary"));

        fireEvent.click(screen.getByRole("button", { name: "Clear" }));
        expect(field.value).toBe("");
        await waitFor(() => expect(api!.settings.chat.systemPrompt).toBe(""));
    });
});
