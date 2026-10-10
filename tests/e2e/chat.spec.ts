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

async function seed(page: Page, generativeUi = false, externalMedia?: boolean) {
    await page.addInitScript(
        ({ generativeUi, externalMedia }) => {
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
                        ...(externalMedia === undefined ? {} : { externalMedia }),
                    },
                    memoryEnabled: false,
                    memoryAutoAttach: false,
                    linuxEnvironment: false,
                    knowledgeEnabled: false,
                    mcpServers: [],
                }),
            );
        },
        { generativeUi, externalMedia },
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

/** The only third-party hosts generative UI may contact. */
const MEDIA_HOSTS = new Set([
    "en.wikipedia.org",
    "thumb.wikimedia.org",
    "upload.wikimedia.org",
    "tiles.openfreemap.org",
]);

const PIXEL = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
);

/** Fixtures for the only third-party hosts generative UI may call. */
async function fixtureExternalMedia(page: Page) {
    await page.route(/https:\/\/en\.wikipedia\.org\/api\/rest_v1\/page\/summary\//, (route) => {
        const title = decodeURIComponent(new URL(route.request().url()).pathname.split("/").pop()!);
        return route.fulfill({
            json: {
                title,
                extract: `${title} fixture`,
                thumbnail: { source: "https://thumb.wikimedia.org/fixture.png" },
                coordinates: { lat: 41.89, lon: 12.49 },
            },
        });
    });
    await page.route("https://thumb.wikimedia.org/**", (route) =>
        route.fulfill({ contentType: "image/png", body: PIXEL }),
    );
    await page.route("https://tiles.openfreemap.org/**", (route) =>
        route.fulfill({ json: { version: 8, sources: {}, layers: [] } }),
    );
}

async function send(page: Page, text: string) {
    const input = page.getByRole("textbox", { name: "Message input", exact: true });
    await input.fill(text);
    await input.press("Enter");
}

test("renders rich generative UI from a tool call with photos, timeline, map and suggestions", async ({
    page,
}) => {
    const mediaHosts: string[] = [];
    page.on("request", (request) => {
        const { hostname } = new URL(request.url());
        if (MEDIA_HOSTS.has(hostname)) mediaHosts.push(hostname);
    });
    await seed(page, true);
    await fixtureExternalMedia(page);
    await send(page, "mock-rich plan my day");

    await expect(page.getByRole("heading", { name: "Mock plan" })).toBeVisible();
    const timeline = page.locator(".rich-timeline");
    await expect(timeline.getByText("Colosseum")).toBeVisible();
    await expect(timeline.getByText("Roman Forum")).toBeVisible();
    await expect(page.locator(".rich-gallery img")).toHaveCount(2);
    await expect(page.locator(".rich-gallery img").first()).toHaveAttribute(
        "src",
        "https://thumb.wikimedia.org/fixture.png",
    );
    // A real WebGL map, not the text fallback: the canvas and both markers must appear.
    await expect(page.locator(".rich-map .maplibregl-canvas")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".rich-map .rich-marker")).toHaveCount(2);
    await expect(page.locator(".rich-map-list")).toHaveCount(0);
    await page.locator(".rich-timeline-row").first().click();
    await expect(page.locator(".rich-marker[data-selected='true']")).toHaveText("1");
    await expect(page.getByText("Related Queries")).toBeVisible();

    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Add Borghese Gallery", { exact: true })).toBeVisible();
    await expect(
        page.getByText("Mock reply: your message arrived and streamed successfully.", {
            exact: true,
        }),
    ).toBeVisible();
    expect(new Set(mediaHosts)).toEqual(
        new Set(["en.wikipedia.org", "thumb.wikimedia.org", "tiles.openfreemap.org"]),
    );
});

test("makes no third-party requests when external photos and maps is off", async ({ page }) => {
    const mediaRequests: string[] = [];
    page.on("request", (request) => {
        if (MEDIA_HOSTS.has(new URL(request.url()).hostname)) mediaRequests.push(request.url());
    });
    await seed(page, true, false);
    await send(page, "mock-rich plan my day");

    await expect(page.getByRole("heading", { name: "Mock plan" })).toBeVisible();
    await expect(page.getByText(/External photos and maps is turned off/)).toBeVisible();
    await expect(page.locator(".rich-gallery img")).toHaveCount(0);
    await expect(page.locator(".rich-map .maplibregl-canvas")).toHaveCount(0);
    expect(mediaRequests).toEqual([]);
});

test("OpenUI link buttons open https targets but never javascript: URLs", async ({ page }) => {
    const opened: string[] = [];
    page.context().on("page", (popup) => opened.push(popup.url()));
    const requested: string[] = [];
    page.context().on("request", (request) => requested.push(request.url()));
    await page.context().route(/https:\/\//, (route) => route.abort());
    await seed(page, true);
    await send(page, "mock-rich-links");

    await page.getByRole("button", { name: "Open unsafe" }).click();
    await page.waitForTimeout(750);
    expect(opened).toEqual([]);

    await page.getByRole("button", { name: "Open safe" }).click();
    await expect.poll(() => opened.length).toBe(1);
    await expect
        .poll(() => requested.filter((url) => url.startsWith("https://example.com/ok")).length)
        .toBeGreaterThan(0);
    expect(await page.evaluate(() => "__pwned" in window)).toBe(false);
});

test("renders a json-render dashboard and locks its buttons while a reply is running", async ({
    page,
}) => {
    const mediaRequests: string[] = [];
    page.on("request", (request) => {
        if (MEDIA_HOSTS.has(new URL(request.url()).hostname)) mediaRequests.push(request.url());
    });
    await seed(page, true);
    await send(page, "mock-json show me a dashboard");

    await expect(page.getByRole("heading", { name: "Mock dashboard" })).toBeVisible();
    await expect(page.getByText("$48k")).toBeVisible();
    await expect(page.getByRole("table")).toContainText("Pro");
    await expect(page.getByRole("img", { name: "Bar chart" })).toBeVisible();
    await page.getByRole("tab", { name: "Region" }).click();
    await expect(page.getByText("EMEA leads with 52 users.")).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
    // Specs are data: no network is needed to draw them.
    expect(mediaRequests).toEqual([]);

    const button = page.getByRole("button", { name: "Show by region" });
    await expect(button).toBeEnabled();
    await button.click();
    await expect(page.getByText("mock-slow Show by region", { exact: true })).toBeVisible();
    // While the slow reply streams, the card cannot queue another message.
    await expect(button).toBeDisabled();
    await button.click({ force: true });
    await expect(page.getByText("mock-slow Show by region", { exact: true })).toHaveCount(1);
    await expect(button).toBeEnabled({ timeout: 20_000 });
});

test("json-render shows finished elements while the call is still streaming", async ({ page }) => {
    await seed(page, true);
    await send(page, "mock-json-slow show me a dashboard");
    // The heading arrives early; the table (a later patch) must not exist yet,
    // while the thread is still running.
    const heading = page.getByRole("heading", { name: "Mock dashboard" });
    await expect(heading).toBeVisible();
    await expect(page.getByRole("button", { name: "Stop generating", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Show by region" })).toHaveCount(0);
    // Once complete, everything is there and the loading line is gone.
    await expect(page.getByRole("button", { name: "Show by region" })).toBeVisible({
        timeout: 20_000,
    });
    await expect(page.getByRole("table")).toContainText("Pro");
    await expect(page.getByText("Building interface…")).toHaveCount(0);
});

test("OpenUI suggestion buttons are locked while a reply is running", async ({ page }) => {
    await seed(page, true);
    await fixtureExternalMedia(page);
    await send(page, "mock-rich plan my day");
    const add = page.getByRole("button", { name: "Add", exact: true });
    await expect(add).toBeEnabled();
    await send(page, "mock-slow keep running");
    await expect(page.getByRole("button", { name: "Stop generating", exact: true })).toBeVisible();
    await expect(add).toBeDisabled();
    await expect(add).toBeEnabled({ timeout: 20_000 });
});

test("OpenUI and json-render calls can follow each other in one conversation", async ({ page }) => {
    await seed(page, true);
    await fixtureExternalMedia(page);
    const stop = page.getByRole("button", { name: "Stop generating", exact: true });
    await send(page, "mock-rich plan my day");
    await expect(page.getByRole("heading", { name: "Mock plan" })).toBeVisible();
    await expect(stop).toHaveCount(0, { timeout: 15_000 });
    await send(page, "mock-json show me a dashboard");
    await expect(page.getByRole("heading", { name: "Mock dashboard" })).toBeVisible();
    await expect(stop).toHaveCount(0, { timeout: 15_000 });
    // Both cards stay on screen and usable once the thread is idle.
    await expect(page.getByRole("heading", { name: "Mock plan" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Show by region" })).toBeEnabled();
});
