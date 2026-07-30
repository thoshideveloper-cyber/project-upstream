import { expect, test } from "@playwright/test";

/**
 * Smoke: the two things that must hold before any other spec can pass.
 *
 * Both assertions were rewritten in P5. The old ones predated two shipped changes:
 * the landing page moving out to the separate `marketing/` app (so `/` no longer
 * renders a public page — an unauthenticated visit is bounced to /login), and the
 * rebrand from "Project Upstream" to "Upstream".
 */

test("an unauthenticated visit to the root bounces to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("login page renders the Upstream lockup", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Upstream", exact: true })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
});
