import { test } from '@playwright/test';

const TEST_EMAIL = 'teste2e@gmail.com';
const TEST_PASSWORD = 'TestPass123';

test('full glassmorphism audit', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto('/login');
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/practice**', { timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/audit-practice.png', fullPage: false });

  // Quiz setup
  await page.click('text=Le métabolisme de base');
  await page.waitForURL('**/quiz/setup/**');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/audit-quiz-setup.png', fullPage: false });

  // Start quiz
  await page.click('button:has-text("TOUTES")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Démarrer")');
  await page.waitForURL('**/quiz/play/**', { timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/audit-quiz-play.png', fullPage: false });

  // Select a choice to see the button
  await page.locator('[aria-label="Propositions"] button').first().click({ force: true });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/audit-quiz-selected.png', fullPage: false });

  // Stats page
  await page.goto('/stats');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/audit-stats.png', fullPage: false });

  // Learn page
  await page.goto('/learn');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/audit-learn.png', fullPage: false });
});
