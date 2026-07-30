/**
 * Phase 2 — E2E critical path: login → dashboard.
 *
 * Requires both servers running:
 *   backend:  uvicorn app.main:app --reload  (port 8000)
 *   frontend: npm run dev                    (port 3000)
 *
 * Run with: npm run test:e2e
 * Seed first: cd backend && python -m app.seed.seed --reset
 */

import { expect, test } from "@playwright/test";

const PARTNER_EMAIL = "partner@upstream.test";
const ANALYST_EMAIL = "analyst1@upstream.test";
const PASSWORD = "Passw0rd!";

test.describe("Login flow", () => {
  test("partner can log in and land on dashboard", async ({ page }) => {
    await page.goto("/login");
    // Rebranded: the lockup reads "Upstream" (was "Project Upstream").
    await expect(page.getByRole("heading", { name: "Upstream", exact: true })).toBeVisible();

    await page.getByLabel("Email").fill(PARTNER_EMAIL);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    // Should redirect to /dashboard after successful login
    await expect(page).toHaveURL("/dashboard");
    // Sidebar should be visible
    await expect(page.getByRole("navigation")).toBeVisible();
  });

  test("analyst can log in and land on dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(ANALYST_EMAIL);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/dashboard");
  });

  test("the root sends a signed-in user into the shell", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(PARTNER_EMAIL);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/dashboard");

    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("wrong password shows error, stays on login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(PARTNER_EMAIL);
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/login");
    await expect(page.getByText("Invalid email or password")).toBeVisible();
  });

  test("unauthenticated visit to /dashboard redirects to /login", async ({ page }) => {
    // No cookies — should be bounced to login
    await page.goto("/dashboard");
    await expect(page).toHaveURL("/login");
  });
});
