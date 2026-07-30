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

  // Go directly to Medanta project detail
  await page.goto('http://localhost:3000/projects');
  await page.waitForTimeout(2500);
  await page.locator('text=Medanta Healthcare').first().click();
  await page.waitForTimeout(3000);

  // Click Grid view on first mandate
  const gridLink = page.locator('a[href*="grid"]').first();
  await gridLink.click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'screenshots/04-project-grid.png' });
  console.log('grid done');
  console.log('URL:', page.url());

  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
