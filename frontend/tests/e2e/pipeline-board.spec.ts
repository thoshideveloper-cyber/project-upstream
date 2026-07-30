/**
 * Track P · P5 — E2E critical path: the Master List pipeline board.
 *
 * The board's whole point is that a column is not a writable field, so these are
 * the assertions that matter: an illegal move is refused with a reason, a move that
 * means "a touch happened" hands off to the append-only log instead of writing a
 * status, and a hand flag is reversible.
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

/** A column, addressed by the label it announces to assistive tech. */
const column = (page: Page, name: string) => page.locator(`section[aria-label^="${name}"]`);

async function openBoard(page: Page) {
  await page.goto("/master?view=board");
  await expect(page.getByRole("group", { name: "Outreach pipeline board" })).toBeVisible({
    timeout: 15_000,
  });
}

async function openMoveMenu(page: Page, card: ReturnType<Page["locator"]>) {
  await card.getByRole("button", { name: /Move .* to another stage/ }).click();
  await expect(page.getByRole("menu")).toBeVisible({ timeout: 5000 });
}

test.describe("Pipeline board", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await openBoard(page);
  });

  test("shows every status as a column, with cards in it", async ({ page }) => {
    for (const name of ["Not contacted", "In cadence", "Replied", "Interested", "Declined", "Bounced"]) {
      await expect(column(page, name)).toBeVisible();
    }
    expect(await page.locator("article").count()).toBeGreaterThan(0);
  });

  test("never offers 'Not contacted' — nothing un-sends an email", async ({ page }) => {
    const card = column(page, "In cadence").locator("article").first();
    await openMoveMenu(page, card);
    const item = page.getByRole("menuitem").filter({ hasText: "Not contacted" }).first();
    await expect(item).toHaveAttribute("data-disabled", /.*/);
  });

  test("refuses to drag a replied company back into the cadence, and says why", async ({ page }) => {
    const card = column(page, "Replied").locator("article").first();
    await openMoveMenu(page, card);
    const item = page.getByRole("menuitem").filter({ hasText: "In cadence" }).first();
    await expect(item).toHaveAttribute("data-disabled", /.*/);
    await expect(item).toContainText(/restart the cadence/i);
  });

  test("moving to Replied opens the append-only log instead of writing a status", async ({ page }) => {
    const card = column(page, "In cadence").locator("article").first();
    await openMoveMenu(page, card);
    await page.getByRole("menuitem").filter({ hasText: "Replied" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByTestId("log-event-type")).toHaveValue("RESPONSE");
    await expect(dialog).toContainText(/stops the cadence/i);

    // Cancelling logs nothing.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 5000 });
  });

  test("flagging a company interested is optimistic and undoable", async ({ page }) => {
    const interested = column(page, "Interested");
    const labelBefore = await interested.getAttribute("aria-label");

    const card = column(page, "In cadence").locator("article").first();
    await openMoveMenu(page, card);
    await page.getByRole("menuitem").filter({ hasText: "Interested" }).first().click();

    await expect(interested).not.toHaveAttribute("aria-label", labelBefore!, { timeout: 10_000 });

    // Put the seeded data back the way we found it.
    const toast = page.locator("[data-sonner-toast]");
    await expect(toast.getByRole("button", { name: "Undo" })).toBeVisible({ timeout: 5000 });
    await toast.getByRole("button", { name: "Undo" }).click();
    await expect(interested).toHaveAttribute("aria-label", labelBefore!, { timeout: 10_000 });
  });

  test("the board's filters live in the URL", async ({ page }) => {
    await page.getByLabel("Search the board").fill("pharma");
    await expect(page).toHaveURL(/q=pharma/, { timeout: 5000 });
    await page.reload();
    await expect(page.getByLabel("Search the board")).toHaveValue("pharma");
  });
});
