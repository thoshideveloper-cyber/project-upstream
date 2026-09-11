/**
 * E2E — the activity trail: a real mutation shows up, phrased as a sentence, on the
 * project it happened to.
 *
 * The log is written server-side in the same transaction as the mutation, so this spec
 * is really asking one question: does an act performed through the UI reach the feed
 * with the right actor, the right words and the right project? That cannot be answered
 * anywhere below the full stack.
 *
 * Requires both servers + a seeded DB (see cadence.spec.ts header).
 */

import { expect, test, type Page } from "@playwright/test";

const PARTNER_EMAIL = "partner@upstream.test";
const PASSWORD = "Passw0rd!";
const PARTNER_NAME = "Arjun Mehta";
// Same origin the app itself talks to, so this works against a backend on any port.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
 * Move to one of the project's views.
 *
 * The Project redesign turned the deal room's `?view=` tabs into real routes, so these
 * are links now. Addressed by href rather than by accessible name: `getByRole(name:)`
 * matches substrings, and "Work" would also match "Workspace".
 */
async function openProjectView(page: Page, segment: string) {
  await page
    .locator(`nav[aria-label="Project views"] a[href$="/${segment}"]`)
    .click();
  // A glob, not a hand-built RegExp: the pattern is interpolated, and escaping `\d`
  // through a template literal is exactly the kind of thing that silently matches a
  // literal "d" instead.
  await page.waitForURL(`**/projects/*/${segment}`, { timeout: 10_000 });
}

test.describe("Activity", () => {
  test("a task added in the deal room lands in its Activity tab as a sentence", async ({
    page,
  }) => {
    const title = `E2E activity ${Date.now()}`;

    await login(page);
    await page.goto("/projects");
    await page.locator('a[href^="/projects/"]').first().click();
    await expect(page).toHaveURL(/\/projects\/\d+/);

    await openProjectView(page, "work");
    await page.getByRole("button", { name: "List" }).click();
    await addTask(page, /Add a task to this project and press Enter/, title);

    await openProjectView(page, "activity");

    // Actor + phrase + object, in that order — not an event dump.
    await expect(page.getByText(PARTNER_NAME).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("added a task").first()).toBeVisible();
    await expect(page.getByText(title).first()).toBeVisible();
    // Day-grouped, and a row written seconds ago belongs to today.
    await expect(page.getByText("Today").first()).toBeVisible();
  });

  test("completing a task reads as completion, not as a status change", async ({ page }) => {
    const title = `E2E completed ${Date.now()}`;

    await login(page);
    await page.goto("/projects");
    await page.locator('a[href^="/projects/"]').first().click();

    await openProjectView(page, "work");
    await page.getByRole("button", { name: "List" }).click();
    await addTask(page, /Add a task to this project and press Enter/, title);

    // `.click()`, not `.check()`: a completed task drops out of the project's task
    // list, so the checkbox is gone before `.check()` could confirm its new state.
    await page.getByRole("checkbox", { name: `Complete ${title}` }).click();

    await openProjectView(page, "activity");
    // There is no TASK_COMPLETED verb — the renderer turns the {from, to} meta into
    // English. If this reads "moved a task", the special case has been lost.
    await expect(page.getByText("completed a task").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("the verb-group chips filter the feed and carry counts", async ({ page }) => {
    await login(page);
    await page.goto("/projects");
    await page.locator('a[href^="/projects/"]').first().click();
    await openProjectView(page, "activity");

    const people = page.getByRole("button", { name: /^People/ });
    await expect(people).toBeVisible({ timeout: 10_000 });
    await people.click();
    await expect(people).toHaveAttribute("aria-pressed", "true");

    // Clicking it again clears the filter rather than trapping the reader in a group.
    await people.click();
    await expect(people).toHaveAttribute("aria-pressed", "false");
  });

  test("the partner's desk shows a firm-wide feed", async ({ page }) => {
    await login(page);
    await expect(page.getByText("Desk activity")).toBeVisible({ timeout: 10_000 });
  });

  test("there is no way to write activity from the client", async ({ request }) => {
    // A POST would make every row in the table unfalsifiable. Asserted at the edge,
    // because the guarantee is about the API and not about any screen.
    const res = await request.post(`${API_URL}/activity`, {
      data: { verb: "PROJECT_CREATED" },
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(405);
  });
});
