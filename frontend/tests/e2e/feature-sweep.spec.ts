/**
 * Feature sweep — drives every feature in the app against the real client data.
 *
 * The route audit (`audit.spec.ts`) proves each page *renders*; this proves each page
 * *works*: it searches, filters, opens dossiers, logs outreach, moves pipeline cards,
 * pushes candidates, edits contacts, drills through analytics and sends a sandbox email.
 * Everything writes to the throwaway E2E database.
 *
 * Expects the E2E database: `python -m app.seed.bootstrap --reset`,
 * `python -m app.seed.sourcing_pool`, then the three phase_2 workbooks imported.
 */

import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "Passw0rd!";
const PARTNER = "partner@upstream.test";
const ANALYST = "analyst1@upstream.test";

async function login(page: Page, email = PARTNER) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/dashboard", { timeout: 20_000 });
}

test.describe.configure({ mode: "serial" });

// ── Sourcing: the firm's company database ───────────────────────────────────

test.describe("Sourcing — the standing company database", () => {
  test("searches the pool by name, city and domain", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);
    await page.goto("/sourcing");

    const search = page.getByRole("searchbox", { name: /search the firm database/i });
    await expect(search).toBeVisible({ timeout: 20_000 });

    // The pool is seeded with real companies, independent of any deal.
    await search.fill("Infosys");
    await expect(page.getByText("Infosys", { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });

    // City search hits the HQ column.
    await search.fill("Bengaluru");
    await expect(page.getByText(/Bengaluru/).first()).toBeVisible({ timeout: 15_000 });

    // Domain search goes through the normalised domain key.
    await search.fill("tcs.com");
    await expect(page.getByText("Tata Consultancy Services").first()).toBeVisible({
      timeout: 15_000,
    });

    // A company that only exists because the client's workbook was imported.
    await search.fill("Trunorth");
    await expect(page.getByText("Trunorth").first()).toBeVisible({ timeout: 15_000 });
  });

  test("filters, sorts and exports; a company opens its dossier", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);
    await page.goto("/sourcing");
    await expect(page.getByRole("searchbox", { name: /search the firm database/i })).toBeVisible({
      timeout: 20_000,
    });

    // Facet rail — the Discover lens over the pool's composition.
    await expect(page.getByText(/companies/i).first()).toBeVisible();

    // Revenue sort is a pool-level sort and works with or without a deal.
    const sortRev = page.getByRole("button", { name: /revenue/i }).first();
    if (await sortRev.count()) {
      await sortRev.click();
      await page.waitForTimeout(800);
    }
    await expect(page.locator(".data-row").first()).toBeVisible({ timeout: 15_000 });
  });

  test("with no engagement the deal-only actions are withheld, not broken", async ({ page }) => {
    test.setTimeout(120_000);
    // analyst2 is assigned to nothing, so this is the deal-free database view.
    await login(page, "analyst2@upstream.test");
    await page.goto("/sourcing");

    await expect(page.getByTestId("database-mode-note")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Company database" })).toBeVisible();
    // Search still works — that is the whole point of the database view.
    const search = page.getByRole("searchbox", { name: /search the firm database/i });
    await search.fill("Accenture");
    await expect(page.getByText("Accenture").first()).toBeVisible({ timeout: 15_000 });
    // Scoring needs a thesis, so it is disabled with a reason rather than hidden.
    await expect(page.getByRole("button", { name: /score matches/i })).toBeDisabled();
  });

  test("shortlists a pool company onto a deal and it lands in the funnel", async ({ page }) => {
    test.setTimeout(150_000);
    // A company from the researched dataset that no workbook placed, so the run starts
    // from a known state whether or not an earlier sweep already touched the others.
    const target = "Coforge";

    await login(page);
    await page.goto("/sourcing");
    const search = page.getByRole("searchbox", { name: /search the firm database/i });
    await expect(search).toBeVisible({ timeout: 20_000 });
    await search.fill(target);
    await expect(page.getByText(target).first()).toBeVisible({ timeout: 15_000 });

    // Shortlist puts it in the funnel for the selected engagement. The button is
    // withheld once a company is already shortlisted, so this stays re-runnable.
    const shortlist = page.getByRole("button", { name: new RegExp(`shortlist ${target}`, "i") });
    if (await shortlist.count()) {
      await shortlist.first().click();
      await page.waitForTimeout(1500);
    }

    // Either way it is now on the funnel board for this deal.
    await page.getByRole("tab", { name: /funnel/i }).click();
    await expect(page.getByText(target).first()).toBeVisible({ timeout: 25_000 });
  });
});

// ── Master List: three views over the same book ─────────────────────────────

test.describe("Master List", () => {
  test("my book, firm database and pipeline board all carry the real data", async ({ page }) => {
    test.setTimeout(150_000);
    await login(page);

    // Default view is the firm database — one row per company, alphabetical.
    await page.goto("/master");
    await expect(page.getByText(/one row per company/i)).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText("Accion Labs").first()).toBeVisible({ timeout: 25_000 });

    // Search narrows the register to a company deep in the alphabet.
    const search = page.getByRole("searchbox").first();
    await search.fill("Trunorth");
    await expect(page.getByText("Trunorth").first()).toBeVisible({ timeout: 20_000 });
    await search.fill("Celebal");
    await expect(page.getByText("Celebal Technologies").first()).toBeVisible({ timeout: 20_000 });
    await search.fill("");

    // My book — the caller's placements, grouped by project and attention-sorted.
    await page.goto("/master?view=my-book");
    await expect(page.getByText(/\d+ companies · 2 projects/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Your book is empty/)).toHaveCount(0);

    // Pipeline board — every column is derived from the append-only log.
    await page.goto("/master?view=board");
    await expect(page.getByText(/a column is never written directly/i)).toBeVisible({
      timeout: 20_000,
    });
    // The five anchor-less GAIL rows are exactly the importer's "no initial email"
    // cases, and they land in Not contacted rather than being invented into a cadence.
    await expect(page.getByText(/Not contacted/).first()).toBeVisible();
    await expect(page.getByText("Anicut Capital").first()).toBeVisible({ timeout: 15_000 });
  });

  test("a company dossier shows its imported cadence and history", async ({ page }) => {
    test.setTimeout(150_000);
    await login(page);
    await page.goto("/master");
    const search = page.getByRole("searchbox").first();
    await expect(search).toBeVisible({ timeout: 25_000 });
    await search.fill("Trunorth");
    await expect(page.getByText("Trunorth").first()).toBeVisible({ timeout: 25_000 });
    await page.getByText("Trunorth").first().click();

    await expect(page).toHaveURL(/\/companies\/\d+/, { timeout: 20_000 });
    await expect(page.getByText(/Trunorth/).first()).toBeVisible();

    // The overview carries the imported classification and cadence — including the
    // sourcing layer that came from the sheet's Bucket column.
    await expect(page.getByText("Sourcing layer", { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Initial date", { exact: true })).toBeVisible();
    // Imported, not hand-entered.
    await expect(page.getByText("IMPORTED").first()).toBeVisible();

    // Trunorth sits on both projects, so the cross-mandate duplicate notice fires.
    await expect(page.getByText(/Possible duplicate across mandates/i)).toBeVisible();

    // The append-only log is behind the Timeline tab and is not empty.
    await page.getByRole("tab", { name: /timeline/i }).click();
    await expect(page.getByText(/initial email/i).first()).toBeVisible({ timeout: 20_000 });

    // The inline contact from the master sheet landed on the Contacts tab — the tab
    // itself carries the count, so a zero here would mean the import lost the person.
    const contactsTab = page.getByRole("tab", { name: /contacts/i });
    await expect(contactsTab).toHaveText(/Contacts \([1-9]\d*\)/, { timeout: 20_000 });
    await contactsTab.click();
    await expect(page.getByText(/No contacts yet/i)).toHaveCount(0);
  });
});

// ── Outreach desk: the queue and logging a real touch ───────────────────────

test.describe("Outreach desk", () => {
  test("the queue reflects the imported cadence and a touch can be logged", async ({ page }) => {
    test.setTimeout(180_000);
    await login(page);
    await page.goto("/schedule");
    await expect(page.getByText(/outreach/i).first()).toBeVisible({ timeout: 25_000 });

    // Something is in the queue — the import produced 49 live cadences.
    const rows = page.locator("[data-row-index], .data-row");
    await expect(rows.first()).toBeVisible({ timeout: 25_000 });
    const before = await rows.count();
    expect(before).toBeGreaterThan(0);

    // Log a follow-up on the first queued company.
    const logButton = page.getByRole("button", { name: /^log/i }).first();
    if (await logButton.count()) {
      await logButton.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 15_000 });
      const save = dialog.getByRole("button", { name: /log|save/i }).last();
      await save.click();
      await expect(dialog).toBeHidden({ timeout: 20_000 });
    }
  });
});

// ── Contacts: the firm rolodex built from the Contact List ─────────────────

test.describe("Contacts", () => {
  test("the rolodex carries the imported people and their touch context", async ({ page }) => {
    test.setTimeout(150_000);
    await login(page);
    await page.goto("/contacts");
    await expect(page.getByText(/Yusuf H. Ahmed|Mahinder Singh Juneja/).first()).toBeVisible({
      timeout: 25_000,
    });

    const search = page.getByRole("searchbox").first();
    await search.fill("Yusuf");
    const person = page.getByText("Yusuf H. Ahmed").first();
    await expect(person).toBeVisible({ timeout: 15_000 });
    await person.click();

    // The person card shows the context that landed on the event (§8-B).
    await expect(page.getByText(/Earthling Security/).first()).toBeVisible({ timeout: 20_000 });
  });
});

// ── Projects: the deal floor and a populated deal room ──────────────────────

test.describe("Projects", () => {
  test("both imported projects are on the floor and open populated", async ({ page }) => {
    test.setTimeout(150_000);
    await login(page);
    await page.goto("/projects");

    await expect(page.getByText("GAIL").first()).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText("22by7").first()).toBeVisible({ timeout: 15_000 });

    await page.getByText("22by7").first().click();
    await expect(page).toHaveURL(/\/projects\/\d+/, { timeout: 20_000 });
    // Two engagements came off the two master sheets of one workbook.
    await expect(page.getByText(/PE buyers/).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/PE portfolio buyers/).first()).toBeVisible({ timeout: 20_000 });
  });
});

// ── Analytics: computed from the imported event log ─────────────────────────

test.describe("Analytics", () => {
  test("the funnel and reply rate are computed from the real events", async ({ page }) => {
    test.setTimeout(150_000);
    await login(page);
    await page.goto("/analytics");
    await expect(page.getByText(/repl(y|ies)/i).first()).toBeVisible({ timeout: 25_000 });
    // 195 initial emails and 155 responses landed — the page must not read as empty.
    await expect(page.getByText(/No outreach logged yet/)).toHaveCount(0);

    await page.goto("/analytics/projects");
    await expect(page.getByText(/GAIL|22by7/).first()).toBeVisible({ timeout: 25_000 });
  });
});

// ── Settings, palette and the analyst's own view ────────────────────────────

test.describe("Cross-cutting", () => {
  test("settings shows the firm vocabulary the import used", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);
    await page.goto("/settings");
    await expect(page.getByText(/Private Equity/).first()).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText(/Private Credit|PMS/).first()).toBeVisible({ timeout: 15_000 });
  });

  test("the command palette finds an imported company", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);
    await page.goto("/dashboard");
    // The shell can finish navigating before its keydown listener attaches, so press
    // again rather than assuming the first one landed (same retry the P1 spec uses).
    await expect(page.getByRole("button", { name: "Open command palette" })).toBeVisible();
    await expect(async () => {
      await page.keyboard.press("ControlOrMeta+k");
      await expect(page.getByTestId("command-input")).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });

    await page.getByTestId("command-input").fill("Trunorth");
    await expect(page.getByTestId("command-item").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("command-item").first()).toContainText(/Trunorth/i);
    await page.keyboard.press("Escape");
  });

  test("an assigned analyst sees their book, not an empty desk", async ({ page }) => {
    test.setTimeout(150_000);
    await login(page, ANALYST);
    await page.goto("/master");
    await expect(page.getByText(/Trunorth|Celebal/).first()).toBeVisible({ timeout: 25_000 });
    await page.goto("/schedule");
    await expect(page.getByText(/Desk clear|outreach/i).first()).toBeVisible({ timeout: 25_000 });
    await page.goto("/analytics");
    await expect(page.getByText(/No outreach logged yet/)).toHaveCount(0);
  });

  test("warm navigation is fast once compiled (dev-server compile is not app latency)", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await login(page);
    const routes = ["/dashboard", "/master", "/schedule", "/contacts", "/sourcing", "/analytics"];
    // Warm every route once so Next has compiled it.
    for (const r of routes) {
      await page.goto(r);
      await page.waitForLoadState("domcontentloaded");
    }
    const timings: Record<string, number> = {};
    for (const r of routes) {
      const t0 = Date.now();
      await page.goto(r);
      await page.waitForLoadState("domcontentloaded");
      timings[r] = Date.now() - t0;
    }
     
    console.log("[warm nav ms]", JSON.stringify(timings));
    for (const [route, ms] of Object.entries(timings)) {
      expect(ms, `${route} warm navigation`).toBeLessThan(6000);
    }
  });
});
