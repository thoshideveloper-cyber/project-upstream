import { chromium } from "@playwright/test";
const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const msgs = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") msgs.push(`[${m.type()}] ${m.text().slice(0, 400)}`);
});
page.on("pageerror", (e) => msgs.push(`[pageerror] ${String(e).slice(0, 400)}`));
await page.goto(`${BASE}/login`);
await page.fill('input[type="email"]', "partner@upstream.test");
await page.fill('input[type="password"]', "Passw0rd!");
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard", { timeout: 20000 });
await page.goto(`${BASE}/schedule`);
await page.waitForSelector("h1", { timeout: 15000 });
await page.waitForTimeout(1500);
// theme toggle both ways
await page.click('button[aria-label="Switch to light mode"]').catch(() => {});
await page.waitForTimeout(800);
await page.click('button[aria-label="Switch to dark mode"]').catch(() => {});
await page.waitForTimeout(800);
// navigate around
for (const path of ["/contacts", "/master", "/schedule"]) {
  await page.goto(`${BASE}${path}`);
  await page.waitForTimeout(1200);
}
console.log(msgs.length ? [...new Set(msgs)].join("\n---\n") : "NO CONSOLE ISSUES");
await browser.close();
