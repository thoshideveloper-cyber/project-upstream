import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "screenshots/master";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (m) => { if (m.type() === "error") console.log("  [console.error]", m.text()); });

async function shot(name, full = false) {
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  console.log("captured:", name);
}

await page.goto(`${BASE}/login`);
await page.getByLabel("Email").fill("analyst1@upstream.test");
await page.getByLabel("Password").fill("Passw0rd!");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL("**/dashboard", { timeout: 15000 });

// Registry default
await page.goto(`${BASE}/master?view=my-book`);
await shot("v2-registry", true);

// Row menu open
await page.locator('button[aria-label^="Actions for"]').first().click();
await page.waitForTimeout(400);
await shot("v2-rowmenu");
await page.keyboard.press("Escape");

// Stopped lens
await page.getByRole("button", { name: /^Stopped/ }).click();
await shot("v2-lens-stopped");
await page.getByRole("button", { name: /^All \d/ }).click().catch(() => page.getByRole("button", { name: "All" }).first().click());

// Sort by next touch (flat)
await page.getByLabel("Sort").selectOption("next");
await shot("v2-sort-next");
await page.getByLabel("Sort").selectOption("registry");

// Search
await page.getByLabel("Search your book").fill("pharma");
await shot("v2-search");
await page.getByLabel("Search your book").fill("");

// Firm database
await page.goto(`${BASE}/master?view=firm-wide`);
await shot("v2-firm", true);

// Light mode
await page.goto(`${BASE}/master?view=my-book`);
const toggle = page.locator('button[aria-label="Switch to light mode"]');
await toggle.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
if (await toggle.count()) {
  await toggle.click();
  await shot("v2-light");
  await page.locator('button[aria-label="Switch to dark mode"]').click();
}

// Mobile
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/master?view=my-book`);
await shot("v2-mobile");

await browser.close();
console.log("DONE");
