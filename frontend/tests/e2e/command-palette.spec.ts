/**
 * Track P · P1 — E2E critical path: global command palette (⌘K).
 *
 * Requires both servers running:
 *   backend:  uvicorn app.main:app --reload  (port 8000)
 *   frontend: npm run dev                    (port 3000)
 *
 * Run with: npm run test:e2e
 * Seed first: cd backend && python -m app.seed.seed --reset
 */

import { expect, test, type Page } from "@playwright/test";

const ANALYST_EMAIL = "analyst1@upstream.test";
const PASSWORD = "Passw0rd!";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ANALYST_EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/dashboard");
}

/**
 * Open the palette, tolerating the moment before the shell has hydrated.
 *
 * `login()` resolves as soon as the URL is /dashboard, which can be *before* the
 * client shell has attached its keydown listener — pressing ⌘K then did nothing and
 * the spec failed intermittently. A real user simply presses it again, so retry.
 */
async function openPalette(page: Page) {
  await expect(page.getByRole("button", { name: "Open command palette" })).toBeVisible();
  await expect(async () => {
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByTestId("command-input")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
}

test.describe("Command palette (⌘K)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("opens with the keyboard and jumps to a page", async ({ page }) => {
    await openPalette(page);

    const input = page.getByTestId("command-input");
    await expect(input).toBeFocused();

    // Type a page name, arrow to it, and open with Enter.
    await input.fill("Schedule");
    await expect(page.getByTestId("command-item").first()).toBeVisible();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/schedule/);
  });

  test("closes on Escape", async ({ page }) => {
    await openPalette(page);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("command-input")).toBeHidden();
  });

  test("the New company quick action opens the add-company dialog", async ({ page }) => {
    await openPalette(page);
    await page.getByTestId("command-input").fill("New company");
    await page.getByTestId("command-item").first().click();

    await expect(page.getByRole("heading", { name: "Add a company" })).toBeVisible();
  });

  test("can be opened from the top-bar search button", async ({ page }) => {
    await page.getByRole("button", { name: "Open command palette" }).click();
    await expect(page.getByTestId("command-input")).toBeFocused();
  });
});
