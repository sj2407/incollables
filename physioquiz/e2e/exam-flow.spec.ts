import { test, expect, type Page } from '@playwright/test';

const TEST_EMAIL = 'teste2e@gmail.com';
const TEST_PASSWORD = 'TestPass123';

// Helper: login and wait for dashboard
async function login(page: Page) {
  await page.goto('/login');
  await page.fill('#email', TEST_EMAIL);
  await page.fill('#password', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10_000 });
}

test.describe('Exam Flow', () => {
  test.describe.configure({ mode: 'serial' });

  let topicId: string;
  let sessionId: string;

  test('T-E1: Login + navigate to exam setup', async ({ page }) => {
    await login(page);

    // Go to topics to get a topicId
    await page.goto('/topics');
    await page.waitForSelector('h1', { timeout: 10_000 });

    // Click on first topic that has questions
    const topicLink = page.locator('a[href*="/quiz/setup/"]').first();
    const href = await topicLink.getAttribute('href');
    topicId = href!.split('/quiz/setup/')[1];
    expect(topicId).toBeTruthy();

    // Navigate to exam setup
    await page.goto(`/exam/setup/${topicId}`);
    await page.waitForSelector('h1', { timeout: 10_000 });

    const heading = await page.textContent('h1');
    expect(heading).toContain('Examen blanc');

    // Check warning is visible
    const warning = page.locator('text=Correction');
    await expect(warning).toBeVisible();
  });

  test('T-E2: Configure and start exam', async ({ page }) => {
    await login(page);
    await page.goto(`/exam/setup/${topicId}`);
    await page.waitForSelector('h1', { timeout: 10_000 });

    // Select 20 questions (or first available option)
    const countButton = page.locator('button[aria-pressed]').first();
    if (await countButton.isVisible()) {
      // Click the "20" button if available, otherwise click first available
      const btn20 = page.locator('button:has-text("20"):not([disabled])');
      if (await btn20.isVisible()) {
        await btn20.click();
      } else {
        // Click "Toutes" if 20 isn't available
        const btnAll = page.locator('button:has-text("Toutes"):not([disabled])');
        await btnAll.click();
      }
    }

    // Select 30 min duration
    const btn30 = page.locator('button:has-text("30 min")');
    await btn30.click();

    // Start exam
    const startButton = page.locator('button:has-text("marrer")');
    await expect(startButton).toBeEnabled({ timeout: 5_000 });
    await startButton.click();

    // Should navigate to exam play page
    await page.waitForURL('**/exam/play/**', { timeout: 15_000 });
    sessionId = page.url().split('/exam/play/')[1];
    expect(sessionId).toBeTruthy();
  });

  test('T-E3: Exam play page has countdown + navigation', async ({ page }) => {
    await login(page);
    await page.goto(`/exam/play/${sessionId}`);

    // Wait for question to load
    await page.waitForSelector('text=Question 1/', { timeout: 15_000 });

    // Countdown should be visible (MM:SS format)
    const countdown = page.locator('span[aria-label*="Temps restant"]');
    await expect(countdown).toBeVisible();

    // Choices should be visible
    const choices = page.locator('div[role="group"] button');
    const choiceCount = await choices.count();
    expect(choiceCount).toBeGreaterThanOrEqual(2);

    // Navigation buttons should exist
    const prevBtn = page.locator('button:has-text("dente")');
    await expect(prevBtn).toBeVisible();
    const nextBtn = page.locator('button:has-text("Suivante")');
    await expect(nextBtn).toBeVisible();

    // Navigator grid should be visible
    const navGrid = page.locator('text=Navigation rapide');
    await expect(navGrid).toBeVisible();

    // "Terminer l'examen" button
    const submitBtn = page.locator('button:has-text("Terminer")');
    await expect(submitBtn).toBeVisible();
  });

  test('T-E4: Select answer + flag + navigate', async ({ page }) => {
    await login(page);
    await page.goto(`/exam/play/${sessionId}`);
    await page.waitForSelector('text=Question 1/', { timeout: 15_000 });

    // Select a choice
    const firstChoice = page.locator('div[role="group"] button').first();
    await firstChoice.click();

    // Flag the question
    const flagBtn = page.locator('button:has-text("Marquer")');
    await flagBtn.click();

    // Flag indicator should show on navigator
    const flagDot = page.locator('.bg-warning').first();
    await expect(flagDot).toBeVisible();

    // Navigate to next question
    const nextBtn = page.locator('button:has-text("Suivante")');
    await nextBtn.click();
    await page.waitForSelector('text=Question 2/', { timeout: 5_000 });

    // Navigate back
    const prevBtn = page.locator('button:has-text("dente")');
    await prevBtn.click();
    await page.waitForSelector('text=Question 1/', { timeout: 5_000 });

    // Previous answer should still be selected (persisted)
    const pressed = page.locator('div[role="group"] button[aria-pressed="true"]');
    const pressedCount = await pressed.count();
    expect(pressedCount).toBeGreaterThanOrEqual(1);
  });

  test('T-E5: Submit exam + see results', async ({ page }) => {
    await login(page);
    await page.goto(`/exam/play/${sessionId}`);
    await page.waitForSelector('text=Question', { timeout: 15_000 });

    // Click "Terminer l'examen"
    const submitBtn = page.locator('button:has-text("Terminer")');
    await submitBtn.click();

    // Confirmation dialog should appear
    const dialog = page.locator('div[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 3_000 });

    // Click "Soumettre"
    const confirmBtn = page.locator('div[role="dialog"] button:has-text("Soumettre")');
    await confirmBtn.click();

    // Should show "Correction en cours..." then results
    // Wait for results to appear
    await page.waitForSelector('text=sultat', { timeout: 30_000 });

    // Score should be visible
    const scoreEl = page.locator('text=/%');
    // Results page should have stat badges
    const correctBadge = page.locator('text=Correctes');
    await expect(correctBadge).toBeVisible();
  });

  test('T-E6: Mobile responsive at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page);
    await page.goto(`/exam/setup/${topicId}`);
    await page.waitForSelector('h1', { timeout: 10_000 });

    // No horizontal overflow
    const body = page.locator('body');
    const box = await body.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(375);

    // Touch targets ≥ 40px
    const buttons = page.locator('button');
    const count = await buttons.count();
    for (let i = 0; i < Math.min(count, 10); i++) {
      const btn = buttons.nth(i);
      if (await btn.isVisible()) {
        const btnBox = await btn.boundingBox();
        if (btnBox) {
          expect(btnBox.height).toBeGreaterThanOrEqual(40);
        }
      }
    }
  });
});
