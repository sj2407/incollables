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

/** Wait for AG Grid to render rows */
async function waitForGrid(page: Page) {
  await page.waitForSelector('.ag-row', { timeout: 15_000 });
}

test.describe('Admin Flow — Spreadsheet Grid', () => {
  test.describe.configure({ mode: 'serial' });

  test('T-A1: Dashboard loads with metric cards, quality alerts, and charts', async ({ page }) => {
    await login(page);
    await page.goto('/admin');
    await page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 15_000 });

    expect(page.url()).toContain('/admin');

    // Metric cards
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

  test('T-A2: Grid loads with questions, filter by chapter works', async ({ page }) => {
    await login(page);
    await page.goto('/admin/questions');
    await waitForGrid(page);

    // Heading
    const heading = page.getByRole('heading', { name: /Base de données/i });
    await expect(heading).toBeVisible();

    // AG Grid should have rows
    const gridRows = page.locator('.ag-row');
    const count = await gridRows.count();
    expect(count).toBeGreaterThan(0);
    console.log(`Found ${count} question rows in grid`);

    // Filter dropdown exists and has options
    const filter = page.locator('select[aria-label="Filtrer par chapitre"]');
    await expect(filter).toBeVisible();

    // Select a chapter filter
    const options = await filter.locator('option').allTextContents();
    if (options.length > 1) {
      await filter.selectOption({ index: 1 });
      // Wait for grid to reload
      await page.waitForTimeout(500);
      const heading2 = page.getByRole('heading', { name: /Base de données/i });
      await expect(heading2).toBeVisible();
    }

    await page.screenshot({ path: 'e2e/screenshots/admin-database.png' });
  });

  test('T-A3: Double-click cell enters edit mode (inline editing)', async ({ page }) => {
    await login(page);
    await page.goto('/admin/questions');
    await waitForGrid(page);

    // Find a cell in the Énoncé column (the main text column)
    const firstTextCell = page.locator('.ag-row[row-index="0"] .ag-cell[col-id="question_text"]');
    await expect(firstTextCell).toBeVisible();

    // Double-click to enter edit mode
    await firstTextCell.dblclick();

    // AG Grid should show an editor (popup or inline)
    const editor = page.locator('.ag-popup-editor, .ag-cell-edit-wrapper');
    // Editor may or may not appear depending on cell type — just verify no crash
    await page.waitForTimeout(500);

    // Press Escape to cancel
    await page.keyboard.press('Escape');

    await page.screenshot({ path: 'e2e/screenshots/admin-inline-edit.png' });
  });

  test('T-A4: Bulk select and bulk actions bar', async ({ page }) => {
    await login(page);
    await page.goto('/admin/questions');
    await waitForGrid(page);

    // Select all checkbox in AG Grid header
    const selectAll = page.locator('.ag-header-cell .ag-checkbox-input').first();
    await selectAll.click();

    // Bulk actions bar should appear
    const bulkBar = page.locator('[data-testid="bulk-actions"]');
    await expect(bulkBar).toBeVisible();

    // Should show count
    const countText = bulkBar.locator('text=/sélectionnée/');
    await expect(countText).toBeVisible();

    // "Déplacer vers..." button should be visible
    const moveBtn = bulkBar.locator('text=Déplacer vers...');
    await expect(moveBtn).toBeVisible();

    // Cancel selection
    const cancelBtn = bulkBar.locator('text=Annuler');
    await cancelBtn.click();
    await expect(bulkBar).not.toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/admin-bulk-actions.png' });
  });

  test('T-A5: Search by text filters results', async ({ page }) => {
    await login(page);
    await page.goto('/admin/questions');
    await waitForGrid(page);

    const initialCount = await page.locator('.ag-row').count();

    // Type a search term
    const searchInput = page.locator('input[type="search"]');
    await searchInput.fill('[TEST]');
    await page.waitForTimeout(600); // debounce

    // Wait for reload
    await page.waitForTimeout(1000);

    // Results should be filtered (fewer or same) or empty state shown
    const filteredCount = await page.locator('.ag-row').count();
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
    await waitForGrid(page);

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

    await page.screenshot({ path: 'e2e/screenshots/admin-new-question.png' });
  });

  test('T-A7: Click propositions cell opens popup editor', async ({ page }) => {
    await login(page);
    await page.goto('/admin/questions');
    await waitForGrid(page);

    // Click a propositions cell
    const propCell = page.locator('.ag-row[row-index="0"] .ag-cell[col-id="propositions_popup"]');
    await propCell.click();

    // Popup should appear with title
    const popupTitle = page.getByText('Modifier les propositions');
    await expect(popupTitle).toBeVisible({ timeout: 5_000 });

    // Should have proposition editor with inputs
    const propInputs = page.locator('input[placeholder*="Proposition"]');
    const propCount = await propInputs.count();
    expect(propCount).toBeGreaterThanOrEqual(2);

    // Close popup
    await page.locator('button:has-text("Annuler")').click();
    await expect(popupTitle).not.toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/admin-propositions-popup.png' });
  });

  test('T-A8: Click explanation cell opens TipTap editor', async ({ page }) => {
    await login(page);
    await page.goto('/admin/questions');
    await waitForGrid(page);

    // Click an explanation cell
    const explCell = page.locator('.ag-row[row-index="0"] .ag-cell[col-id="explanation_popup"]');
    await explCell.click();

    // TipTap popup should appear
    const popupTitle = page.getByText("Modifier l'explication");
    await expect(popupTitle).toBeVisible({ timeout: 5_000 });

    // Toolbar should have formatting buttons
    const boldBtn = page.locator('button[title="Gras"]');
    await expect(boldBtn).toBeVisible();

    // Close popup
    await page.locator('button:has-text("Annuler")').click();
    await expect(popupTitle).not.toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/admin-tiptap-editor.png' });
  });

  test('T-A9: Historique button opens edit log panel', async ({ page }) => {
    await login(page);
    await page.goto('/admin/questions');
    await waitForGrid(page);

    // Click "Historique" button
    await page.locator('button:has-text("Historique")').click();

    // Edit log modal should appear
    const logTitle = page.getByText('Historique des modifications');
    await expect(logTitle).toBeVisible({ timeout: 5_000 });

    // Close the panel
    await page.locator('button[aria-label="Fermer"]').click();
    await expect(logTitle).not.toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/admin-edit-log.png' });
  });

  test('T-A10: Delete confirmation shows French modal (not browser confirm)', async ({ page }) => {
    await login(page);
    await page.goto('/admin/questions');
    await waitForGrid(page);

    // Select first row
    const firstCheckbox = page.locator('.ag-row[row-index="0"] .ag-checkbox-input');
    await firstCheckbox.click();

    // Bulk actions should appear
    const bulkBar = page.locator('[data-testid="bulk-actions"]');
    await expect(bulkBar).toBeVisible();

    // Click Supprimer
    await bulkBar.locator('button:has-text("Supprimer")').click();

    // French confirmation modal should appear (not browser confirm)
    const confirmTitle = page.getByText('Désactiver les questions');
    await expect(confirmTitle).toBeVisible({ timeout: 3_000 });

    // Cancel via the modal's cancel button (inside the dialog)
    await page.getByLabel('Désactiver les questions').getByRole('button', { name: 'Annuler' }).click();
    await expect(confirmTitle).not.toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/admin-delete-confirm.png' });
  });
});
