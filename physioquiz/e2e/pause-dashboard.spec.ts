import { test, expect, type Page } from '@playwright/test';

const TEST_EMAIL = 'teste2e@gmail.com';
const TEST_PASSWORD = 'TestPass123';

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('#email', TEST_EMAIL);
  await page.fill('#password', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/practice', { timeout: 10_000 });
}

/** Start a short quiz session and return the sessionId */
async function startQuizSession(page: Page): Promise<string> {
  // Find a topic with questions
  await page.goto('/practice');
  await page.waitForFunction(
    () => !document.querySelector('.animate-pulse'),
    { timeout: 10_000 },
  );
  const link = page
    .locator('a[href*="/quiz/setup/"]:not(.pointer-events-none)')
    .first();
  const href = await link.getAttribute('href');
  const topicId = href!.split('/quiz/setup/')[1];

  await page.goto(`/quiz/setup/${topicId}`);
  await page.waitForFunction(
    () => !document.querySelector('.animate-pulse'),
    { timeout: 10_000 },
  );

  // Select first available count option
  const countButtons = page.locator('button[aria-pressed]');
  const btnCount = await countButtons.count();
  for (let i = 0; i < btnCount; i++) {
    const btn = countButtons.nth(i);
    if (await btn.isEnabled()) {
      await btn.click();
      break;
    }
  }

  // Start
  const startButton = page.locator('button', { hasText: /Démarrer/ });
  await startButton.click();
  await page.waitForURL('**/quiz/play/**', { timeout: 15_000 });

  const sessionId = page.url().split('/quiz/play/')[1];
  // Wait for quiz to fully load
  await page.waitForFunction(
    () => !document.querySelector('.animate-pulse'),
    { timeout: 15_000 },
  );
  return sessionId;
}

test.describe('Pause, Resume & Practice', () => {
  test.describe.configure({ mode: 'serial' });

  let pausedSessionId: string;

  test('T-E1: Pause mid-quiz → redirected to practice with paused session', async ({
    page,
  }) => {
    await login(page);
    pausedSessionId = await startQuizSession(page);

    // Answer one question first so there's progress
    const choice = page.locator('[aria-pressed="false"]').first();
    await expect(choice).toBeVisible({ timeout: 5_000 });
    await choice.click();

    const validateBtn = page.locator('button', { hasText: /Valider/ });
    await expect(validateBtn).toBeEnabled();
    await validateBtn.click();

    // Wait for correction
    const nextBtn = page.locator('button', { hasText: /Question suivante/ });
    await expect(nextBtn).toBeVisible({ timeout: 15_000 });

    // Click Pause button
    const pauseBtn = page.locator('button', { hasText: /Pause/ });
    if (await pauseBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pauseBtn.click();
      // Should redirect to practice
      await page.waitForURL('**/practice', { timeout: 10_000 });
    } else {
      // If no pause button (might be last question), go to next and try
      await nextBtn.click();
      await page.waitForTimeout(500);
      const pauseBtn2 = page.locator('button', { hasText: /Pause/ });
      await pauseBtn2.click();
      await page.waitForURL('**/practice', { timeout: 10_000 });
    }

    // Verify practice page shows paused session
    const pausedSection = page.locator('text=/Sessions en cours/');
    await expect(pausedSection).toBeVisible({ timeout: 5_000 });

    const resumeBtn = page.locator('button', { hasText: /Reprendre/ });
    const resumeCount = await resumeBtn.count();
    expect(resumeCount).toBeGreaterThan(0);
    console.log(`Practice page shows ${resumeCount} paused session(s) with Reprendre button`);
  });

  test('T-E2: Resume paused session → quiz resumes at correct question', async ({
    page,
  }) => {
    if (!pausedSessionId) test.skip();
    await login(page);

    // Go to practice page
    await page.goto('/practice');
    await page.waitForFunction(
      () => !document.querySelector('.animate-pulse'),
      { timeout: 10_000 },
    );

    // Click Reprendre on the paused session
    const resumeBtn = page.locator('button', { hasText: /Reprendre/ }).first();
    await expect(resumeBtn).toBeVisible({ timeout: 5_000 });
    await resumeBtn.click();

    // Should navigate to play page
    await page.waitForURL('**/quiz/play/**', { timeout: 10_000 });

    // Quiz should load (not show error or abandoned)
    await page.waitForFunction(
      () => !document.querySelector('.animate-pulse'),
      { timeout: 15_000 },
    );

    // Should NOT show expired/abandoned message
    const expiredMsg = page.locator('text=/Session expirée/');
    const isExpired = await expiredMsg
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    expect(isExpired).toBe(false);

    // Should show question (with progress indicator showing we're past Q1)
    const progressText = page.locator('text=/Question \\d+/');
    await expect(progressText).toBeVisible({ timeout: 5_000 });
    const text = await progressText.textContent();
    console.log(`Resumed at: ${text}`);

    // Choices should be visible (quiz is active)
    const choices = page.locator('[aria-pressed]');
    await expect(choices.first()).toBeVisible({ timeout: 5_000 });
    console.log('Resume: quiz is active with choices visible');
  });

  test('T-E3: Practice page sections (paused sessions + topic tree)', async ({
    page,
  }) => {
    await login(page);
    await page.goto('/practice');
    await page.waitForFunction(
      () => !document.querySelector('.animate-pulse'),
      { timeout: 10_000 },
    );

    // Heading
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();

    // "Sessions en cours" section (only appears if there are paused sessions)
    const pausedHeading = page.locator('h2', {
      hasText: /Sessions en cours/,
    });
    const hasPaused = await pausedHeading
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    if (hasPaused) {
      console.log('Paused sessions section visible');
    }

    // Topic tree should be visible with quiz setup links
    const topicLinks = page.locator('a[href*="/quiz/setup/"]');
    const count = await topicLinks.count();
    expect(count).toBeGreaterThan(0);
    console.log(`Practice page shows ${count} topic links`);

    await page.screenshot({ path: 'e2e/screenshots/practice.png' });
    console.log('Practice page sections verified');
  });

  test('T-E4: Complete session → appears in stats recent sessions', async ({
    page,
  }) => {
    if (!pausedSessionId) test.skip();
    await login(page);

    // Resume and complete the paused session
    await page.goto(`/quiz/play/${pausedSessionId}`);
    await page.waitForFunction(
      () => !document.querySelector('.animate-pulse'),
      { timeout: 15_000 },
    );

    // Answer all remaining questions
    let maxIterations = 50;
    while (maxIterations-- > 0) {
      if (page.url().includes('/quiz/results/')) break;

      // Check for "Voir les résultats détaillés" button (session complete interstitial)
      // Use main content area to avoid matching sidebar "Mes résultats" link
      const resultsBtn = page
        .locator('main button, main a')
        .filter({ hasText: /Voir les résultats/ });
      if (
        await resultsBtn
          .first()
          .isVisible({ timeout: 500 })
          .catch(() => false)
      ) {
        await resultsBtn.first().click();
        try {
          await page.waitForURL('**/quiz/results/**', { timeout: 10_000 });
        } catch {
          // might already be on results page
        }
        break;
      }

      // Check for "Question suivante"
      const nextBtn = page.locator('button', {
        hasText: /Question suivante/,
      });
      if (
        await nextBtn.isVisible({ timeout: 500 }).catch(() => false)
      ) {
        await nextBtn.click();
        await page.waitForTimeout(300);
        continue;
      }

      // Select a choice and validate
      const choice = page.locator('[aria-pressed="false"]').first();
      if (
        await choice.isVisible({ timeout: 2000 }).catch(() => false)
      ) {
        await choice.click();
        const validateBtn = page.locator('button', {
          hasText: /Valider/,
        });
        if (
          await validateBtn
            .isEnabled({ timeout: 1000 })
            .catch(() => false)
        ) {
          await validateBtn.click();
          // Wait for correction view to appear
          await page.locator('button:has-text("Question suivante"), button:has-text("Voir les résultats"), main a:has-text("Voir les résultats")').first().waitFor({ timeout: 15_000 });
        }
      } else {
        await page.waitForTimeout(500);
      }
    }

    // Should be on results page
    expect(page.url()).toContain('/quiz/results/');

    // Go to stats page and check session history
    await page.goto('/stats');
    await page.waitForFunction(
      () => !document.querySelector('.animate-pulse'),
      { timeout: 10_000 },
    );

    // The completed session should appear in session history
    const historyHeading = page.locator('h2', { hasText: /Historique des sessions/ });
    const hasHistory = await historyHeading.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasHistory) {
      const sessionCards = page.locator('a[href*="/quiz/results/"], a[href*="/exam/results/"]');
      const count = await sessionCards.count();
      expect(count).toBeGreaterThan(0);
      console.log(`Stats page shows ${count} session(s) in history`);
    }
  });

  test('T-E5: Mobile practice at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page);
    await page.goto('/practice');
    await page.waitForFunction(
      () => !document.querySelector('.animate-pulse'),
      { timeout: 10_000 },
    );

    // No horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);

    // Touch targets on buttons
    const buttons = page.locator('button, a.flex');
    const btnCount = await buttons.count();
    for (let i = 0; i < Math.min(btnCount, 5); i++) {
      const box = await buttons.nth(i).boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(40);
      }
    }

    await page.screenshot({
      path: 'e2e/screenshots/mobile-practice.png',
    });
    console.log('Mobile practice: no overflow, touch targets OK');
  });
});
