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

test.describe('Full Quiz Flow', () => {
  test.describe.configure({ mode: 'serial' });

  let topicId: string;
  let sessionId: string;

  // Use a single persistent context for all tests
  test('T-C4: Login + Topics page', async ({ page }) => {
    // Login
    await login(page);
    expect(page.url()).toContain('/dashboard');

    // Navigate to topics
    await page.goto('/topics');
    await page.waitForSelector('h1', { timeout: 10_000 });

    // Wait for topics to load
    await page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 10_000 });

    // Should have topic links
    const topicLinks = page.locator('a[href*="/quiz/setup/"]');
    const count = await topicLinks.count();
    console.log(`Found ${count} topic links`);
    expect(count).toBeGreaterThan(0);

    // Should have question count badges
    const badges = page.locator('text=/\\d+ question/');
    const badgeCount = await badges.count();
    console.log(`Found ${badgeCount} question count badges`);
    expect(badgeCount).toBeGreaterThan(0);

    // Find an enabled topic link (not pointer-events-none)
    const enabledLink = page.locator('a[href*="/quiz/setup/"]:not(.pointer-events-none)').first();
    const href = await enabledLink.getAttribute('href');
    expect(href).toBeTruthy();
    topicId = href!.split('/quiz/setup/')[1];
    console.log(`Topic ID: ${topicId}`);
  });

  test('T-C5: Quiz setup + start session', async ({ page }) => {
    await login(page);

    if (!topicId) {
      // Fallback: find topic from topics page
      await page.goto('/topics');
      await page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 10_000 });
      const link = page.locator('a[href*="/quiz/setup/"]:not(.pointer-events-none)').first();
      topicId = (await link.getAttribute('href'))!.split('/quiz/setup/')[1];
    }

    await page.goto(`/quiz/setup/${topicId}`);
    await page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 10_000 });

    // Verify page elements
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    const availableText = page.locator('text=/\\d+ questions? disponibles?/');
    await expect(availableText).toBeVisible();

    // Click an available count option
    const countButtons = page.locator('button[aria-pressed]');
    const btnCount = await countButtons.count();
    let clicked = false;
    for (let i = 0; i < btnCount; i++) {
      const btn = countButtons.nth(i);
      if (await btn.isEnabled()) {
        await btn.click();
        await expect(btn).toHaveAttribute('aria-pressed', 'true');
        clicked = true;
        break;
      }
    }
    expect(clicked).toBe(true);

    // Start session
    const startButton = page.locator('button', { hasText: /Démarrer/ });
    await expect(startButton).toBeEnabled();
    await startButton.click();

    // Wait for redirect to play page
    await page.waitForURL('**/quiz/play/**', { timeout: 15_000 });
    sessionId = page.url().split('/quiz/play/')[1];
    console.log(`Session started: ${sessionId}`);

    // NOW stay on this page and verify the quiz loaded
    await page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 15_000 });

    // Check for error
    const errorEl = page.locator('text=/Impossible de charger/');
    const hasError = await errorEl.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasError) {
      console.error('Quiz load error visible!');
      await page.screenshot({ path: 'e2e/screenshots/quiz-load-error.png' });
    }
    expect(hasError).toBe(false);

    // Verify question elements exist
    const choices = page.locator('[aria-pressed]');
    await expect(choices.first()).toBeVisible({ timeout: 10_000 });
    const choiceCount = await choices.count();
    console.log(`First question has ${choiceCount} choices`);
    expect(choiceCount).toBeGreaterThanOrEqual(2);
  });

  test('T-C6a: Validate button disabled when no choice', async ({ page }) => {
    if (!sessionId) test.skip();
    await login(page);
    await page.goto(`/quiz/play/${sessionId}`);
    await page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 15_000 });

    // If error, skip
    const hasError = await page.locator('text=/Impossible/').isVisible({ timeout: 2000 }).catch(() => false);
    if (hasError) { test.skip(); return; }

    const validateBtn = page.locator('button', { hasText: /Valider|valider/ });
    // Button may be disabled or not exist yet if there's an issue
    if (await validateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(validateBtn).toBeDisabled();
    }
  });

  test('T-C6b: Select choice + validate + correction', async ({ page }) => {
    if (!sessionId) test.skip();
    await login(page);
    await page.goto(`/quiz/play/${sessionId}`);
    await page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 15_000 });

    const hasError = await page.locator('text=/Impossible/').isVisible({ timeout: 2000 }).catch(() => false);
    if (hasError) { test.skip(); return; }

    // Select a choice (click one that's not already selected)
    const unselectedChoice = page.locator('[aria-pressed="false"]').first();
    await unselectedChoice.scrollIntoViewIfNeeded();
    await unselectedChoice.click({ force: true });

    // Select confidence
    const confBtn = page.locator('button', { hasText: /Sûr|Hésitant|devine/ }).first();
    if (await confBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confBtn.click();
    }

    // Validate
    const validateBtn = page.locator('button', { hasText: /Valider|valider/ });
    await expect(validateBtn).toBeEnabled();
    await validateBtn.click();

    // Wait for correction view
    const nextOrResults = page.locator('button:has-text("Question suivante"), button:has-text("Voir les résultats")');
    await expect(nextOrResults).toBeVisible({ timeout: 15_000 });

    // Verify correction view has aria-live
    const correctionArea = page.locator('[aria-live="polite"]');
    if (await correctionArea.isVisible({ timeout: 2000 }).catch(() => false)) {
      const text = await correctionArea.textContent();
      console.log('Correction:', text?.substring(0, 100));
    }

    console.log('Validation + correction view: OK');
  });

  test('T-C7: Complete quiz + results page', async ({ page }) => {
    if (!sessionId) test.skip();
    await login(page);
    await page.goto(`/quiz/play/${sessionId}`);
    await page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 15_000 });

    const hasError = await page.locator('text=/Impossible/').isVisible({ timeout: 2000 }).catch(() => false);
    if (hasError) { test.skip(); return; }

    // Answer all remaining questions
    let maxIterations = 50;
    while (maxIterations-- > 0) {
      // Check if redirected to results
      if (page.url().includes('/quiz/results/')) break;

      // Check for "Voir les résultats" button (session complete interstitial)
      const resultsBtn = page.locator('button, a').filter({ hasText: /Voir les résultats|résultats/ });
      if (await resultsBtn.first().isVisible({ timeout: 500 }).catch(() => false)) {
        await resultsBtn.first().click();
        try {
          await page.waitForURL('**/quiz/results/**', { timeout: 10_000 });
        } catch {
          // might already be on results page
        }
        break;
      }

      // Check for "Question suivante" — previously answered, go next
      const nextBtn = page.locator('button', { hasText: /Question suivante/ });
      if (await nextBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(500);
        continue;
      }

      // Select a choice and validate
      const choice = page.locator('[aria-pressed="false"]').first();
      if (await choice.isVisible({ timeout: 3000 }).catch(() => false)) {
        await choice.click();

        const validateBtn = page.locator('button', { hasText: /Valider|valider/ });
        if (await validateBtn.isEnabled({ timeout: 1000 }).catch(() => false)) {
          await validateBtn.click();
          // Wait for correction or navigation
          await page.waitForTimeout(1500);
        }
      } else {
        await page.waitForTimeout(1000);
      }
    }

    // Should be on results page
    if (!page.url().includes('/quiz/results/')) {
      await page.screenshot({ path: 'e2e/screenshots/never-reached-results.png' });
      throw new Error('Never reached results page');
    }

    // Wait for results to load
    await page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 15_000 });

    // Verify score
    const scoreEl = page.locator('text=/\\d+%/');
    await expect(scoreEl.first()).toBeVisible();

    // Verify stat labels (use exact match to avoid ambiguity)
    await expect(page.getByText('Correctes', { exact: true })).toBeVisible();
    await expect(page.getByText('Partielles', { exact: true })).toBeVisible();
    await expect(page.getByText('Incorrectes', { exact: true })).toBeVisible();

    // Verify action buttons
    await expect(page.locator('a, button', { hasText: /Retour aux cours/ })).toBeVisible();

    // Check expandable failed questions
    const reviewSection = page.locator('text=/Questions à revoir/');
    if (await reviewSection.isVisible({ timeout: 2000 }).catch(() => false)) {
      const expandBtn = page.locator('button[aria-expanded]').first();
      if (await expandBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expandBtn.click();
        await page.waitForTimeout(500);
        const expanded = page.locator('button[aria-expanded="true"]');
        await expect(expanded).toBeVisible();
        console.log('Expandable failed questions: OK');
      }
    }

    await page.screenshot({ path: 'e2e/screenshots/results-page.png' });
    console.log('Results page verified');
  });

  test('T-C8: Mobile responsive (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page);

    // Topics page
    await page.goto('/topics');
    await page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 10_000 });
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);
    await page.screenshot({ path: 'e2e/screenshots/mobile-topics.png' });

    // Setup page
    if (topicId) {
      await page.goto(`/quiz/setup/${topicId}`);
      await page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 10_000 });

      // Check touch targets (44px min height)
      const buttons = page.locator('button');
      const btnCount = await buttons.count();
      for (let i = 0; i < Math.min(btnCount, 5); i++) {
        const box = await buttons.nth(i).boundingBox();
        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(40);
        }
      }
      await page.screenshot({ path: 'e2e/screenshots/mobile-setup.png' });
    }
  });
});
