/**
 * E2E — the redesigned project workspace.
 *
 * The four behaviours the redesign turns on, each of which is invisible to a unit test
 * because each is about state surviving an interaction:
 *
 *   1. A view is a lens over one dataset, and it lives in the URL — so it is a link.
 *   2. Opening a company opens a panel *beside* the list, and the list keeps its place.
 *   3. Analytics is not a dead end: a figure there lands on the records behind it.
 *   4. Selecting rows offers actions over the selection.
 *
 * Read-only on purpose. `grid.spec.ts` already covers the mutating paths (inline add,
 * send intro); this file drives the same seeded book without changing it, so it can run
 * beside the rest of the suite without racing anything.
 *
 * Requires both servers + a seeded DB (see grid.spec.ts).
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

/** The id of the project with the most companies — the only one worth driving. */
async function biggestProjectId(page: Page): Promise<number> {
  await page.goto("/projects");
  const link = page.locator('a[href^="/projects/"]').first();
  await link.waitFor({ timeout: 10_000 });
  const href = (await link.getAttribute("href")) ?? "";
  const id = Number(href.match(/\/projects\/(\d+)/)?.[1]);
  expect(id).toBeGreaterThan(0);
  return id;
}

async function openWorkspace(page: Page, id: number, query = "") {
  await page.goto(`/projects/${id}/workspace${query}`);
  await expect(page.getByTestId("grid-table")).toBeVisible({ timeout: 15_000 });
}

test.describe("Project workspace — views", () => {
  test("a view named in the URL applies its own filter, grouping and sort", async ({ page }) => {
    await login(page);
    const id = await biggestProjectId(page);

    await openWorkspace(page, id);
    // Counted from the caption, never from the DOM: the register is virtualized, so
    // the number of mounted rows is a fact about the scroll position.
    const caption = page.getByTestId("result-caption");
    await expect(caption).toBeVisible({ timeout: 15_000 });
    const everything = Number((await caption.innerText()).match(/(\d+)/)?.[1]);
    expect(everything).toBeGreaterThan(0);

    // `?view=` is the short form every analytics drill-through uses. It has to mean
    // the whole lens, not just a label over the unfiltered book.
    await openWorkspace(page, id, "?view=follow-ups");
    await expect(page.getByTestId("view-picker")).toContainText("Overdue follow-ups");
    // The view is not "edited" — arriving by link must land exactly on the view.
    await expect(page.getByTestId("view-picker")).not.toContainText(/edited/i);
    // Its filter is visible as a chip, so nothing is hidden without saying so.
    await expect(page.getByText("Overdue follow-up", { exact: false }).first()).toBeVisible();

    await expect(caption).toContainText(` of ${everything} companies`, { timeout: 15_000 });
    const narrowed = Number((await caption.innerText()).match(/(\d+)/)?.[1]);
    expect(narrowed).toBeLessThan(everything);
  });

  test("switching view rewrites the URL, so the lens is shareable", async ({ page }) => {
    await login(page);
    const id = await biggestProjectId(page);
    await openWorkspace(page, id);

    await page.getByTestId("view-picker").click();
    await page.getByRole("menuitem", { name: /Needs attention/ }).click();

    await expect(page).toHaveURL(/view=attention/, { timeout: 10_000 });
    await expect(page).toHaveURL(/f=attention/);
  });

  test("search narrows the register and says so", async ({ page }) => {
    await login(page);
    const id = await biggestProjectId(page);
    await openWorkspace(page, id);

    await page.getByTestId("grid-search").fill("zzzznotacompany");
    await expect(page.getByText("Nothing matches this view.")).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Project workspace — the company panel", () => {
  test("opens beside the list and leaves the list where it was", async ({ page }) => {
    await login(page);
    const id = await biggestProjectId(page);
    await openWorkspace(page, id, "?group=flat&sort=name");

    const rows = page.getByTestId("grid-company-row");
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
    const before = await rows.count();

    await rows.nth(2).click();
    const panel = page.getByTestId("company-peek");
    await expect(panel).toBeVisible({ timeout: 10_000 });

    // The whole point: the register is still mounted and still showing its rows.
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBe(before);

    // It is addressable, so the panel survives a reload and can be sent to someone.
    await expect(page).toHaveURL(/peek=\d+/);

    // The panel states why the row is on the list, never a bare score.
    await expect(panel).toContainText(/Why this is on the list|In this project/);

    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden({ timeout: 5000 });
    await expect(page).not.toHaveURL(/peek=\d+/);
  });
});

test.describe("Project analytics — never a dead end", () => {
  test("a figure lands on the records behind it", async ({ page }) => {
    await login(page);
    const id = await biggestProjectId(page);

    await page.goto(`/projects/${id}/analytics`);
    const intervention = page.getByRole("link", { name: /Overdue follow-ups/ });
    await expect(intervention).toBeVisible({ timeout: 15_000 });
    await intervention.click();

    await expect(page).toHaveURL(/\/workspace\?.*view=follow-ups/, { timeout: 10_000 });
    await expect(page.getByTestId("grid-table")).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Project workspace — bulk selection", () => {
  test("selecting rows offers actions over the selection", async ({ page }) => {
    await login(page);
    const id = await biggestProjectId(page);
    await openWorkspace(page, id, "?group=flat&sort=name");

    const rows = page.getByTestId("grid-company-row");
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });

    await rows.first().getByRole("checkbox").click();
    const bar = page.getByRole("region", { name: /1 company/ });
    await expect(bar).toBeVisible({ timeout: 5000 });
    await expect(bar.getByRole("button", { name: "Add task" })).toBeVisible();

    await bar.getByRole("button", { name: "Clear" }).click();
    await expect(bar).toBeHidden({ timeout: 5000 });
  });
});
