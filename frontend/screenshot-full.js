const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Login as partner
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type=email], input[name=email]', 'partner@upstream.test');
  await page.fill('input[type=password], input[name=password]', 'Passw0rd!');
  await page.click('button[type=submit]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/01-dashboard.png' });
  console.log('01-dashboard');

  // Projects list
  await page.goto('http://localhost:3000/projects');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'screenshots/02-projects.png' });
  console.log('02-projects');

  // Project detail - click Medanta (has 2 mandates)
  const medanta = page.locator('text=Medanta Healthcare').first();
  if (await medanta.count() > 0) {
    await medanta.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/03-project-detail.png' });
    console.log('03-project-detail');

    // Grid link
    const gridLink = page.locator('a[href*="grid"]').first();
    if (await gridLink.count() > 0) {
      await gridLink.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'screenshots/04-project-grid.png' });
      console.log('04-project-grid');
    }
  }

  // Companies
  await page.goto('http://localhost:3000/companies');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'screenshots/05-companies.png' });
  console.log('05-companies');

  // Schedule
  await page.goto('http://localhost:3000/schedule');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'screenshots/06-schedule.png' });
  console.log('06-schedule');

  // Analytics
  await page.goto('http://localhost:3000/analytics');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'screenshots/07-analytics.png' });
  console.log('07-analytics');

  // Project health
  await page.goto('http://localhost:3000/analytics/projects');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'screenshots/08-project-health.png' });
  console.log('08-project-health');

  // Mandates
  await page.goto('http://localhost:3000/mandates');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'screenshots/09-mandates.png' });
  console.log('09-mandates');

  await browser.close();
  console.log('ALL DONE');
})().catch(e => { console.error(e.message); process.exit(1); });
