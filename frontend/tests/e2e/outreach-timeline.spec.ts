/**
 * P3 — E2E: the append-only outreach log renders as a cadence spine on the
 * company detail page, and the same component carries a person's touches on the
 * contact page.
 *
 * Requires both servers + a seeded DB:
 *   backend:  uvicorn app.main:app --reload   (port 8000)
 *   frontend: npm run dev                      (port 3000)
 *   seed:     cd backend && python -m app.seed.seed --reset
 */

import { expect, test, type Page } from "@playwright/test";

const PARTNER_EMAIL = "partner@upstream.test";
const PASSWORD = "Passw0rd!";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(PARTNER_EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 20000 });
}

type SeedEvent = { event_type: string; contact_id: number | null };

/**
 * Scan the seeded firm for a company whose log matches `want`. `reverse` walks
 * from the end of the list, where the seed's demo companies (restart, cold) sit —
 * they carry the contact-attributed touches.
 */
async function findCompany(
  page: Page,
  want: (events: SeedEvent[]) => boolean,
  { reverse = false, max = 200 }: { reverse?: boolean; max?: number } = {},
) {
  // The list endpoint pages with `page`/`page_size` (a bare `limit` is ignored).
  const list = await (await page.request.get(`${API}/companies?page_size=200`)).json();
  const items = [...(list.items ?? [])];
  if (reverse) items.reverse();
  for (const c of items.slice(0, max)) {
    const detail = await (await page.request.get(`${API}/companies/${c.id}`)).json();
    if (want(detail.events ?? [])) return detail;
  }
  return null;
}

const hasAnchor = (events: SeedEvent[]) => events.some((e) => e.event_type === "INITIAL_EMAIL");
const hasAttributedTouch = (events: SeedEvent[]) => events.some((e) => e.contact_id != null);

test.describe("Outreach timeline", () => {
  test("company timeline shows the anchor, the cadence head and the append-only note", async ({
    page,
  }) => {
    await login(page);

    const company = await findCompany(page, hasAnchor);
    expect(company, "seed should contain a company with a logged initial email").toBeTruthy();

    await page.goto(`/companies/${company.id}`);
    await page.getByRole("tab", { name: /Timeline/i }).click();

    // The anchor: the initial email that fixed the cadence clock.
    await expect(page.getByText("anchor · day 0")).toBeVisible();

    // The log states its own contract.
    await expect(page.getByText(/Append-only log/i)).toBeVisible();

    // Every logged event type renders with a label, not a raw enum.
    await expect(page.getByText("Initial email").first()).toBeVisible();
    await expect(page.getByText(/_EMAIL|FOLLOW_UP/)).toHaveCount(0);
  });

  test("contact timeline lists that person's touches", async ({ page }) => {
    await login(page);

    const company = await findCompany(page, hasAttributedTouch, { reverse: true });
    expect(company, "seed should contain a contact-attributed touch").toBeTruthy();
    const touch = (company.events as SeedEvent[]).find((e) => e.contact_id != null)!;

    await page.goto(`/contacts/${touch.contact_id}`);
    await expect(page.getByText(/Touch history/i)).toBeVisible();
    await expect(page.getByText(/Append-only log/i)).toBeVisible();
    // The person's own touches, newest first — the API returns them ascending.
    await expect(page.locator("time").first()).toBeVisible();
  });
});
