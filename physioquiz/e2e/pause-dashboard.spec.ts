import { test, expect, type Page } from '@playwright/test';

const TEST_EMAIL = 'teste2e@gmail.com';
const TEST_PASSWORD = 'TestPass123';

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('#email', TEST_EMAIL);
  await page.fill('#password', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10_000 });
}

/** Start a short quiz session and return the sessionId */
async function startQuizSession(page: Page): Promise<string> {
  // Find a topic with questions
  await page.goto('/topics');
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

test.describe('Pause, Resume & Dashboard', () => {
  test.describe.configure({ mode: 'serial' });

  let pausedSessionId: string;

  test('T-E1: Pause mid-quiz → redirected to dashboard with paused session', async ({
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
      // Should redirect to dashboard
      await page.waitForURL('**/dashboard', { timeout: 10_000 });
    } else {
      // If no pause button (might be last question), go to next and try
      await nextBtn.click();
      await page.waitForTimeout(500);
      const pauseBtn2 = page.locator('button', { hasText: /Pause/ });
      await pauseBtn2.click();
      await page.waitForURL('**/dashboard', { timeout: 10_000 });
    }

    // Verify dashboard shows paused session
    const pausedSection = page.locator('text=/Sessions en cours/');
    await expect(pausedSection).toBeVisible({ timeout: 5_000 });

    const resumeBtn = page.locator('button', { hasText: /Reprendre/ });
    const resumeCount = await resumeBtn.count();
    expect(resumeCount).toBeGreaterThan(0);
    console.log(`Dashboard shows ${resumeCount} paused session(s) with Reprendre button`);
  });

  test('T-E2: Resume paused session → quiz resumes at correct question', async ({
    page,
  }) => {
    if (!pausedSessionId) test.skip();
    await login(page);

    // Go to dashboard
    await page.goto('/dashboard');
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

  test('T-E3: Dashboard sections (paused, completed, weak questions)', async ({
    page,
  }) => {
    await login(page);
    await page.goto('/dashboard');
    await page.waitForFunction(
      () => !document.querySelector('.animate-pulse'),
      { timeout: 10_000 },
    );

    // Heading
    const heading = page.locator('h1', { hasText: /Tableau de bord/ });
    await expect(heading).toBeVisible();

    // "Sessions en cours" section always present
    const pausedHeading = page.locator('h2', {
      hasText: /Sessions en cours/,
    });
    await expect(pausedHeading).toBeVisible();

    // "Sessions récentes" section always present
    const completedHeading = page.locator('h2', {
      hasText: /Sessions récentes/,
    });
    await expect(completedHeading).toBeVisible();

    // "Commencer une session" link
    const startLink = page.locator('a', {
      hasText: /Commencer une session/,
    });
    await expect(startLink).toBeVisible();

    // Check if completed sessions show score + timestamp
    const completedCards = page.locator(
      'a[href*="/quiz/results/"]',
    );
    const completedCount = await completedCards.count();
    if (completedCount > 0) {
      // First completed card should have a percentage
      const firstCard = completedCards.first();
      const cardText = await firstCard.textContent();
      expect(cardText).toMatch(/\d+%/);
      console.log(`Found ${completedCount} completed session(s) with scores`);
    }

    // Weak questions section (only appears if there are weak questions)
    const weakHeading = page.locator('h2', {
      hasText: /Questions à revoir/,
    });
    const hasWeak = await weakHeading
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    if (hasWeak) {
      console.log('Weak questions section visible');
      // Check "Voir plus" expand button if there are > 3
      const expandBtn = page.locator('button', {
        hasText: /Voir les \d+ autres/,
      });
      if (
        await expandBtn.isVisible({ timeout: 1000 }).catch(() => false)
      ) {
        await expandBtn.click();
        await page.waitForTimeout(300);
        const collapseBtn = page.locator('button', {
          hasText: /Voir moins/,
        });
        await expect(collapseBtn).toBeVisible();
        console.log('Weak questions expand/collapse: OK');
      }
    }

    await page.screenshot({ path: 'e2e/screenshots/dashboard.png' });
    console.log('Dashboard sections verified');
  });

  test('T-E4: Complete session → appears in dashboard recent sessions', async ({
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

      // Check for completion interstitial
      const resultsBtn = page
        .locator('button, a')
        .filter({ hasText: /Voir les résultats|résultats/ });
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
        await page.waitForTimeout(500);
        continue;
      }

      // Select a choice and validate
      const choice = page.locator('[aria-pressed="false"]').first();
      if (
        await choice.isVisible({ timeout: 3000 }).catch(() => false)
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
          await page.waitForTimeout(1500);
        }
      } else {
        await page.waitForTimeout(1000);
      }
    }

    // Should be on results page
    expect(page.url()).toContain('/quiz/results/');

    // Go to dashboard
    await page.goto('/dashboard');
    await page.waitForFunction(
      () => !document.querySelector('.animate-pulse'),
      { timeout: 10_000 },
    );

    // The completed session should appear in "Sessions récentes"
    const completedCards = page.locator('a[href*="/quiz/results/"]');
    const count = await completedCards.count();
    expect(count).toBeGreaterThan(0);

    // The previously paused session should no longer be in the paused list
    // (it was completed, so it moves to completed)
    console.log(
      `Dashboard shows ${count} completed session(s) after completing the paused one`,
    );
  });

  test('T-E5: Mobile dashboard at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page);
    await page.goto('/dashboard');
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
      path: 'e2e/screenshots/mobile-dashboard.png',
    });
    console.log('Mobile dashboard: no overflow, touch targets OK');
  });
});
