const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto('http://localhost:3000/login');
  await page.fill('input[type=email], input[name=email]', 'partner@upstream.test');
  await page.fill('input[type=password], input[name=password]', 'Passw0rd!');
  await page.click('button[type=submit]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });

  await page.goto('http://localhost:3000/projects');
  await page.waitForTimeout(3500);
  await page.screenshot({ path: 'screenshots/projects-list.png' });
  console.log('projects-list done');

  const firstLink = page.locator('a[href^="/projects/"]').first();
  if (await firstLink.count() > 0) {
    await firstLink.click();
    await page.waitForTimeout(3500);
    await page.screenshot({ path: 'screenshots/project-detail.png' });
    console.log('project-detail done');

    const gridLink = page.locator('a[href*="grid"]').first();
    if (await gridLink.count() > 0) {
      await gridLink.click();
      await page.waitForTimeout(3500);
      await page.screenshot({ path: 'screenshots/project-grid.png' });
      console.log('project-grid done');
    }
  }

  await page.goto('http://localhost:3000/analytics/projects');
  await page.waitForTimeout(3500);
  await page.screenshot({ path: 'screenshots/analytics-projects.png' });
  console.log('analytics-projects done');

  await browser.close();
  console.log('DONE');
})().catch(e => { console.error(e.message); process.exit(1); });
