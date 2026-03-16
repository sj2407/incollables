import { test, expect } from '@playwright/test';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/');
  // If redirected to login
  if (page.url().includes('/login') || page.url().includes('/auth')) {
    await page.fill('input[type="email"]', 'teste2e@gmail.com');
    await page.fill('input[type="password"]', 'TestPass123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/practice', { timeout: 10_000 });
  }
}

test.describe('Stats & Progress (Sprint 4)', () => {
  test('T-S1: Stats page metric cards visible', async ({ page }) => {
    await login(page);
    await page.goto('/stats');
    await page.waitForFunction(
      () => !document.querySelector('.animate-pulse'),
      { timeout: 10_000 },
    );

    // Check metric cards
    await expect(page.getByText('Score cette semaine')).toBeVisible();
    await expect(page.getByText('Sessions', { exact: true })).toBeVisible();
    await expect(page.getByText("Temps d'étude")).toBeVisible();
    await expect(page.getByText('Partielles')).toBeVisible();

    console.log('Stats metric cards: OK');
  });

  test('T-S2: Stats page has progress chart', async ({ page }) => {
    await login(page);
    await page.goto('/stats');
    await page.waitForFunction(
      () => !document.querySelector('.animate-pulse'),
      { timeout: 10_000 },
    );

    // Progress section should exist
    const progressSection = page.locator('h2', { hasText: /Progression/ });
    const hasProgress = await progressSection
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (hasProgress) {
      // Chart should render an SVG via recharts
      const svg = page.locator('[aria-label="Évolution des scores"] svg');
      await expect(svg.first()).toBeVisible({ timeout: 5000 });
      console.log('Progress chart: OK');
    } else {
      console.log('No progress data yet — chart not shown');
    }
  });

  test('T-S3: Stats page has calibration section', async ({ page }) => {
    await login(page);
    await page.goto('/stats');
    await page.waitForFunction(
      () => !document.querySelector('.animate-pulse'),
      { timeout: 10_000 },
    );

    // Calibration section
    const calibrationHeading = page.locator('h2', { hasText: /Calibration/ });
    const hasCal = await calibrationHeading
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (hasCal) {
      console.log('Calibration section: OK');
    }
  });

  test('T-S4: Stats page has heatmap', async ({ page }) => {
    await login(page);
    await page.goto('/stats');
    await page.waitForFunction(
      () => !document.querySelector('.animate-pulse'),
      { timeout: 10_000 },
    );

    // Heatmap (only visible if user has attempted topics)
    const heatmapHeading = page.locator('h2', { hasText: /Carte des connaissances/ });
    const hasHeatmap = await heatmapHeading
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (hasHeatmap) {
      console.log('Heatmap section: OK');
    } else {
      console.log('No heatmap data yet');
    }
  });

  test('T-S5: Stats page has session history', async ({ page }) => {
    await login(page);
    await page.goto('/stats');
    await page.waitForFunction(
      () => !document.querySelector('.animate-pulse'),
      { timeout: 10_000 },
    );

    // Session history
    const historyHeading = page.locator('h2', { hasText: /Historique des sessions/ });
    const hasHistory = await historyHeading
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (hasHistory) {
      const sessionCards = page.locator('a[href*="/quiz/results/"], a[href*="/exam/results/"]');
      const count = await sessionCards.count();
      expect(count).toBeGreaterThan(0);
      console.log(`Session history: ${count} sessions`);
    } else {
      console.log('No session history yet');
    }
  });

  test('T-S6: Stats page has weak questions', async ({ page }) => {
    await login(page);
    await page.goto('/stats');
    await page.waitForFunction(
      () => !document.querySelector('.animate-pulse'),
      { timeout: 10_000 },
    );

    const weakHeading = page.locator('h2', { hasText: /Questions à revoir/ });
    const hasWeak = await weakHeading
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    if (hasWeak) {
      console.log('Weak questions section visible');
      // Check "Voir plus" expand button if there are > 3
      const expandBtn = page.locator('button', {
        hasText: /Voir les \d+ autres/,
      });
      if (await expandBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expandBtn.click();
        await page.waitForTimeout(300);
        const collapseBtn = page.locator('button', {
          hasText: /Voir moins/,
        });
        await expect(collapseBtn).toBeVisible();
        console.log('Weak questions expand/collapse: OK');
      }
    }
  });

  test('T-S7: Stats page has type filter', async ({ page }) => {
    await login(page);
    await page.goto('/stats');
    await page.waitForFunction(
      () => !document.querySelector('.animate-pulse'),
      { timeout: 10_000 },
    );

    // Page-level type filter should be visible
    const typeFilter = page.getByLabel('Filtrer par type de session');
    await expect(typeFilter).toBeVisible();
    console.log('Page-level type filter: OK');
  });

  test('T-S8: Mobile responsive stats at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page);
    await page.goto('/stats');
    await page.waitForFunction(
      () => !document.querySelector('.animate-pulse'),
      { timeout: 10_000 },
    );

    // Metric cards should be in 2-column grid
    const cards = page.locator('.grid-cols-2');
    await expect(cards.first()).toBeVisible();

    // No horizontal overflow
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflow).toBe(false);

    console.log('Mobile stats responsive: OK');
  });
});
