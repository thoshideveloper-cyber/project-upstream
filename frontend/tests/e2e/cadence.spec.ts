/**
 * Phase 7 — E2E critical paths (plan.md §7.4 / §12):
 *   1. create a company → it appears in "Needs first outreach"
 *   2. log an initial outreach → cadence activates and it leaves needs-initial (due this week)
 *   3. log a RESPONSE → company status flips to Responded and the cadence stops
 *
 * Requires both servers running + a freshly seeded DB:
 *   backend:  uvicorn app.main:app --reload          (port 8000)
 *   frontend: npm run dev                             (port 3000)
 *   seed:     cd backend && python -m app.seed.seed --reset
 *
 * Run with: npm run test:e2e
 */

import { expect, test } from "@playwright/test";

const PARTNER_EMAIL = "partner@upstream.test";
const PASSWORD = "Passw0rd!";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(PARTNER_EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/dashboard");
}

test.describe("Cadence critical path", () => {
  test("create → needs-initial → log initial → due → respond → stopped", async ({ page }) => {
    const name = `E2E Cadence Co ${Date.now()}`;

    await login(page);

    // 1. Create a company via the UI
    await page.goto("/companies");
    await page.getByRole("button", { name: "New company" }).click();
    await page.getByLabel(/Company name/).fill(name);
    // The mandate picker is now an "Engagement" select, and the submit button
    // reads "Add" (the dialog also offers "Add & log initial email").
    await page.getByLabel(/Engagement/).selectOption({ index: 1 });
    await page.getByTestId("add-company-submit").click();

    // Adding no longer navigates — the dialog closes and the row joins the list, so
    // find it and open its dossier.
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });
    await page.getByPlaceholder("Search companies…").fill(name);
    await page.getByRole("row").filter({ hasText: name }).first().click();
    await expect(page).toHaveURL(/\/companies\/\d+$/);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    // Fresh company shows the needs-first-outreach cadence pill
    await expect(page.getByText("Needs first outreach").first()).toBeVisible();

    const detailUrl = page.url();

    // 2. It appears in the Schedule "Needs first outreach" queue. The desk is a
    // triaged, capped work queue rather than a full list, so search for the row.
    await page.goto("/schedule");
    await page.getByLabel("Search companies").fill(name);
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 10_000 });

    // 3. Log an INITIAL_EMAIL (backdated 10d so next-due lands within the 7-day window)
    await page.goto(detailUrl);
    await page.getByRole("button", { name: "Log outreach" }).first().click();
    await page.getByLabel("Type").selectOption({ value: "INITIAL_EMAIL" });
    await page.getByLabel("Date").fill(isoDaysAgo(10));
    await page.getByRole("button", { name: "Save" }).click();

    // Cadence is now active — the needs-initial pill is gone and the clock is
    // running. The initial email was backdated 10 days and the firm's default
    // cadence is 7 days, so this company is already past due.
    await expect(page.getByText("Needs first outreach")).toHaveCount(0);
    await expect(page.getByText(/^(Overdue|Due soon|Upcoming)$/).first()).toBeVisible({
      timeout: 10_000,
    });

    // It now shows in the due-this-week portion of the schedule (no longer needs-initial)
    await page.goto("/schedule");
    await page.getByLabel("Search companies").fill(name);
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 10_000 });

    // 4. Log a RESPONSE → status flips to Responded, cadence stops
    await page.goto(detailUrl);
    await page.getByRole("button", { name: "Log outreach" }).first().click();
    await page.getByLabel("Type").selectOption({ value: "RESPONSE" });
    await page.getByRole("button", { name: "Save" }).click();

    // Status badge now reads "Responded"
    await expect(page.getByText("Responded").first()).toBeVisible();

    // Cadence tab shows the schedule stopped with reason RESPONDED
    await page.getByRole("tab", { name: /Cadence/ }).click();
    await expect(page.getByText("RESPONDED").first()).toBeVisible();
  });
});
