import { chromium } from '@playwright/test';

async function testPlaywright() {
  console.log('Starting Playwright test...');

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/home/g/.cache/playwright/chromium-1187/chrome-linux/chrome'
  });

  const page = await browser.newPage();

  console.log('Navigating to example.com...');
  await page.goto('https://example.com');

  const title = await page.title();
  console.log('Page title:', title);

  const heading = await page.textContent('h1');
  console.log('H1 heading:', heading);

  console.log('Taking screenshot...');
  await page.screenshot({ path: 'example-screenshot.png' });
  console.log('Screenshot saved as example-screenshot.png');

  console.log('Navigating to Google...');
  await page.goto('https://www.google.com');

  console.log('Typing search query...');
  await page.fill('textarea[name="q"]', 'Playwright testing');

  const googleTitle = await page.title();
  console.log('Google page title:', googleTitle);

  await browser.close();
  console.log('Test completed successfully!');
}

testPlaywright().catch(console.error);