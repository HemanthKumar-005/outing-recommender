const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\Hemanth Kumar L\\.gemini\\antigravity-ide\\brain\\d55061b1-7377-41c4-ae1d-21fa7af0ab3f';
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

  const pagesToCapture = [
    { name: 'landing', path: '/' },
    { name: 'login', path: '/login' },
    { name: 'onboarding', path: '/onboarding' },
    { name: 'dateplanner', path: '/dashboard/date-planner' },
    { name: 'notfound', path: '/nonexistent-route-for-404' }
  ];

  for (const vp of viewports) {
    for (const theme of themes) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        colorScheme: theme,
      });

      for (const p of pagesToCapture) {
        if (vp.name === 'mobile' && p.name !== 'landing' && p.name !== 'login') continue;

        const page = await context.newPage();
        try {
          // Intercept auth/me endpoint so dashboard and onboarding render seamlessly
          await page.route('**/auth/me', async (route) => {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                user: {
                  id: 1,
                  name: 'Alex Rivera',
                  email: 'alex@example.com',
                  email_verified_at: '2026-10-29T12:00:00Z',
                },
              }),
            });
          });

          // Intercept venues or dates if needed with dummy data
          await page.route('**/venues**', async (route) => {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                results: [
                  {
                    id: 101,
                    name: 'Toit Brewpub',
                    category: 'nightlife',
                    rating: 4.8,
                    price_level: 2,
                    address: '100 Feet Rd, Indiranagar',
                    composite_score: 0.95,
                    score_breakdown: { base_quality: 0.9, weather: 0.95, budget: 0.92, distance: 0.88, social: 0.96 }
                  }
                ],
                total: 1
              }),
            });
          });

          // Seed localStorage before navigation
          await page.addInitScript((t) => {
            document.documentElement.setAttribute('data-theme', t);
            localStorage.setItem('nearby-theme', t);
            localStorage.setItem('nearby_user', JSON.stringify({
              id: 1,
              name: 'Alex Rivera',
              email: 'alex@example.com',
              email_verified_at: '2026-10-29T12:00:00Z'
            }));
            localStorage.setItem('nearby_onboarded', 'true');
          }, theme);

          await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'networkidle', timeout: 15000 });
          await page.waitForTimeout(600);

          const filename = `modern_${p.name}_${vp.name}_${theme}.png`;
          const outPath = path.join(ARTIFACT_DIR, filename);
          await page.screenshot({ path: outPath, fullPage: false });
          console.log(`Saved screenshot: ${outPath}`);
        } catch (err) {
          console.error(`Error capturing ${p.name}:`, err.message);
        } finally {
          await page.close();
        }
      }

      await context.close();
    }
  }

  await browser.close();
  console.log('All modernization screenshots captured successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
