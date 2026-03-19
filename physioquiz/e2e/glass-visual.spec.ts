import { test } from '@playwright/test';

const TEST_EMAIL = 'teste2e@gmail.com';
const TEST_PASSWORD = 'TestPass123';

test('glassmorphism visual check', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto('/login');
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/practice**', { timeout: 15000 });

  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/glass-practice.png', fullPage: false });

  // Navigate to stats
  await page.goto('/stats');
  await page.waitForURL('**/stats**', { timeout: 10000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/glass-stats.png', fullPage: false });

  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/glass-stats-scroll.png', fullPage: false });
});
