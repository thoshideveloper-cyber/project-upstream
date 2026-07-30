/**
 * E2E — project lifecycle: create → appears on the deal floor → archive → undo.
 *
 * Replaces `mandates.spec.ts`, which drove the legacy `/mandates` route that the
 * Projects redesign removed (a mandate is now an *engagement* inside a project's
 * deal room). Archiving is a soft delete with an undo toast (CLAUDE.md rule 6),
 * so the round trip is archive → Undo rather than archive → restore-from-detail.
 *
 * Requires both servers + a seeded DB (see cadence.spec.ts header).
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

test.describe("Project lifecycle (partner)", () => {
  test("partner creates a project, archives it, and undoes the archive", async ({ page }) => {
    const name = `E2E Project ${Date.now()}`;

    await login(page);
    await page.goto("/projects");

    // Create
    await page.getByRole("button", { name: "New project" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await page.getByLabel(/Project name/).fill(name);
    await page.getByLabel(/Client name/).fill("E2E Client");
    await dialog.getByRole("button", { name: "Create" }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    // It's on the deal floor
    const card = page.getByText(name).first();
    await expect(card).toBeVisible({ timeout: 10_000 });

    // Open its deal room
    await card.click();
    await expect(page).toHaveURL(/\/projects\/\d+/);
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible({ timeout: 10_000 });

    // Archive it from the project-actions menu (confirm → back to the floor)
    await page.getByRole("button", { name: "Project actions" }).click();
    await page.getByRole("menuitem", { name: /archive/i }).click();
    await page.getByRole("button", { name: "Archive" }).click();
    await expect(page).toHaveURL(/\/projects$/, { timeout: 10_000 });
    // It's off the floor. Scoped to project links, because the undo toast also
    // carries the project's name — and checked briefly, since that toast is only
    // offered for 8s and reaching for it is the rest of this test.
    await expect(
      page.locator('a[href^="/projects/"]').filter({ hasText: name }),
    ).toHaveCount(0, { timeout: 3000 });

    // Undo puts it straight back
    await page.locator("[data-sonner-toast]").getByRole("button", { name: "Undo" }).click();
    await expect(
      page.locator('a[href^="/projects/"]').filter({ hasText: name }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
