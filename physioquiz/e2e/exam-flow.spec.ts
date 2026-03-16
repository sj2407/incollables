import { test, expect, type Page } from '@playwright/test';

const TEST_EMAIL = 'teste2e@gmail.com';
const TEST_PASSWORD = 'TestPass123';

// Helper: login and wait for practice page
async function login(page: Page) {
  await page.goto('/login');
  await page.fill('#email', TEST_EMAIL);
  await page.fill('#password', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/practice', { timeout: 10_000 });
}

test.describe('Exam Flow', () => {
  test.describe.configure({ mode: 'serial' });

  let topicId: string;
  let sessionId: string;

  test('T-E1: Login + navigate to exam setup', async ({ page }) => {
    await login(page);

    // Go to practice to get a topicId
    await page.goto('/practice');
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
  });

  test('T-E2: See exam info and start exam', async ({ page }) => {
    await login(page);
    await page.goto(`/exam/setup/${topicId}`);
    await page.waitForSelector('h1', { timeout: 10_000 });

    // Exam info summary should show auto-computed values
    const questionsInfo = page.getByText('Questions', { exact: true });
    await expect(questionsInfo).toBeVisible();
    const durationInfo = page.getByText('Durée', { exact: true });
    await expect(durationInfo).toBeVisible();

    // Start exam — button should be enabled immediately (no user selection needed)
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

    // Choices should be visible (wait for them to load)
    const choices = page.locator('div[role="group"] button');
    await choices.first().waitFor({ timeout: 10_000 });
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
    // Wait for exam results to appear (can take 30s+ for large exams with 200+ questions)
    // Use a selector unique to ExamResults component, not sidebar
    const correctBadge = page.locator('main').getByText('Correctes', { exact: true });
    await expect(correctBadge).toBeVisible({ timeout: 60_000 });
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
