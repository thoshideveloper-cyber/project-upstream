import { defineConfig, devices } from "@playwright/test";

/**
 * Critical-path E2E tests. Requires browsers once: `npx playwright install`.
 * The webServer block boots `next dev` automatically for local runs.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  /**
   * Serial, deliberately (P5). Every spec drives ONE seeded database and mutates
   * it — creating companies, archiving a project, flagging a status — so parallel
   * workers both race each other's data (two specs counting the same board column
   * while a third moves a card) and pile four concurrent bcrypt logins onto the
   * dev backend, which pushed past the 5s expect timeout. Run serially and the
   * whole suite is green; run it fully parallel and roughly half of it flakes.
   */
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
