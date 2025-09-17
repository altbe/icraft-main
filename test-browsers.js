import { chromium, firefox } from '@playwright/test';

async function testBrowsers() {
  console.log('🎭 Playwright Browser Test\n');
  console.log('=' .repeat(50));

  // Test Chromium
  console.log('\n🌐 Testing Chromium Browser');
  console.log('-'.repeat(30));

  try {
    const chromiumBrowser = await chromium.launch({
      headless: true,
      executablePath: '/home/g/.cache/playwright/chromium-1187/chrome-linux/chrome'
    });

    const chromiumPage = await chromiumBrowser.newPage();
    await chromiumPage.goto('https://example.com');

    const chromiumTitle = await chromiumPage.title();
    console.log('✅ Chromium: Successfully loaded page');
    console.log(`   Title: ${chromiumTitle}`);
    console.log(`   Version: ${chromiumBrowser.version()}`);

    await chromiumPage.screenshot({ path: 'chromium-test.png' });
    console.log('📸 Screenshot saved: chromium-test.png');

    await chromiumBrowser.close();
  } catch (error) {
    console.error('❌ Chromium test failed:', error.message);
  }

  // Test Firefox
  console.log('\n🦊 Testing Firefox Browser');
  console.log('-'.repeat(30));

  try {
    const firefoxBrowser = await firefox.launch({
      headless: true,
      executablePath: '/home/g/.cache/playwright/firefox-1490/firefox/firefox'
    });

    const firefoxPage = await firefoxBrowser.newPage();
    await firefoxPage.goto('https://example.com');

    const firefoxTitle = await firefoxPage.title();
    console.log('✅ Firefox: Successfully loaded page');
    console.log(`   Title: ${firefoxTitle}`);
    console.log(`   Version: ${firefoxBrowser.version()}`);

    await firefoxPage.screenshot({ path: 'firefox-test.png' });
    console.log('📸 Screenshot saved: firefox-test.png');

    await firefoxBrowser.close();
  } catch (error) {
    console.error('❌ Firefox test failed:', error.message);
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎉 Browser tests completed!\n');
}

testBrowsers().catch(console.error);