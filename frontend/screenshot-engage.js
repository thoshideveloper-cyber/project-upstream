const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newContext({ viewport: { width: 1440, height: 900 } }).then(c => c.newPage());
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('http://localhost:3002/login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[type=email]', 'partner@upstream.test');
  await page.fill('input[type=password]', 'Passw0rd!');
  await page.click('button[type=submit]');
  await page.waitForURL('**/dashboard', { timeout: 12000 });

  // Open Medanta project (two-sided)
  await page.goto('http://localhost:3002/projects');
  await page.waitForTimeout(2500);
  await page.locator('text=Medanta Healthcare').first().click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'screenshots/eng-01-project-detail.png' });
  console.log('project detail captured');

  // Click Add engagement
  await page.locator('button:has-text("Add engagement")').first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/eng-02-dialog.png' });
  console.log('dialog captured');

  console.log('ERRORS:', JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
