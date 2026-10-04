import { expect, test, type Page } from "@playwright/test";

const failures = new WeakMap<Page, string[]>();

test.beforeEach(({ page }) => {
    const caught: string[] = [];
    failures.set(page, caught);
    page.on("pageerror", (error) => caught.push(error.message));
});

test.afterEach(({ page }) => {
    expect(failures.get(page), "Landing must not throw uncaught page errors").toEqual([]);
});

async function heroOpacity(page: Page) {
    return page
        .locator(".landing-hero-step")
        .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).opacity));
}

test("hero steps are visible, including reduced motion and a stalled tween", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await expect.poll(() => heroOpacity(page)).not.toContain("0");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect.poll(() => heroOpacity(page)).not.toContain("0");

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.addInitScript(() => {
        sessionStorage.setItem("landing-hero-stall", "1");
    });
    await page.goto("/");
    await expect.poll(() => heroOpacity(page), { timeout: 3_000 }).not.toContain("0");
});

test("landing has no horizontal overflow at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await expect(page.locator("#main-content")).toBeVisible();
    const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
});

test("inspect-it is keyboard operable and static under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/#features");
    const stages = page.getByRole("list", { name: "Request stages" });
    await expect(stages).toBeVisible();
    await expect(stages.getByRole("listitem")).toHaveCount(4);
    await expect(page.getByText("Key read from browser")).toBeVisible();
    await expect(page.locator("[data-inspect-interactive]")).toHaveCount(0);

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.reload();
    const browser = page.getByRole("radio", { name: /Your browser/ });
    await browser.focus();
    await expect(browser).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: /Node relay/ })).toBeFocused();
    await page.getByRole("button", { name: "Follow one request" }).click();
    await expect(page.getByRole("status")).toContainText("Key read from browser");
    await page.getByRole("button", { name: "Follow one request" }).click();
    await expect(page.getByRole("status")).toContainText("Relayed per request");
});

test("jump palette opens, closes, and restores focus", async ({ page }) => {
    await page.goto("/");
    const trigger = page.getByRole("button", { name: "Jump to a section" });
    await trigger.focus();
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog", { name: "Jump to a section" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Open workspace" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
});

test("JSON-LD parses and FAQ schema matches the rendered FAQ", async ({ page }) => {
    await page.goto("/");
    const raw = await page.locator('script[type="application/ld+json"]').textContent();
    expect(raw).toBeTruthy();
    const data = JSON.parse(raw ?? "") as {
        "@graph": Array<{
            "@type": string;
            mainEntity?: Array<{ name: string; acceptedAnswer: { text: string } }>;
        }>;
    };
    const faq = data["@graph"].find((node) => node["@type"] === "FAQPage");
    expect(faq?.mainEntity?.length).toBeGreaterThan(0);
    const questions = await page.locator("#faq summary").allTextContents();
    const answers = await page.locator("#faq details p").allTextContents();
    expect(faq?.mainEntity?.map((item) => item.name)).toEqual(questions.map((item) => item.trim()));
    expect(faq?.mainEntity?.map((item) => item.acceptedAnswer.text)).toEqual(
        answers.map((item) => item.trim()),
    );
});
