/**
 * Route audit — walks every page in the app as both roles and records what it finds.
 *
 * This is a *diagnostic* spec, not a guard: it fails only on hard breakage (a console
 * error, a failed API call, a crashed render) and otherwise writes a report to
 * `tests/e2e/.audit/report.json` describing what each route showed. Run it against an
 * empty database and again against a populated one to see both states of every screen.
 *
 *   AUDIT_LABEL=empty    npx playwright test tests/e2e/audit.spec.ts
 *   AUDIT_LABEL=loaded   npx playwright test tests/e2e/audit.spec.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";

const PASSWORD = "Passw0rd!";
const PARTNER = "partner@upstream.test";
const ANALYST = "analyst1@upstream.test";

const LABEL = process.env.AUDIT_LABEL ?? "run";
const OUT_DIR = path.resolve(__dirname, ".audit", LABEL);

/** Every route a user can reach from the nav, plus the deep links that hang off them. */
const ROUTES: { path: string; name: string; partnerOnly?: boolean }[] = [
  { path: "/dashboard", name: "Dashboard" },
  { path: "/projects", name: "Projects — deal floor" },
  { path: "/sourcing", name: "Sourcing — discover" },
  { path: "/sourcing?view=funnel", name: "Sourcing — funnel" },
  { path: "/sourcing/analytics", name: "Sourcing — analytics" },
  { path: "/sourcing/import", name: "Sourcing — CSV import" },
  { path: "/master?view=my-book", name: "Master List — my book" },
  { path: "/master?view=firm-wide", name: "Master List — firm database" },
  { path: "/master?view=board", name: "Master List — pipeline board" },
  { path: "/schedule", name: "Outreach desk" },
  { path: "/contacts", name: "Contacts" },
  { path: "/companies", name: "Companies" },
  { path: "/analytics", name: "Analytics" },
  { path: "/analytics/projects", name: "Project health", partnerOnly: true },
  { path: "/import", name: "Workbook import", partnerOnly: true },
  { path: "/settings", name: "Settings", partnerOnly: true },
];

interface RouteReport {
  route: string;
  name: string;
  role: string;
  status: "ok" | "console-error" | "request-failed" | "crashed";
  consoleErrors: string[];
  failedRequests: string[];
  heading: string | null;
  bodyExcerpt: string;
  emptyStateText: string | null;
  counts: Record<string, string>;
  ms: number;
}

const reports: RouteReport[] = [];

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/dashboard", { timeout: 20_000 });
}

/** Noise we deliberately don't count: dev-server chatter, not app defects. */
function isRealError(text: string): boolean {
  const ignore = [
    "Download the React DevTools",
    "[Fast Refresh]",
    "webpack-hmr",
    "Warning: Extra attributes from the server",
    "hydrat", // Next dev hydration notices from the theme script
  ];
  return !ignore.some((n) => text.toLowerCase().includes(n.toLowerCase()));
}

async function auditRoute(
  page: Page,
  route: { path: string; name: string },
  role: string,
): Promise<RouteReport> {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  const onConsole = (msg: ConsoleMessage) => {
    if (msg.type() === "error" && isRealError(msg.text())) consoleErrors.push(msg.text());
  };
  const onPageError = (err: Error) => consoleErrors.push(`pageerror: ${err.message}`);
  const onResponse = (res: { status(): number; url(): string }) => {
    const url = res.url();
    if (res.status() >= 400 && !url.includes("/auth/me") && !url.includes("_next")) {
      failedRequests.push(`${res.status()} ${url.replace(/^https?:\/\/[^/]+/, "")}`);
    }
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("response", onResponse);

  const started = Date.now();
  let status: RouteReport["status"] = "ok";
  let heading: string | null = null;
  let bodyExcerpt = "";
  let emptyStateText: string | null = null;
  const counts: Record<string, string> = {};

  try {
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    // Let queries settle; the network can stay warm on polling pages, so cap the wait.
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(700);

    heading = await page
      .locator("h1")
      .first()
      .textContent({ timeout: 5000 })
      .catch(() => null);
    bodyExcerpt = (
      (await page.locator("main, body").first().innerText({ timeout: 5000 }).catch(() => "")) ?? ""
    )
      .replace(/\s+/g, " ")
      .slice(0, 900);

    // Anything that reads like an empty state, so the report shows the actual words.
    const emptyish = page.locator(
      "text=/no .{0,40}(yet|found|match)|nothing (here|to)|empty|get started|first (project|company|contact)/i",
    );
    if (await emptyish.count()) {
      emptyStateText = (await emptyish.first().textContent().catch(() => null))?.trim() ?? null;
    }

    // Any visible tabular numbers the page is advertising (row counts, stat tiles).
    for (const sel of ["[data-testid$='-count']", "[data-slot='badge']"]) {
      const nodes = page.locator(sel);
      const n = Math.min(await nodes.count(), 6);
      for (let i = 0; i < n; i++) {
        const t = (await nodes.nth(i).textContent().catch(() => ""))?.trim();
        if (t) counts[`${sel}[${i}]`] = t.slice(0, 40);
      }
    }

    mkdirSync(OUT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(OUT_DIR, `${role}-${route.path.replace(/[^a-z0-9]/gi, "_")}.png`),
      fullPage: false,
    });
  } catch (e) {
    status = "crashed";
    consoleErrors.push(`navigation: ${(e as Error).message}`);
  }

  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  page.off("response", onResponse);

  if (status === "ok" && consoleErrors.length) status = "console-error";
  if (status === "ok" && failedRequests.length) status = "request-failed";

  return {
    route: route.path,
    name: route.name,
    role,
    status,
    consoleErrors: consoleErrors.slice(0, 5),
    failedRequests: failedRequests.slice(0, 5),
    heading: heading?.trim() ?? null,
    bodyExcerpt,
    emptyStateText,
    counts,
    ms: Date.now() - started,
  };
}

test.describe.configure({ mode: "serial" });

test.describe(`Route audit (${LABEL})`, () => {
  test("partner walks every route", async ({ page }) => {
    test.setTimeout(300_000);
    await login(page, PARTNER);
    for (const route of ROUTES) {
      reports.push(await auditRoute(page, route, "partner"));
    }
  });

  test("analyst walks every route they can reach", async ({ page }) => {
    test.setTimeout(300_000);
    await login(page, ANALYST);
    for (const route of ROUTES.filter((r) => !r.partnerOnly)) {
      reports.push(await auditRoute(page, route, "analyst"));
    }
  });

  test.afterAll(() => {
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(reports, null, 2));
    const broken = reports.filter((r) => r.status !== "ok");
     
    console.log(
      `\n[audit:${LABEL}] ${reports.length} route visits · ${broken.length} with problems\n` +
        reports
          .map(
            (r) =>
              `  ${r.status === "ok" ? "ok  " : "FAIL"} ${r.role.padEnd(7)} ${r.route.padEnd(28)} ` +
              `${r.ms}ms ${r.emptyStateText ? `· empty: "${r.emptyStateText.slice(0, 60)}"` : ""}` +
              `${r.consoleErrors.length ? `\n         console: ${r.consoleErrors[0].slice(0, 160)}` : ""}` +
              `${r.failedRequests.length ? `\n         request: ${r.failedRequests.join(", ").slice(0, 160)}` : ""}`,
          )
          .join("\n"),
    );
  });
});
