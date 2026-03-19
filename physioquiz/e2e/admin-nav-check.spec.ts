import { test } from '@playwright/test';

const TEST_EMAIL = 'teste2e@gmail.com';
const TEST_PASSWORD = 'TestPass123';

test('admin + nav visual check', async ({ page }) => {
  // Mobile for nav
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/practice**', { timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/nav-mobile.png', fullPage: false });

  // Admin desktop
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/admin/questions');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/admin-questions.png', fullPage: false });
});
