/**
 * E2E — the task loop: create → assign → move across the board → done, with the
 * sidebar counts following along.
 *
 * The sidebar assertion is the one that matters. The counts come from
 * `/tasks/summary`, a different query from the list beside them, so a mutation that
 * busts one cache key and not the other leaves a sidebar claiming 4 open above a list
 * showing 3 — which is exactly the kind of bug a component test cannot see.
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

/**
 * Type a title into an inline-add row and wait for the write to land.
 *
 * Waiting on the POST rather than on the row appearing: the row is rendered from a
 * *refetch* that the mutation triggers, so asserting on it directly races two round
 * trips instead of one. Back-to-back specs against one dev server lose that race often
 * enough to matter.
 */
async function addTask(page: Page, placeholder: RegExp, title: string) {
  const add = page.getByPlaceholder(placeholder);
  await add.fill(title);
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/tasks") && r.request().method() === "POST" && r.ok(),
      { timeout: 15_000 },
    ),
    add.press("Enter"),
  ]);
  await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 });
}

/**
 * The live count beside a status on the page's own status rail.
 *
 * This used to read the sidebar's "My work → Backlog / In progress / …" children. The
 * Project redesign removed that navigation (project work belongs to the project), so the
 * assertion moved to the rail on `/tasks` — which is the same figure from the same
 * `summary.by_status`, on the page the test is actually exercising.
 */
function statusChip(page: Page, label: string) {
  return page.getByRole("button", { name: new RegExp(`^${label}`) });
}

/**
 * The number in that chip, as a number.
 *
 * Parsed rather than substring-matched: `toContainText("1")` also passes against "14",
 * which would make this assertion accidentally green far more often than it is right.
 * Returns null until the chip carries a number, so `expect.poll` can wait for the
 * summary instead of racing it. Null rather than 0 for "not there yet": the chip renders
 * as soon as the page does, with no count until the list response lands, and reading that
 * as a zero made the baseline below silently wrong.
 */
async function countOf(page: Page, label: string): Promise<number | null> {
  const chip = statusChip(page, label);
  if ((await chip.count()) === 0) return null;
  const text = await chip.first().innerText();
  const digits = text.replace(/\D/g, "");
  return digits === "" ? null : Number(digits);
}

test.describe("Tasks", () => {
  test("inline add creates a task and the status rail count follows", async ({ page }) => {
    const title = `E2E task ${Date.now()}`;

    await login(page);
    // The list response, not `/tasks/summary`. The sidebar was the only thing that
    // fetched the summary endpoint on this navigation, and the Project redesign removed
    // it; the status rail's counts ride on the list response's own `summary`. (The
    // endpoint is still live — the dashboard reads it.)
    await Promise.all([
      page.waitForResponse(
        (r) => /\/tasks(\?|$)/.test(new URL(r.url()).pathname + new URL(r.url()).search) && r.ok(),
        { timeout: 15_000 },
      ),
      page.goto("/tasks"),
    ]);
    await expect(statusChip(page, "Backlog")).toBeVisible({ timeout: 10_000 });
    // Wait for the chip to carry a figure, not merely to exist — the baseline is the
    // whole assertion, and a baseline read before the count arrived is a baseline of 0.
    await expect.poll(() => countOf(page, "Backlog"), { timeout: 15_000 }).not.toBeNull();
    const before = (await countOf(page, "Backlog"))!;

    // The whole "an analyst can add to-dos" ask: type a title, press Enter, done.
    // No dialog for the common case.
    await addTask(page, /Add a private task and press Enter/, title);

    await expect
      .poll(() => countOf(page, "Backlog"), { timeout: 15_000 })
      .toBe(before + 1);
  });

  test("the checkbox completes a task, and DONE leaves the default list", async ({ page }) => {
    const title = `E2E done ${Date.now()}`;

    await login(page);
    await page.goto("/tasks");

    await addTask(page, /Add a private task and press Enter/, title);

    // `.click()`, not `.check()`: completing a task removes the row from the default
    // list, so the checkbox is gone before `.check()` can confirm it went checked.
    await page.getByRole("checkbox", { name: `Complete ${title}` }).click();

    // Finished work drops out of the list, because a to-do list that keeps everything
    // it ever finished is a list nobody opens.
    await expect(page.getByText(title)).toBeHidden({ timeout: 10_000 });
    await expect(statusChip(page, "Done")).toBeVisible();

    // ...but it is still there when asked for.
    await page.goto("/tasks?status=DONE");
    await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });
  });

  test("the board moves a task between columns and the list agrees", async ({ page }) => {
    const title = `E2E board ${Date.now()}`;

    await login(page);
    await page.goto("/tasks");
    await addTask(page, /Add a private task and press Enter/, title);

    await page.getByRole("tab", { name: "Board" }).click();
    await expect(page.getByRole("group", { name: "Task board" })).toBeVisible();

    // The card's own select is the keyboard equivalent of the drag — a board that only
    // answers to a mouse is a board half the desk cannot use, and it is also the only
    // half a browser can drive deterministically.
    await page.getByRole("combobox", { name: `Move ${title}` }).selectOption("IN_PROGRESS");

    await expect(
      page.getByRole("region", { name: /^In progress/ }).getByText(title),
    ).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(() => countOf(page, "In progress"), { timeout: 10_000 })
      .toBeGreaterThan(0);

    // The list view reflects the same move.
    await page.getByRole("tab", { name: "List" }).click();
    await expect(page.getByText("In progress").first()).toBeVisible();
  });

  test("the status filter is in the URL, so a filtered list is linkable", async ({ page }) => {
    await login(page);
    await page.goto("/tasks");
    await page.getByRole("button", { name: /^Blocked/ }).click();
    await expect(page).toHaveURL(/status=BLOCKED/);

    // And it survives a reload rather than resetting to All.
    await page.reload();
    await expect(page.getByRole("button", { name: /^Blocked/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("a project task appears in the project's Work view and in its vitals", async ({ page }) => {
    const title = `E2E project task ${Date.now()}`;

    await login(page);
    await page.goto("/projects");
    await page.locator('a[href^="/projects/"]').first().click();
    await expect(page).toHaveURL(/\/projects\/\d+/);

    // Work is a route now, not a tab. Addressed by href rather than by name, because
    // "Workspace" starts with "Work" too and a name regex matches both tabs.
    await page.locator('nav[aria-label="Project views"] a[href$="/work"]').click();
    await expect(page).toHaveURL(/\/projects\/\d+\/work/, { timeout: 10_000 });
    await page.getByRole("button", { name: "List" }).click();
    await addTask(page, /Add a task to this project and press Enter/, title);

    // The header's metric rail counts it too — one figure, two places, same source.
    await expect(page.getByText("Open work")).toBeVisible({ timeout: 10_000 });
  });
});
