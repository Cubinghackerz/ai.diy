import { expect, test, type Page } from "@playwright/test";

const failures = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
    const caught: string[] = [];
    failures.set(page, caught);
    page.on("pageerror", (error) => caught.push(error.message));
});
test.afterEach(({ page }) => {
    expect(failures.get(page), "No uncaught page errors").toEqual([]);
});

const MOCK_PROVIDER_SETTINGS = {
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
    toolAccess: { webSearch: false, mcp: false, memory: false, knowledge: false, linux: false },
    memoryEnabled: false,
    linuxEnvironment: false,
    knowledgeEnabled: false,
    mcpServers: [],
};

async function seed(page: Page, settings: Record<string, unknown>) {
    await page.addInitScript((value) => {
        if (localStorage.getItem("test:seeded")) return;
        localStorage.setItem("test:seeded", "true");
        localStorage.setItem("prismium-lite:settings", JSON.stringify(value));
    }, settings);
}

const input = (page: Page) => page.getByRole("textbox", { name: "Message input", exact: true });

test.describe("simple interface", () => {
    test("a first visit asks for one sign-in and recommends ChatGPT", async ({ page }) => {
        await page.route(/https:\/\//, (route) => route.abort());
        await page.goto("/workspace");

        const setup = page.locator("[data-setup-gate]");
        await expect(setup).toHaveAttribute("data-setup-variant", "simple", { timeout: 30_000 });
        await expect(page.getByRole("heading", { name: "Welcome to ai.diy" })).toBeVisible();
        await expect(page.getByText(/Recommended/)).toBeVisible();
        await expect(page.getByRole("button", { name: "Continue with ChatGPT" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Continue with OpenRouter" })).toBeVisible();
        // What the old confirmation dialog said stays on screen next to the button.
        await expect(page.getByText(/relayed through this server to OpenAI/)).toBeVisible();
        // No wizard on the first screen.
        await expect(page.getByText("Verify", { exact: true })).toHaveCount(0);
    });

    test("an API key is one click away, and so is the way back", async ({ page }) => {
        await page.route(/https:\/\//, (route) => route.abort());
        await page.goto("/workspace");
        await page
            .getByRole("button", { name: "Use an API key or another provider" })
            .click({ timeout: 30_000 });
        await expect(page.getByText("Provider", { exact: true }).first()).toBeVisible();
        await expect(page.getByRole("button", { name: "Continue to chat" })).toBeDisabled();
        await page.getByRole("button", { name: "Back to simple sign-in" }).click();
        await expect(page.getByRole("button", { name: "Continue with ChatGPT" })).toBeVisible();
    });

    test("an existing ChatGPT session goes straight into the chat, with no model or tools step", async ({
        page,
    }) => {
        const json = (body: unknown) => ({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(body),
        });
        await page.route("**/api/chatgpt/session", (route) =>
            route.fulfill(
                json({
                    status: "authenticated",
                    user: { accountId: "a", email: "me@example.com", plan: "plus" },
                    persistence: "durable",
                }),
            ),
        );
        await page.route("**/api/models", (route) =>
            route.fulfill(
                json({
                    live: true,
                    models: [
                        { id: "gpt-6.1-sol", name: "GPT-6.1 Sol", provider: "chatgpt" },
                        { id: "gpt-5.6-luna", name: "GPT-5.6 Luna", provider: "chatgpt" },
                    ],
                }),
            ),
        );
        await page.route(/https:\/\//, (route) => route.abort());
        await page.goto("/workspace");

        await expect(input(page)).toBeVisible({ timeout: 30_000 });
        await expect(input(page)).toHaveAttribute("placeholder", "Ask anything");
        // The newest model in the account was picked for them.
        await expect(
            page.getByRole("button", { name: /GPT-6\.1 Sol|gpt-6\.1-sol/i }),
        ).toBeVisible();
    });

    test("the input bar is clean, sends, and keeps the chat list out of the way", async ({
        page,
    }) => {
        await seed(page, { ...MOCK_PROVIDER_SETTINGS, interfaceMode: "simple" });
        await page.route(/https:\/\//, (route) => route.abort());
        await page.goto("/workspace");

        await expect(input(page)).toHaveAttribute("placeholder", "Ask anything", {
            timeout: 30_000,
        });
        await expect(page.getByRole("heading", { name: "What can I help with?" })).toBeVisible();
        // None of the full interface's chrome.
        await expect(page.getByRole("button", { name: "Composer extras" })).toHaveCount(0);
        await expect(page.getByText("USE A PRESET")).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Start voice input" })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Attach files" })).toBeVisible();
        await expect(page.locator("aside").getByRole("button", { name: "Chats" })).toHaveCount(0);

        await input(page).pressSequentially("hello from the simple bar", { delay: 20 });
        await input(page).press("Enter");
        await expect(
            page.getByText("Mock reply: your message arrived and streamed successfully.", {
                exact: true,
            }),
        ).toBeVisible();
        await expect(input(page)).toHaveValue("");
        // Token chips are for the full view.
        await expect(page.locator("[data-slot=aui_assistant-message-meta]")).toHaveCount(0);
    });

    test("Full view and Settings switch between the two interfaces", async ({ page }) => {
        await seed(page, { ...MOCK_PROVIDER_SETTINGS, interfaceMode: "simple" });
        await page.route(/https:\/\//, (route) => route.abort());
        await page.goto("/workspace");
        await expect(input(page)).toHaveAttribute("placeholder", "Ask anything", {
            timeout: 30_000,
        });

        await page.getByRole("button", { name: "Full view" }).click();
        await expect(page.getByRole("button", { name: "Composer extras" })).toBeVisible();
        await expect(page.getByText("USE A PRESET")).toBeVisible();

        await page.getByRole("button", { name: "Settings", exact: true }).click();
        await page.getByRole("button", { name: /^Appearance/ }).click();
        const simple = page.getByRole("radio", { name: /^Simple/ });
        await expect(page.getByRole("radio", { name: /^Full/ })).toHaveAttribute(
            "aria-checked",
            "true",
        );
        await simple.click();
        await expect(simple).toHaveAttribute("aria-checked", "true");
        await page.keyboard.press("Escape");
        await expect(input(page)).toHaveAttribute("placeholder", "Ask anything");
    });
});

test("people who set ai.diy up before keep the full interface", async ({ page }) => {
    // Stored settings from before the simple interface existed: no interfaceMode at all.
    await seed(page, MOCK_PROVIDER_SETTINGS);
    await page.route(/https:\/\//, (route) => route.abort());
    await page.goto("/workspace");
    await expect(input(page)).toBeVisible({ timeout: 30_000 });
    await expect(input(page)).toHaveAttribute("placeholder", /Send a message/);
    await expect(page.getByRole("button", { name: "Composer extras" })).toBeVisible();
});

test.describe("landing page for returning visitors", () => {
    test("a first-time visitor sees the page", async ({ page }) => {
        await page.goto("/");
        await expect(page).toHaveURL(/\/$/);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });

    test("someone who finished setup goes straight back to the workspace", async ({ page }) => {
        await seed(page, { ...MOCK_PROVIDER_SETTINGS, interfaceMode: "simple" });
        await page.route(/https:\/\//, (route) => route.abort());
        await page.goto("/workspace");
        await expect(input(page)).toBeVisible({ timeout: 30_000 });
        await expect
            .poll(() => page.evaluate(() => localStorage.getItem("prismium-lite:setup-complete")))
            .toBe("1");

        await page.goto("/");
        await expect(page).toHaveURL(/\/workspace$/, { timeout: 30_000 });
    });

    test("opening the page twice is not enough to be sent away from it", async ({ page }) => {
        // The root provider stores default settings on every page, landing included.
        await page.goto("/");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await page.goto("/");
        await expect(page).toHaveURL(/\/$/);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });

    test("/?landing always shows the page", async ({ page }) => {
        await seed(page, MOCK_PROVIDER_SETTINGS);
        await page.route(/https:\/\//, (route) => route.abort());
        await page.goto("/workspace");
        await expect(input(page)).toBeVisible({ timeout: 30_000 });
        await page.goto("/?landing");
        await expect(page).toHaveURL(/\?landing$/);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
});

test.describe("Continue with OpenRouter", () => {
    test("coming back from OpenRouter finishes setup with the key it issued", async ({ page }) => {
        // The verifier this tab saved before it left for openrouter.ai.
        await page.addInitScript(() => {
            if (sessionStorage.getItem("test:seeded")) return;
            sessionStorage.setItem("test:seeded", "1");
            sessionStorage.setItem(
                "aidiy:openrouter-oauth",
                JSON.stringify({ verifier: "test-verifier", startedAt: Date.now() }),
            );
        });
        let exchanged: Record<string, unknown> | null = null;
        await page.route("https://openrouter.ai/api/v1/auth/keys", async (route) => {
            if (route.request().method() === "OPTIONS") {
                await route.fulfill({
                    status: 204,
                    headers: {
                        "access-control-allow-origin": "*",
                        "access-control-allow-headers": "content-type",
                        "access-control-allow-methods": "POST",
                    },
                });
                return;
            }
            exchanged = route.request().postDataJSON();
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: { "access-control-allow-origin": "*" },
                body: JSON.stringify({ key: "sk-or-v1-from-e2e" }),
            });
        });
        await page.route(/^https:\/\/(?!openrouter\.ai\/api\/v1\/auth\/keys)/, (route) =>
            route.abort(),
        );
        await page.goto("/workspace?code=e2e-code");

        await expect(input(page)).toBeVisible({ timeout: 30_000 });
        await expect(page).toHaveURL(/\/workspace$/);
        expect(exchanged).toEqual({
            code: "e2e-code",
            code_verifier: "test-verifier",
            code_challenge_method: "S256",
        });
        // OpenRouter is the active provider, with a model picked for them.
        await expect(
            page.getByRole("button", { name: /GPT-5 \(OpenRouter\)|openai\/gpt-5/i }),
        ).toBeVisible();
    });

    test("an unrelated ?code is left alone and setup still shows", async ({ page }) => {
        await page.route(/https:\/\//, (route) => route.abort());
        await page.goto("/workspace?code=not-ours");
        await expect(page.locator("[data-setup-gate]")).toBeVisible({ timeout: 30_000 });
        await expect(page).toHaveURL(/code=not-ours/);
    });
});
