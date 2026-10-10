import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppSidebar, SettingsDialog } from "~/components/sidebar/AppSidebar";
import { ChatGPTSessionProvider } from "~/lib/providers/ChatGPTSessionProvider";
import { SettingsProvider, useSettings } from "~/lib/providers/SettingsProvider";
import { getSidebarPanel, setSidebarPanel, subscribeSidebarPanel } from "~/lib/sidebar-panel";

const { decrypt, encrypt } = vi.hoisted(() => ({ decrypt: vi.fn(), encrypt: vi.fn() }));
vi.mock("~/lib/settings-crypto", async (original) => ({
    ...(await original<typeof import("~/lib/settings-crypto")>()),
    settingsCryptoAvailable: () => true,
    decryptSettingsPayload: decrypt,
    encryptSettingsPayload: encrypt,
}));

beforeEach(() => {
    localStorage.clear();
    setSidebarPanel("chats");
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

describe("sidebar panel store", () => {
    it("notifies subscribers only when the panel actually changes", () => {
        const listener = vi.fn();
        const unsubscribe = subscribeSidebarPanel(listener);
        setSidebarPanel("chats");
        expect(listener).not.toHaveBeenCalled();
        setSidebarPanel("settings");
        setSidebarPanel("settings");
        expect(listener).toHaveBeenCalledTimes(1);
        expect(getSidebarPanel()).toBe("settings");
        unsubscribe();
        setSidebarPanel("chats");
        expect(listener).toHaveBeenCalledTimes(1);
    });
});

describe("settings updates that change nothing", () => {
    let renders = 0;
    let api: ReturnType<typeof useSettings> | null = null;
    function Probe() {
        api = useSettings();
        renders += 1;
        return null;
    }
    const mountProbe = async () => {
        renders = 0;
        render(
            <SettingsProvider>
                <Probe />
            </SettingsProvider>,
        );
        await waitFor(() => expect(api?.loaded).toBe(true));
        await waitFor(() => expect(encrypt).toHaveBeenCalled());
    };

    it("does not re-render consumers or re-encrypt when a patch repeats current values", async () => {
        await mountProbe();
        act(() => api!.updateProvider("grok", { apiKey: "", baseUrl: "", enabled: true }));
        act(() => api!.updateSettings({ grokBuildLoginEnabled: true }));
        await waitFor(() => expect(api!.settings.providers.grok?.enabled).toBe(true));
        await act(async () => {
            await Promise.resolve();
        });

        const settled = renders;
        const writes = encrypt.mock.calls.length;
        act(() => api!.updateProvider("grok", { apiKey: "", baseUrl: "", enabled: true }));
        act(() => api!.updateSettings({ grokBuildLoginEnabled: true }));
        act(() => api!.updateChat({ provider: api!.settings.chat.provider }));
        await act(async () => {
            await Promise.resolve();
        });

        expect(renders).toBe(settled);
        expect(encrypt.mock.calls.length).toBe(writes);
    });

    it("still applies real changes", async () => {
        await mountProbe();
        act(() => api!.updateProvider("grok", { enabled: true }));
        await waitFor(() => expect(api!.settings.providers.grok?.enabled).toBe(true));
        act(() => api!.updateProvider("grok", { enabled: false }));
        await waitFor(() => expect(api!.settings.providers.grok?.enabled).toBe(false));
    });
});

describe("settings dialog ownership", () => {
    const noop = () => undefined;
    const sidebarProps = {
        threads: [],
        projects: [],
        activeThreadId: null,
        onSelectThread: noop,
        onNewChat: noop,
        onDeleteThread: noop,
        onRenameThread: noop,
        onMoveThread: noop,
        onCreateProject: noop,
        onUpdateProject: noop,
        onDeleteProject: noop,
    };

    it("opens exactly one Settings dialog even when the sidebar is mounted twice", async () => {
        // Below the md breakpoint the hidden desktop aside and the mobile overlay
        // both render the sidebar; each used to own a Settings dialog.
        render(
            <SettingsProvider>
                <ChatGPTSessionProvider>
                    <AppSidebar {...sidebarProps} />
                    <AppSidebar {...sidebarProps} />
                    <SettingsDialog scopeId={null} />
                </ChatGPTSessionProvider>
            </SettingsProvider>,
        );
        expect(screen.queryAllByLabelText("Search settings")).toHaveLength(0);

        fireEvent.click(screen.getAllByRole("button", { name: /^Settings$/ })[0]);

        await waitFor(() => expect(screen.queryAllByLabelText("Search settings")).toHaveLength(1));
        expect(getSidebarPanel()).toBe("settings");
    });
});
