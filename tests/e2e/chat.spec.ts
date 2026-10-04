import { expect, test, type Page } from "@playwright/test";

const startupFailures = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
    const failures: string[] = [];
    startupFailures.set(page, failures);
    page.on("pageerror", (error) => failures.push(error.message));
    page.on("response", (response) => {
        if (response.status() === 504 && response.url().includes("/node_modules/.vite/"))
            failures.push(`Stale Vite dependency: ${response.url()}`);
    });
});
test.afterEach(({ page }) => {
    expect(
        startupFailures.get(page),
        "Workspace must hydrate without stale dependencies or uncaught errors",
    ).toEqual([]);
});

async function seed(page: Page, generativeUi = false) {
    await page.addInitScript(
        ({ generativeUi }) => {
            if (localStorage.getItem("test:seeded")) return;
            localStorage.setItem("test:seeded", "true");
            localStorage.setItem(
                "prismium-lite:settings",
                JSON.stringify({
                    setupComplete: true,
                    theme: "dark",
                    chat: { provider: "custom", model: "gpt-4o-mini" },
                    providers: {
                        custom: {
                            id: "custom",
                            name: "Mock provider",
                            enabled: true,
                            apiKey: "sk-test-not-a-real-key",
                            baseUrl: "http://127.0.0.1:18765/v1",
                            openAICompatible: {
                                apiMode: "chat",
                                authMode: "none",
                                reasoningWithTools: "auto",
                                capabilityOverrides: { tools: true },
                            },
                        },
                    },
                    toolAccess: {
                        webSearch: false,
                        mcp: false,
                        memory: false,
                        knowledge: false,
                        linux: false,
                        generativeUi,
                    },
                    memoryEnabled: false,
                    memoryAutoAttach: false,
                    linuxEnvironment: false,
                    knowledgeEnabled: false,
                    mcpServers: [],
                }),
            );
        },
        { generativeUi },
    );
    await page.route(/https:\/\//, (route) => route.abort());
    await page.goto("/workspace");
    await expect(page.getByRole("textbox", { name: "Message input", exact: true })).toBeVisible({
        timeout: 30_000,
    });
}

for (const generativeUi of [false, true]) {
    test(`composer retains keystrokes and sends (OpenUI ${generativeUi ? "on" : "off"})`, async ({
        page,
    }) => {
        await seed(page, generativeUi);
        const input = page.getByRole("textbox", { name: "Message input", exact: true });
        await input.pressSequentially("hello from the regression test", { delay: 20 });
        await expect(input).toHaveValue("hello from the regression test");
        await input.press("Enter");
        await expect(
            page.getByText("Mock reply: your message arrived and streamed successfully.", {
                exact: true,
            }),
        ).toBeVisible();
        await expect(input).toHaveValue("");
        await expect(
            page.getByRole("button", { name: "Stop generating", exact: true }),
        ).toHaveCount(0);
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        new Promise<boolean>((resolve, reject) => {
                            const request = indexedDB.open("prismium-lite-db");
                            request.onerror = () => reject(request.error);
                            request.onsuccess = () => {
                                const db = request.result;
                                const transaction = db.transaction("messages", "readonly");
                                const rows = transaction.objectStore("messages").getAll();
                                rows.onsuccess = () =>
                                    resolve(
                                        rows.result.some(
                                            (row) =>
                                                row.content ===
                                                "Mock reply: your message arrived and streamed successfully.",
                                        ),
                                    );
                                rows.onerror = () => reject(rows.error);
                                transaction.oncomplete = () => db.close();
                            };
                        }),
                ),
            )
            .toBe(true);
        await page.reload();
        await expect(
            page.getByText("Mock reply: your message arrived and streamed successfully.", {
                exact: true,
            }),
        ).toBeVisible();
    });
}

test("reload mid-stream keeps the prompt and offers retry", async ({ page }) => {
    await seed(page);
    const input = page.getByRole("textbox", { name: "Message input", exact: true });
    await input.fill("mock-slow");
    await input.press("Enter");
    await expect
        .poll(
            () =>
                page.evaluate(
                    () =>
                        new Promise<boolean>((resolve, reject) => {
                            const request = indexedDB.open("prismium-lite-db");
                            request.onerror = () => reject(request.error);
                            request.onsuccess = () => {
                                const db = request.result;
                                const transaction = db.transaction("messages", "readonly");
                                const rows = transaction.objectStore("messages").getAll();
                                rows.onsuccess = () =>
                                    resolve(rows.result.some((row) => row.content === "mock-slow"));
                                rows.onerror = () => reject(rows.error);
                                transaction.oncomplete = () => db.close();
                            };
                        }),
                ),
            { timeout: 1_500 },
        )
        .toBe(true);
    await page.reload();
    const restored = page.getByRole("textbox", { name: "Message input", exact: true });
    await expect(page.getByText("mock-slow", { exact: true })).toBeVisible();
    await expect(restored).toBeEnabled();
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.getByText(/^Mock reply:/)).toBeVisible({ timeout: 15_000 });
});

test("shift-enter adds a newline; abort unlocks composer", async ({ page }) => {
    await seed(page);
    const input = page.getByRole("textbox", { name: "Message input", exact: true });
    await input.fill("mock-slow");
    await expect(input).toHaveValue("mock-slow");
    await input.press("Shift+Enter");
    await expect(input).toHaveValue("mock-slow\n");
    await input.press("Enter");
    await expect(page.getByText(/^Mock reply:/)).toBeVisible();
    await page.getByRole("button", { name: "Stop generating", exact: true }).click();
    await expect(input).toBeEnabled();
    await input.fill("next message");
    await expect(input).toHaveValue("next message");
});

test("provider failures are visible", async ({ page }) => {
    await seed(page);
    const input = page.getByRole("textbox", { name: "Message input", exact: true });
    await input.fill("mock-error");
    await input.press("Enter");
    await expect(
        page
            .getByRole("alert")
            .filter({ hasText: /rate limit/i })
            .first(),
    ).toBeVisible({ timeout: 30_000 });
});

test("quota failures retain the reply, offer an export, and retry safely", async ({ page }) => {
    await page.addInitScript(() => {
        const put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (...args) {
            if (
                this.name === "messages" &&
                (globalThis as unknown as { testQuota?: boolean }).testQuota
            ) {
                throw new DOMException("Test storage full", "QuotaExceededError");
            }
            return put.apply(this, args);
        };
    });
    await seed(page);
    await page.evaluate(() => {
        (globalThis as unknown as { testQuota?: boolean }).testQuota = true;
    });
    const input = page.getByRole("textbox", { name: "Message input", exact: true });
    await input.fill("quota test");
    await expect(input).toHaveValue("quota test");
    await input.press("Enter");
    await expect(
        page.getByText("Mock reply: your message arrived and streamed successfully.", {
            exact: true,
        }),
    ).toBeVisible();
    await expect(page.getByRole("alert", { name: "Storage warning" })).toContainText(
        "storage is full",
    );
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download unsaved chat" }).click();
    expect((await downloadEvent).suggestedFilename()).toBe("ai-diy-unsaved-chat.json");
    await page.evaluate(() => {
        (globalThis as unknown as { testQuota?: boolean }).testQuota = false;
    });
    await page.getByRole("button", { name: "Retry saving chat", exact: true }).click();
    await expect(page.getByRole("alert", { name: "Storage warning" })).toHaveCount(0);
    await page.reload();
    await expect(
        page.getByText("Mock reply: your message arrived and streamed successfully.", {
            exact: true,
        }),
    ).toBeVisible();
});

test("storage usage is available in Import & Export", async ({ page }) => {
    await seed(page);
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: "Import & Export", exact: true }).click();
    await expect(page.getByRole("region", { name: "Browser storage" })).toContainText("Quota");
});

test("hostile model HTML is sanitized and cannot exfiltrate", async ({ page }) => {
    const requestedUrls: string[] = [];
    page.on("request", (request) => requestedUrls.push(request.url()));
    await seed(page);
    const input = page.getByRole("textbox", { name: "Message input", exact: true });
    await input.fill("hostile-html");
    await input.press("Enter");
    await expect(page.getByText("Hostile reply delivered.")).toBeVisible({ timeout: 30_000 });

    // No passive request may leave the page towards the hostile URLs.
    expect(requestedUrls.filter((url) => url.includes("/pixel") || url.includes("/frame"))).toEqual(
        [],
    );

    // Active content is stripped; math survives sanitization.
    expect(
        await page.evaluate(() => ({
            pwned: (globalThis as { __pwned?: unknown }).__pwned ?? null,
            hostileImgs: document.querySelectorAll('img[src*="/pixel"]').length,
        })),
    ).toEqual({ pwned: null, hostileImgs: 0 });
    await expect(page.locator(".katex").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /load image from 127\.0\.0\.1/i })).toBeVisible();
});
