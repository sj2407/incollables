import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'teste2e@gmail.com';
const TEST_PASSWORD = 'TestPass123';

test('bottom sheet visual check', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto('/login');
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/practice**', { timeout: 15000 });

  await page.click('text=Le métabolisme de base');
  await page.waitForURL('**/quiz/setup/**');
  await page.click('button:has-text("TOUTES")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("Démarrer")');
  await page.waitForURL('**/quiz/play/**', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Answer each question: pick choice A, scroll down, validate, then next
  for (let i = 0; i < 4; i++) {
    if (await page.locator('text=Session terminée').isVisible().catch(() => false)) break;

    // Click choice A
    await page.locator('[aria-label="Propositions"] button').first().click({ force: true });
    await page.waitForTimeout(300);

    // Scroll to bottom to reveal Valider
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);

    // Click Valider
    await page.locator('button:has-text("Valider")').click({ force: true });
    await page.waitForTimeout(1500);

    if (await page.locator('text=Session terminée').isVisible().catch(() => false)) break;

    // Click Suivante
    const next = page.locator('button:has-text("Suivante")');
    if (await next.isVisible().catch(() => false)) {
      await next.click({ force: true });
      await page.waitForTimeout(1000);
    }
  }

  await expect(page.locator('text=Session terminée')).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/bottom-sheet-peek.png', fullPage: false });

  await page.locator('text=Voir les résultats détaillés').click({ force: true });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/bottom-sheet-open.png', fullPage: false });
});
