const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\Hemanth Kumar L\\.gemini\\antigravity-ide\\brain\\d4953e5e-a97a-4ca5-ab52-2f51924f083c';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function main() {
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ channel: 'chrome' });

  const viewports = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ];

  const themes = ['dark', 'light'];

  for (const vp of viewports) {
    for (const theme of themes) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        colorScheme: theme,
      });

      const page = await context.newPage();

      // Set theme attribute in DOM
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
      await page.evaluate((t) => {
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem('nearby-theme', t);
      }, theme);
      await page.waitForTimeout(500);

      const filename = `phase1_${vp.name}_${theme}.png`;
      const outPath = path.join(ARTIFACT_DIR, filename);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`Saved screenshot: ${outPath}`);

      // Also capture login page for form inputs/buttons verification
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
      await page.evaluate((t) => {
        document.documentElement.setAttribute('data-theme', t);
      }, theme);
      await page.waitForTimeout(400);
      const loginFilename = `phase1_login_${vp.name}_${theme}.png`;
      const loginOutPath = path.join(ARTIFACT_DIR, loginFilename);
      await page.screenshot({ path: loginOutPath, fullPage: false });
      console.log(`Saved screenshot: ${loginOutPath}`);

      await context.close();
    }
  }

  await browser.close();
  console.log('All screenshots captured successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
