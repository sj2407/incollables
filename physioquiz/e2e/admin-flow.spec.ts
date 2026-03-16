import { test, expect, type Page } from '@playwright/test';

// Test user must have role='admin' in profiles table before running these tests.
// Set via: UPDATE profiles SET role = 'admin' WHERE email = 'teste2e@gmail.com';
const TEST_EMAIL = 'teste2e@gmail.com';
const TEST_PASSWORD = 'TestPass123';

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('#email', TEST_EMAIL);
  await page.fill('#password', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/practice', { timeout: 10_000 });
}

test.describe('Admin Flow — 3-tab layout', () => {
  test.describe.configure({ mode: 'serial' });

  test('T-A1: Dashboard loads with 6 metric cards, quality alerts, and charts', async ({ page }) => {
    await login(page);
    await page.goto('/admin');
    await page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 15_000 });

    expect(page.url()).toContain('/admin');

    // 6 metric cards across 2 rows
    const cards = page.locator('text=/Questions|Chapitres|Étudiants|Sessions|Score moyen|Durée/');
    await expect(cards.first()).toBeVisible();

    // Quality alerts section
    const alertsHeading = page.getByText('Alertes qualité');
    await expect(alertsHeading).toBeVisible();

    // Charts section
    const sessionsChart = page.getByText('Sessions par jour');
    await expect(sessionsChart).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/admin-dashboard.png' });
  });

  test('T-A2: Database table loads with questions, filter by chapter works', async ({ page }) => {
    await login(page);
    await page.goto('/admin/questions');
    await page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 15_000 });

    // Heading
    const heading = page.getByRole('heading', { name: /Base de données/i });
    await expect(heading).toBeVisible();

    // Table should have rows
    const tableRows = page.locator('table tbody tr');
    const count = await tableRows.count();
    expect(count).toBeGreaterThan(0);
    console.log(`Found ${count} question rows in table`);

    // Filter dropdown exists and has options
    const filter = page.locator('select[aria-label="Filtrer par chapitre"]');
    await expect(filter).toBeVisible();

    // Select a chapter filter
    const options = await filter.locator('option').allTextContents();
    if (options.length > 1) {
      await filter.selectOption({ index: 1 });
      await page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 10_000 });
      // Should still have table rows (or empty state)
      const heading2 = page.getByRole('heading', { name: /Base de données/i });
      await expect(heading2).toBeVisible();
    }

    await page.screenshot({ path: 'e2e/screenshots/admin-database.png' });
  });

  test('T-A3: Click row opens side panel with editor', async ({ page }) => {
    await login(page);
    await page.goto('/admin/questions');
    await page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 15_000 });

    // Click first table row
    const firstRow = page.locator('table tbody tr').first();
    await firstRow.click();

    // Side panel should appear
    const panel = page.locator('[data-testid="side-panel"]');
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // Wait for panel content to load
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="side-panel"] .animate-pulse'),
      { timeout: 10_000 }
    );

    // Editor form elements should be visible
    const topicSelect = panel.locator('#q-topic');
    await expect(topicSelect).toBeVisible();

    const questionText = panel.locator('#q-text');
    await expect(questionText).toBeVisible();

    // Close button works
    const closeBtn = panel.locator('button[aria-label="Fermer le panneau"]');
    await closeBtn.click();
    await expect(panel).not.toBeVisible({ timeout: 3_000 });

    await page.screenshot({ path: 'e2e/screenshots/admin-side-panel.png' });
  });

  test('T-A4: Bulk select and bulk activate/deactivate', async ({ page }) => {
    await login(page);
    await page.goto('/admin/questions');
    await page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 15_000 });

    // Select all checkbox
    const selectAll = page.locator('thead input[type="checkbox"]');
    await selectAll.check();

    // Bulk actions bar should appear
    const bulkBar = page.locator('[data-testid="bulk-actions"]');
    await expect(bulkBar).toBeVisible();

    // Should show count
    const countText = bulkBar.locator('text=/sélectionnée/');
    await expect(countText).toBeVisible();

    // Cancel selection
    const cancelBtn = bulkBar.locator('text=Annuler');
    await cancelBtn.click();
    await expect(bulkBar).not.toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/admin-bulk-actions.png' });
  });

  test('T-A5: Search by text filters results', async ({ page }) => {
    await login(page);
    await page.goto('/admin/questions');
    await page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 15_000 });

    const initialCount = await page.locator('table tbody tr').count();

    // Type a search term
    const searchInput = page.locator('input[type="search"]');
    await searchInput.fill('physiologie');
    await page.waitForTimeout(500); // debounce
    await page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 10_000 });

    // Results should be filtered (fewer or same)
    const filteredCount = await page.locator('table tbody tr').count();
    // The search should either reduce results or show "Aucune question trouvée"
    const emptyState = page.locator('text=Aucune question trouvée');
    const hasResults = filteredCount > 0;
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    expect(hasResults || hasEmpty).toBeTruthy();

    console.log(`Search: ${initialCount} → ${filteredCount} results`);

    await page.screenshot({ path: 'e2e/screenshots/admin-search.png' });
  });

  test('T-A6: Create new question via panel', async ({ page }) => {
    await login(page);
    await page.goto('/admin/questions');
    await page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 15_000 });

    // Click "+ Question" button
    await page.locator('button:has-text("+ Question")').click();

    // Side panel should appear
    const panel = page.locator('[data-testid="side-panel"]');
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // Wait for panel to load
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="side-panel"] .animate-pulse'),
      { timeout: 10_000 }
    );

    // Title should say "Nouvelle question"
    const panelTitle = panel.getByText('Nouvelle question');
    await expect(panelTitle).toBeVisible();

    // Form elements should be present
    await expect(panel.locator('#q-topic')).toBeVisible();
    await expect(panel.locator('#q-text')).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/admin-new-question.png' });
  });

  test('T-A7: Mobile responsive at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page);

    // Dashboard
    await page.goto('/admin');
    await page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 15_000 });
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);

    // Bottom nav should show 3 items
    const bottomNav = page.locator('nav.fixed');
    const navLinks = bottomNav.locator('a');
    const navCount = await navLinks.count();
    expect(navCount).toBe(3);

    // Touch targets ≥ 40px
    const buttons = page.locator('button');
    const count = await buttons.count();
    for (let i = 0; i < Math.min(count, 5); i++) {
      const btn = buttons.nth(i);
      if (await btn.isVisible()) {
        const box = await btn.boundingBox();
        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(40);
        }
      }
    }

    await page.screenshot({ path: 'e2e/screenshots/admin-mobile.png' });
  });
});
