import { expect, test } from "@playwright/test";

const SESSION_URL = "http://localhost:3000/workspace/default/sessions/1eed8a78-7673-4a1b-b6b9-cd68dc5b75c7";

test.describe("Session layout UX", () => {
  test.setTimeout(45_000);

  test("desktop keeps sessions as the primary left-sidebar view", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 980 });
    await page.goto(SESSION_URL);
    await page.waitForLoadState("domcontentloaded");

    const sidebar = page.locator("aside").first();
    await expect(sidebar).toBeVisible();
    await expect(page.locator('button:has-text("Sessions")')).toBeVisible();
    await expect(page.locator("text=Quick Access")).toBeVisible();
    await expect(page.locator("text=Task Snapshot")).toBeVisible();
    await expect(page.locator('button:has-text("Open Tasks")')).toBeVisible();
  });

  test("mobile opens the session sidebar as a drawer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(SESSION_URL);
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("aside").first()).not.toBeVisible();

    await page.locator("header button").first().click();

    const sidebar = page.locator("aside").first();
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toContainText("Quick Access");

    const width = await sidebar.evaluate((node) => node.getBoundingClientRect().width);
    expect(width).toBeGreaterThan(300);
  });
});