/**
 * E2E — WB-1 client-workbook onboarding, the happy path a partner actually walks:
 * /projects → Import from Excel → upload a real client workbook → pick the project and
 * map the tab to a new engagement → preview → apply → land in the populated deal room.
 *
 * Drives the *real* `phase_2/Investors outreach.xlsx`, so it also proves the header-block
 * detection and the 70-row master sheet end to end. Skips if that file isn't checked out.
 *
 * Requires both servers + a seeded DB (see cadence.spec.ts header).
 */

import { existsSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const PARTNER_EMAIL = "partner@upstream.test";
const ANALYST_EMAIL = "analyst1@upstream.test";
const PASSWORD = "Passw0rd!";

const WORKBOOK = path.resolve(__dirname, "../../../phase_2/Investors outreach.xlsx");
// The client's book is not one file. These are all three, in the order they must land:
// the contact list maps its Reason column onto engagements the earlier two create.
const ALL_WORKBOOKS = [
  WORKBOOK,
  path.resolve(__dirname, "../../../phase_2/PE related buyers.xlsx"),
  path.resolve(__dirname, "../../../phase_2/Contact list.xlsx"),
];

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/dashboard");
}

test.describe("Workbook import", () => {
  test.skip(!existsSync(WORKBOOK), "client workbook not present in phase_2/");

  test("partner imports a client workbook end to end", async ({ page }) => {
    // The whole chain — parse 70 rows, build 70 cadences, write ~120 events — runs in
    // one apply call, so this needs more than the 30s default.
    test.setTimeout(180_000);
    const project = `E2E Workbook ${Date.now()}`;

    await login(page, PARTNER_EMAIL);
    await page.goto("/import");

    // Step 1 — upload the real client workbook.
    await page.getByTestId("workbook-file-input").setInputFiles(WORKBOOK);

    // Step 2 — the map step arrives with the sheets already classified.
    const sheetRow = page.getByTestId("sheet-row-Company list 1");
    await expect(sheetRow).toBeVisible({ timeout: 30_000 });
    await expect(sheetRow).toContainText("Master sheet");
    await expect(sheetRow).toContainText("70 rows");
    // The empty spare tabs are proposed as "don't import", not silently swept in.
    await expect(page.getByTestId("sheet-kind-Company list 2")).toHaveValue("IGNORE");

    // Name the client and give the master sheet a fresh engagement.
    await page.getByTestId("new-project-name").fill(project);
    await page.getByTestId("sheet-mandate-name-Company list 1").fill("E2E raise");

    // Step 3 — preview. Nothing is written yet.
    await page.getByTestId("preview-button").click();
    await expect(page.getByRole("button", { name: "Apply import" })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText("Companies", { exact: true })).toBeVisible();
    // Rows the importer had to make a call on are surfaced, not buried.
    await page.getByTestId("toggle-flagged").click();
    await expect(page.getByTestId("flagged-rows")).toBeVisible();
    await expect(page.getByTestId("flagged-rows")).toContainText("Anicut Capital");

    // Step 4 — apply, then land in the now-populated deal room.
    await page.getByTestId("apply-button").click();
    await expect(page.getByTestId("import-complete")).toBeVisible({ timeout: 120_000 });
    await expect(page.getByTestId("import-complete")).toContainText(project);

    await page.getByTestId("open-project").click();
    await expect(page).toHaveURL(/\/projects\/\d+/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: project, exact: true })).toBeVisible({
      timeout: 15_000,
    });
    // A company from row 7 of the sheet is really there.
    await expect(page.getByText("Mandala Capital").first()).toBeVisible({ timeout: 15_000 });
  });

  test("an analyst takes the client's whole book — all three workbooks, one project", async ({
    page,
  }) => {
    // Three real workbooks, ~470 rows, three cadence rebuilds in one run.
    test.setTimeout(300_000);
    test.skip(
      !ALL_WORKBOOKS.every((f) => existsSync(f)),
      "client workbooks not present in phase_2/",
    );
    const project = `E2E Book ${Date.now()}`;

    await login(page, ANALYST_EMAIL);
    await page.goto("/import");

    // Everything the client has, dropped at once.
    await page.getByTestId("workbook-file-input").setInputFiles(ALL_WORKBOOKS);
    await expect(page.getByTestId("file-progress")).toContainText("Workbook 1 of 3", {
      timeout: 60_000,
    });

    // File 1 — the client is named once, here.
    await page.getByTestId("new-project-name").fill(project);
    await page.getByTestId("sheet-mandate-name-Company list 1").fill("Book raise");
    await page.getByTestId("preview-button").click();
    await page.getByTestId("apply-button").click();

    // File 2 — the project is no longer a question; it is locked to file 1's answer.
    await expect(page.getByTestId("file-progress")).toContainText("Workbook 2 of 3", {
      timeout: 120_000,
    });
    await expect(page.getByTestId("locked-project")).toContainText(project);
    await page.getByTestId("sheet-mandate-name-PE names final").fill("Book PE");
    await page.getByTestId("sheet-mandate-name-PE porfolio names final").fill("Book PE folio");
    await page.getByTestId("preview-button").click();
    await page.getByTestId("apply-button").click();

    // File 3 — the contact list. Its Reason dropdown must offer the engagements the two
    // earlier files just created; if the target list went stale every Reason would fall
    // back to "skip" and the whole file would import nothing.
    await expect(page.getByTestId("file-progress")).toContainText("Workbook 3 of 3", {
      timeout: 180_000,
    });
    const reasons = page.locator('[data-testid^="reason-"]');
    await expect
      .poll(async () => reasons.first().locator("option").count(), { timeout: 30_000 })
      .toBeGreaterThan(1);
    for (let i = 0; i < (await reasons.count()); i++) {
      const select = reasons.nth(i);
      if ((await select.locator("option").count()) > 1) {
        await select.selectOption({ index: 1 });
      }
    }
    await page.getByTestId("preview-button").click();
    await page.getByTestId("apply-button").click();

    // One project, three workbooks, one summary.
    await expect(page.getByTestId("import-complete")).toBeVisible({ timeout: 180_000 });
    await expect(page.getByTestId("import-complete")).toContainText(project);
    await expect(page.getByText(/from 3 workbooks/)).toBeVisible();
  });

  test("analysts get the uploader too, reachable from the sidebar", async ({ page }) => {
    await login(page, ANALYST_EMAIL);
    // The importer has a standing home in the nav, not just the projects empty state
    // — a firm brings a workbook per client, so this is not a one-off.
    await page.getByRole("link", { name: "Import" }).click();
    await expect(page).toHaveURL(/\/import/, { timeout: 15_000 });
    await expect(page.getByTestId("workbook-dropzone")).toBeVisible({ timeout: 15_000 });
  });
});
