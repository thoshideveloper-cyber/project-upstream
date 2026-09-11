/**
 * E2E — the company table inside the project workspace:
 *   1. Open a project → Workspace → the whole book is there, every engagement at once
 *   2. Add a company from a group's inline add → it appears in the table
 *   3. Send the intro from its row → the cadence starts and the row stops saying
 *      "Needs first outreach"
 *
 * Rewritten twice. P5 merged the standalone grid page into the deal room; the Project
 * redesign then split the deal room into routes, so the book now lives at
 * `/projects/[id]/workspace` (with `/projects/[id]/grid` still redirecting there) and
 * the project's landing page is an overview. The inline add still opens the shared
 * add-company dialog.
 *
 * Requires both servers + a seeded DB:
 *   backend:  uvicorn app.main:app --reload   (port 8000)
 *   frontend: npm run dev                      (port 3000)
 *   seed:     cd backend && python -m app.seed.seed --reset
 */

import { expect, test, type Page } from "@playwright/test";

const PARTNER_EMAIL = "partner@upstream.test";
const PASSWORD = "Passw0rd!";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(PARTNER_EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/dashboard");
}

/** Open the first project on the deal floor and land in its workspace. */
async function openFirstDealRoom(page: Page) {
  await page.goto("/projects");
  const firstProject = page.locator('a[href^="/projects/"]').first();
  await firstProject.waitFor({ timeout: 10_000 });
  await firstProject.click();
  await expect(page).toHaveURL(/\/projects\/\d+/);
  // The project opens on its overview; the book is one tab across. Addressed by href:
  // `getByRole(name:)` matches substrings, and the overview also carries "Open the
  // workspace" and "Workspace" links into the very same place.
  await page.locator('nav[aria-label="Project views"] a[href$="/workspace"]').click();
  await expect(page).toHaveURL(/\/projects\/\d+\/workspace/, { timeout: 10_000 });
  await expect(page.getByTestId("grid-table")).toBeVisible({ timeout: 10_000 });
}

/** Add a company through the first category's inline add. Returns its name. */
async function addCompanyInline(page: Page, label: string) {
  const name = `${label} ${Date.now()}`;
  await page.locator('[data-testid^="inline-add-"]').first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 5000 });
  await page.getByTestId("add-company-name").fill(name);
  await page.getByTestId("add-company-submit").click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
  return name;
}

test.describe("Project workspace table", () => {
  test("add a company from a workspace group → it appears in the table", async ({ page }) => {
    await login(page);
    await openFirstDealRoom(page);

    const name = await addCompanyInline(page, "Grid Co");

    await expect(
      page.locator('[data-testid="grid-company-row"]').filter({ hasText: name }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("send the intro from a workspace row → the cadence starts", async ({ page }) => {
    await login(page);
    await openFirstDealRoom(page);

    const name = await addCompanyInline(page, "Grid Init");
    const row = page.locator('[data-testid="grid-company-row"]').filter({ hasText: name });
    await expect(row).toBeVisible({ timeout: 10_000 });

    // A company with no logged email offers "Send intro" on its row.
    await row.getByRole("button", { name: "Send intro" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByTestId("log-event-type")).toHaveValue("INITIAL_EMAIL");
    await dialog.getByRole("button", { name: /save/i }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    // The row is no longer waiting for a first touch — the clock is running.
    await expect(
      page.locator('[data-testid="grid-company-row"]').filter({ hasText: name }),
    ).not.toContainText("Needs first outreach", { timeout: 10_000 });
  });
});
