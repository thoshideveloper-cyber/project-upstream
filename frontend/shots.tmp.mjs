// Screenshot every product page in both themes, and measure the things the
// normalization was supposed to make identical.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT = process.argv[2] || "shots";
const BASE = "http://localhost:3000";
const API = "http://localhost:8000";

const ROUTES = [
  ["dashboard", "/dashboard"],
  ["schedule", "/schedule"],
  ["master", "/master"],
  ["sourcing", "/sourcing"],
  ["sourcing-analytics", "/sourcing/analytics"],
  ["sourcing-import", "/sourcing/import"],
  ["projects", "/projects"],
  ["contacts", "/contacts"],
  ["companies", "/companies"],
  ["analytics", "/analytics"],
  ["analytics-projects", "/analytics/projects"],
  ["settings", "/settings"],
];

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();

// Log in through the real API so cookies land on the right origin.
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
const res = await page.request.post(`${API}/auth/login`, {
  data: { email: "analyst1@upstream.test", password: "analyst123" },
});
if (!res.ok()) {
  console.log("login failed", res.status(), (await res.text()).slice(0, 300));
}

const measurements = [];

for (const theme of ["dark", "light"]) {
  await page.addInitScript((t) => {
    try { localStorage.setItem("theme", t); } catch {}
  }, theme);

  for (const [name, route] of ROUTES) {
    try {
      await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(900);

      // Measure the roles that were supposed to be unified.
      const m = await page.evaluate(() => {
        const px = (v) => Math.round(parseFloat(v) * 100) / 100;
        const frame = document.querySelector(".page-enter");
        const h1 = document.querySelector("h1");
        const fcs = frame && getComputedStyle(frame);
        const hcs = h1 && getComputedStyle(h1);
        // Every element whose computed font-size is in the micro-label band.
        const labels = new Set();
        for (const el of document.querySelectorAll("*")) {
          const cs = getComputedStyle(el);
          if (cs.textTransform === "uppercase" && parseFloat(cs.fontSize) <= 12 && el.textContent.trim()) {
            labels.add(`${px(cs.fontSize)}/${cs.fontWeight}/${px(cs.letterSpacing) || 0}`);
          }
        }
        return {
          framePadding: fcs ? `${px(fcs.paddingLeft)}` : null,
          frameMaxWidth: fcs ? fcs.maxWidth : null,
          titleSize: hcs ? px(hcs.fontSize) : null,
          titleFamily: hcs ? hcs.fontFamily.split(",")[0] : null,
          labelSpecs: [...labels].sort(),
          docScrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });
      measurements.push({ theme, name, ...m });

      await page.screenshot({ path: path.join(OUT, `${theme}-${name}.png`), fullPage: false });
      console.log("shot", theme, name, JSON.stringify(m.labelSpecs), "title", m.titleSize, "pad", m.framePadding, "max", m.frameMaxWidth);
    } catch (e) {
      console.log("FAIL", theme, name, String(e).slice(0, 160));
    }
  }
}

fs.writeFileSync(path.join(OUT, "measurements.json"), JSON.stringify(measurements, null, 2));
await browser.close();

// Summary: the whole point is that these collapse to one value each.
const titles = [...new Set(measurements.map((m) => m.titleSize).filter(Boolean))];
const pads = [...new Set(measurements.map((m) => m.framePadding).filter(Boolean))];
const maxes = [...new Set(measurements.map((m) => m.frameMaxWidth).filter(Boolean))];
const specs = [...new Set(measurements.flatMap((m) => m.labelSpecs))];
console.log("\n=== CONSISTENCY SUMMARY ===");
console.log("distinct page-title sizes :", titles);
console.log("distinct frame paddings   :", pads);
console.log("distinct frame max-widths :", maxes);
console.log("distinct uppercase specs  :", specs);
console.log("pages with h-scroll       :", measurements.filter((m) => m.docScrollX).map((m) => `${m.theme}/${m.name}`));
