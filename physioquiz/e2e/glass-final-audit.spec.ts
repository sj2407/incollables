import { test } from '@playwright/test';

const TEST_EMAIL = 'teste2e@gmail.com';
const TEST_PASSWORD = 'TestPass123';

test('final glass audit — student + admin', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  // Login
  await page.goto('/login');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/final-login.png', fullPage: false });

  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/practice**', { timeout: 15000 });

  // Practice
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/final-practice.png', fullPage: false });

  // Expand a chapter to see sub-chapters
  const caret = page.locator('button[aria-label="Déplier"]').first();
  if (await caret.isVisible({ timeout: 2000 }).catch(() => false)) {
    await caret.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/final-practice-expanded.png', fullPage: false });
  }

  // Stats
  await page.goto('/stats');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/final-stats.png', fullPage: false });

  // Admin dashboard (desktop viewport)
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/admin');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/final-admin-dashboard.png', fullPage: false });

  // Admin questions
  await page.goto('/admin/questions');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/final-admin-questions.png', fullPage: false });
});
