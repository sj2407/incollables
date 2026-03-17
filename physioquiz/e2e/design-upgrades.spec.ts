import { test, expect } from '@playwright/test';

// ─── Shared helpers ───
async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'teste2e@gmail.com');
  await page.fill('input[type="password"]', 'TestPass123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/practice');
  await page.waitForTimeout(1000);
}

async function startQuiz(page: import('@playwright/test').Page) {
  await page.goto('/practice');
  await page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 10000 });

  // Find topic ID from first enabled link
  const topicLink = page.locator('a[href*="/quiz/setup/"]:not(.pointer-events-none)').first();
  const href = await topicLink.getAttribute('href');
  const topicId = href!.split('/quiz/setup/')[1];

  // Navigate directly to setup page
  await page.goto(`/quiz/setup/${topicId}`);
  await page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 10000 });

  // Select 10 questions if available
  const tenBtn = page.locator('button').filter({ hasText: '10' }).first();
  if (await tenBtn.isVisible()) await tenBtn.click();
  await page.waitForTimeout(1000);

  // Start quiz
  const startBtn = page.locator('button').filter({ hasText: /démarrer/i });
  await startBtn.click();
  await page.waitForSelector('button[aria-pressed]', { timeout: 10000 });
  await page.waitForTimeout(1000);
}

// ═══════════════════════════════════════
// Feature 1: Cross-out choices
// ═══════════════════════════════════════

test.describe('Cross-out choices', () => {
  test('cross-out X buttons appear on quiz choices before validation', async ({ page }) => {
    await login(page);
    await startQuiz(page);

    // Verify cross-out X buttons exist on choices
    const crossOutButtons = page.locator('button[aria-label*="Éliminer la proposition"]');
    await expect(crossOutButtons.first()).toBeVisible({ timeout: 3000 });
    expect(await crossOutButtons.count()).toBeGreaterThan(0);
  });

  test('clicking X greys out choice, clicking again restores it', async ({ page }) => {
    await login(page);
    await startQuiz(page);

    // Click the first cross-out X button
    await page.locator('button[aria-label*="Éliminer la proposition"]').first().click();
    await page.waitForTimeout(1000);

    // The first choice row should now have opacity-40 on the choice button
    const firstRow = page.locator('[aria-label="Propositions"] > div').first();
    const choiceBtn = firstRow.locator('button[aria-pressed]');
    await expect(choiceBtn).toHaveClass(/opacity-40/);

    // The X label should now say "Restaurer"
    await expect(firstRow.locator('button[aria-label*="Restaurer"]')).toBeVisible();

    // Click again to restore
    await firstRow.locator('button[aria-label*="Restaurer"]').click();
    await page.waitForTimeout(1000);

    // Opacity should be removed
    await expect(choiceBtn).not.toHaveClass(/opacity-40/);

    // Label should be back to "Éliminer"
    await expect(firstRow.locator('button[aria-label*="Éliminer"]')).toBeVisible();
  });

  test('cross-out state does not affect answer selection', async ({ page }) => {
    await login(page);
    await startQuiz(page);

    // Cross out the first choice
    await page.locator('button[aria-label*="Éliminer la proposition"]').first().click();
    await page.waitForTimeout(1000);

    // Now select (click) the crossed-out choice — it should still be selectable
    const firstRow = page.locator('[aria-label="Propositions"] > div').first();
    const choiceBtn = firstRow.locator('button[aria-pressed]');
    await choiceBtn.click();
    await page.waitForTimeout(500);

    // Should be both crossed out AND selected
    await expect(choiceBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(choiceBtn).toHaveClass(/opacity-40/);
  });

  test('cross-out buttons disappear after validation', async ({ page }) => {
    await login(page);
    await startQuiz(page);

    // Select the first answer choice (the main button, not the X)
    const firstRow = page.locator('[aria-label="Propositions"] > div').first();
    await firstRow.locator('button[aria-pressed]').click();
    await page.waitForTimeout(500);

    // Validate — button should now be enabled
    const validateBtn = page.locator('button').filter({ hasText: /valider/i });
    await expect(validateBtn).toBeEnabled({ timeout: 3000 });
    await validateBtn.click();
    await page.waitForTimeout(2000);

    // Cross-out buttons should be gone after validation
    const crossOutButtons = page.locator('button[aria-label*="Éliminer la proposition"]');
    await expect(crossOutButtons).toHaveCount(0);
  });
});

// ═══════════════════════════════════════
// Feature 2: Stats → Action CTAs
// ═══════════════════════════════════════

test.describe('Stats action CTAs', () => {
  test('heatmap detail panel shows "Réviser ce chapitre" link', async ({ page }) => {
    await login(page);
    await page.goto('/stats');
    await page.waitForTimeout(2500);

    // Click on a heatmap cell (treemap or card)
    const heatmapCell = page.locator('[data-testid="heatmap-cell"], .recharts-treemap-depth-1 rect, [class*="heatmap"] button').first();

    if (await heatmapCell.isVisible({ timeout: 3000 }).catch(() => false)) {
      await heatmapCell.click();
      await page.waitForTimeout(1000);

      // Look for the "Réviser ce chapitre" link
      const reviserLink = page.locator('a').filter({ hasText: 'Réviser ce chapitre' });
      await expect(reviserLink).toBeVisible({ timeout: 3000 });

      // Verify it links to quiz/setup
      const href = await reviserLink.getAttribute('href');
      expect(href).toContain('/quiz/setup/');
    }
  });

  test('weak questions show topic as clickable link to quiz setup', async ({ page }) => {
    await login(page);
    await page.goto('/stats');
    await page.waitForTimeout(2500);

    // Find "Questions à revoir" section
    const weakSection = page.locator('text=Questions à revoir');

    if (await weakSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Find topic links inside weak question cards
      const topicLinks = page.locator('section').filter({ hasText: 'Questions à revoir' }).locator('a[href*="/quiz/setup/"]');

      if (await topicLinks.count() > 0) {
        const href = await topicLinks.first().getAttribute('href');
        expect(href).toContain('/quiz/setup/');

        // Verify the link text matches a topic name (not empty)
        const text = await topicLinks.first().textContent();
        expect(text?.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

// ═══════════════════════════════════════
// Feature 3: Activity Calendar
// ═══════════════════════════════════════

test.describe('Activity Calendar', () => {
  test('progression section shows Courbe/Activité tab toggle', async ({ page }) => {
    await login(page);
    await page.goto('/stats');
    await page.waitForTimeout(2500);

    // Find the tab buttons
    const courbeTab = page.locator('button').filter({ hasText: 'Courbe' });
    const activiteTab = page.locator('button').filter({ hasText: 'Activité' });

    await expect(courbeTab).toBeVisible();
    await expect(activiteTab).toBeVisible();

    // Courbe should be active by default (has bg-primary)
    await expect(courbeTab).toHaveClass(/bg-primary/);
    await expect(activiteTab).not.toHaveClass(/bg-primary/);
  });

  test('clicking Activité tab shows calendar grid, clicking Courbe restores chart', async ({ page }) => {
    await login(page);
    await page.goto('/stats');
    await page.waitForTimeout(2500);

    // The progression section should contain a chart
    const progressionSection = page.locator('section').filter({ has: page.locator('#scores-heading') });
    const chartInSection = progressionSection.locator('.recharts-wrapper').first();
    await expect(chartInSection).toBeVisible({ timeout: 3000 });

    // Switch to calendar
    const activiteTab = page.locator('button').filter({ hasText: 'Activité' });
    await activiteTab.click();
    await page.waitForTimeout(500);

    // Calendar should be visible (has data-calendar attribute)
    const calendar = page.locator('[data-calendar]');
    await expect(calendar).toBeVisible();

    // Chart in progression section should be gone
    await expect(progressionSection.locator('.recharts-wrapper')).toHaveCount(0);

    // Legend should show mastery scale labels
    const calendarLegend = page.locator('[data-calendar]');
    await expect(calendarLegend.locator('text=Score :')).toBeVisible();
    await expect(calendarLegend.locator('text=Pas d\'activité')).toBeVisible();

    // Switch back to chart
    const courbeTab = page.locator('button').filter({ hasText: 'Courbe' });
    await courbeTab.click();
    await page.waitForTimeout(500);

    // Chart should be back
    await expect(chartInSection).toBeVisible();

    // Calendar should be gone
    await expect(calendar).not.toBeVisible();
  });

  test('activity calendar does not affect other stats sections', async ({ page }) => {
    await login(page);
    await page.goto('/stats');
    await page.waitForTimeout(2500);

    // Check that metrics section exists
    const metricsSection = page.locator('text=SCORE HEBDO');
    await expect(metricsSection).toBeVisible({ timeout: 5000 });

    // Switch to activity calendar
    const activiteTab = page.locator('button').filter({ hasText: 'Activité' });
    await activiteTab.click();
    await page.waitForTimeout(500);

    // Metrics section should still be there
    await expect(metricsSection).toBeVisible();

    // Heatmap section should still be there (if it exists)
    const heatmapSection = page.locator('text=Carte des connaissances');
    if (await heatmapSection.isVisible().catch(() => false)) {
      await expect(heatmapSection).toBeVisible();
    }
  });
});
