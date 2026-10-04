import { expect, test } from "@playwright/test";

test("first-run setup fills and centers within the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.addInitScript(() => {
        localStorage.setItem(
            "prismium-lite:settings",
            JSON.stringify({
                setupComplete: false,
                theme: "dark",
                chat: { provider: "chatgpt", model: "gpt-5.6-luna" },
                providers: { chatgpt: { id: "chatgpt", enabled: true, apiKey: "" } },
            }),
        );
    });
    await page.route(/https:\/\//, (route) => route.abort());
    await page.goto("/workspace");

    const setup = page.locator("[data-setup-gate]");
    await expect(setup).toBeVisible();

    for (const width of [375, 1024]) {
        await page.setViewportSize({ width, height: width === 375 ? 812 : 768 });
        const bounds = await setup.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds?.x).toBe(0);
        expect(bounds?.width).toBe(width);

        const card = await setup.locator("section").first().boundingBox();
        expect(card).not.toBeNull();
        expect(Math.abs((card?.x ?? 0) + (card?.width ?? 0) / 2 - width / 2)).toBeLessThan(2);
        const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
    }
});
