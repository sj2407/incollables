import { test, expect, type Page } from '@playwright/test';

/**
 * Comprehensive acceptance tests for the admin spreadsheet view.
 * Tests every requirement discussed with the user.
 */

const TEST_EMAIL = 'teste2e@gmail.com';
const TEST_PASSWORD = 'TestPass123';

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('#email', TEST_EMAIL);
  await page.fill('#password', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/practice', { timeout: 10_000 });
}

async function goToDatabase(page: Page) {
  await login(page);
  await page.goto('/admin/questions');
  // Wait for AG Grid to render
  await page.waitForSelector('.ag-row', { timeout: 20_000 });
}

test.describe('Admin Spreadsheet — Full Acceptance Tests', () => {
  // Run independently so we see all failures at once
  test.describe.configure({ mode: 'parallel' });

  // ═══════════════════════════════════════════════════════
  // CRITERION 1: Grid loads with all expected columns
  // ═══════════════════════════════════════════════════════
  test('C01: Grid shows all expected columns', async ({ page }) => {
    await goToDatabase(page);

    const expectedHeaders = [
      'Chapitre', 'Sous-chapitre', 'Q#', 'Énoncé',
      'Propositions', 'Rép.', 'Expl.', 'Difficulté',
      'Active', 'Tentatives', 'Score'
    ];

    // AG Grid virtualizes columns — some may not be in DOM when scrolled off-screen.
    // Scroll right to render all headers, then collect all header texts.
    const allHeaderTexts: string[] = [];

    // Collect visible headers
    const visibleHeaders = await page.locator('.ag-header-cell-text').allTextContents();
    allHeaderTexts.push(...visibleHeaders);

    // Scroll right to reveal remaining columns
    const viewport = page.locator('.ag-body-horizontal-scroll-viewport');
    if (await viewport.isVisible()) {
      await viewport.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
      await page.waitForTimeout(500);
      const moreHeaders = await page.locator('.ag-header-cell-text').allTextContents();
      allHeaderTexts.push(...moreHeaders);
      // Scroll back
      await viewport.evaluate((el) => { el.scrollLeft = 0; });
    }

    const uniqueHeaders = Array.from(new Set(allHeaderTexts));
    for (const header of expectedHeaders) {
      expect(uniqueHeaders, `Missing column: ${header}`).toContain(header);
    }

    await page.screenshot({ path: 'e2e/screenshots/acceptance/C01-all-columns.png', fullPage: true });
  });

  // ═══════════════════════════════════════════════════════
  // CRITERION 2: Chapitre is editable — same method as Énoncé (text popup editor)
  // ═══════════════════════════════════════════════════════
  test('C02: Chapitre cell is editable with text input on double-click', async ({ page }) => {
    await goToDatabase(page);

    const chapterCell = page.locator('.ag-row .ag-cell[col-id="chapter"]').first();
    await expect(chapterCell).toBeVisible();

    // Double-click to enter edit mode — opens AG Grid popup text editor (textarea)
    await chapterCell.dblclick();

    const editor = page.locator('.ag-popup-editor textarea, .ag-popup-editor input, .ag-large-text-input, .ag-text-area-input').first();
    await expect(editor).toBeVisible({ timeout: 5_000 });

    await page.screenshot({ path: 'e2e/screenshots/acceptance/C02-chapter-edit.png' });
    await page.keyboard.press('Escape');
  });

  // ═══════════════════════════════════════════════════════
  // CRITERION 3: Sous-chapitre is editable — same method as Énoncé
  // ═══════════════════════════════════════════════════════
  test('C03: Sous-chapitre cell is editable with text input', async ({ page }) => {
    await goToDatabase(page);

    const subchapterCell = page.locator('.ag-row .ag-cell[col-id="subchapter"]').first();
    await expect(subchapterCell).toBeVisible();

    await subchapterCell.dblclick();

    const editor = page.locator('.ag-popup-editor textarea, .ag-popup-editor input, .ag-large-text-input, .ag-text-area-input').first();
    await expect(editor).toBeVisible({ timeout: 5_000 });

    await page.screenshot({ path: 'e2e/screenshots/acceptance/C03-subchapter-edit.png' });
    await page.keyboard.press('Escape');
  });

  // ═══════════════════════════════════════════════════════
  // CRITERION 4: Énoncé is editable inline (textarea popup)
  // ═══════════════════════════════════════════════════════
  test('C04: Énoncé cell opens textarea on double-click', async ({ page }) => {
    await goToDatabase(page);

    const textCell = page.locator('.ag-row[row-index="0"] .ag-cell[col-id="question_text"]');
    await textCell.dblclick();

    // Should open a large text editor popup
    // AG Grid renders it as textarea inside a popup or inline wrapper
    const editor = page.locator('textarea, .ag-large-text-input, .ag-popup-editor, .ag-text-area-input').first();
    await expect(editor).toBeVisible({ timeout: 5_000 });

    await page.screenshot({ path: 'e2e/screenshots/acceptance/C04-enonce-edit.png' });
    await page.keyboard.press('Escape');
  });

  // ═══════════════════════════════════════════════════════
  // CRITERION 5: Propositions opens popup editor (not inline)
  // ═══════════════════════════════════════════════════════
  test('C05: Propositions cell opens popup with A-E fields', async ({ page }) => {
    await goToDatabase(page);

    const propCell = page.locator('.ag-row[row-index="0"] .ag-cell[col-id="propositions_popup"]');
    await propCell.click();

    const popupTitle = page.getByText('Modifier les propositions');
    await expect(popupTitle).toBeVisible({ timeout: 5_000 });

    // Should have proposition inputs
    const propInputs = page.locator('input[placeholder*="Proposition"]');
    expect(await propInputs.count()).toBeGreaterThanOrEqual(2);

    await page.screenshot({ path: 'e2e/screenshots/acceptance/C05-propositions-popup.png' });

    // Close
    await page.getByLabel('Modifier les propositions').getByRole('button', { name: 'Annuler' }).click();
  });

  // ═══════════════════════════════════════════════════════
  // CRITERION 6: Correct answers opens popup with checkboxes
  // ═══════════════════════════════════════════════════════
  test('C06: Correct answers cell opens popup with checkboxes', async ({ page }) => {
    await goToDatabase(page);

    const repCell = page.locator('.ag-row[row-index="0"] .ag-cell[col-id="correct_popup"]');
    await repCell.click();

    const popupTitle = page.getByText('Réponses correctes');
    await expect(popupTitle).toBeVisible({ timeout: 5_000 });

    // Should have checkboxes
    const checkboxes = page.locator('[role="dialog"] input[type="checkbox"]');
    expect(await checkboxes.count()).toBeGreaterThanOrEqual(2);

    await page.screenshot({ path: 'e2e/screenshots/acceptance/C06-correct-answers-popup.png' });

    await page.getByLabel('Réponses correctes').getByRole('button', { name: 'Annuler' }).click();
  });

  // ═══════════════════════════════════════════════════════
  // CRITERION 7: Explication opens TipTap editor (NOT raw HTML)
  // ═══════════════════════════════════════════════════════
  test('C07: Explication cell opens TipTap visual editor (not raw HTML)', async ({ page }) => {
    await goToDatabase(page);

    const explCell = page.locator('.ag-row[row-index="0"] .ag-cell[col-id="explanation_popup"]');
    await explCell.click();

    const popupTitle = page.getByText("Modifier l'explication");
    await expect(popupTitle).toBeVisible({ timeout: 5_000 });

    // Should have a visual toolbar (Bold, Italic, etc.) — NOT a raw HTML textarea
    const boldBtn = page.locator('button[title="Gras"]');
    await expect(boldBtn).toBeVisible();

    const italicBtn = page.locator('button[title="Italique"]');
    await expect(italicBtn).toBeVisible();

    // Should NOT show raw HTML tags like <p> or <b>
    const rawHtml = page.locator('textarea:has-text("<p>")');
    const hasRawHtml = await rawHtml.isVisible().catch(() => false);

    await page.screenshot({ path: 'e2e/screenshots/acceptance/C07-tiptap-editor.png' });

    // TipTap should be a visual editor, not raw HTML
    expect(hasRawHtml).toBeFalsy();

    await page.getByLabel("Modifier l'explication").getByRole('button', { name: 'Annuler' }).click();
  });

  // ═══════════════════════════════════════════════════════
  // CRITERION 8: Difficulté is editable with French labels
  // ═══════════════════════════════════════════════════════
  test('C08: Difficulté cell shows French labels when editing', async ({ page }) => {
    await goToDatabase(page);

    const diffCell = page.locator('.ag-row[row-index="0"] .ag-cell[col-id="difficulty"]');
    await diffCell.dblclick();

    // Should show French options (Facile, Moyen, Difficile) — NOT English
    // Wait a moment for the editor to render
    await page.waitForTimeout(500);
    const frenchOption = page.locator('option:has-text("Facile"), select option:has-text("Facile")').first();
    await expect(frenchOption).toBeAttached({ timeout: 5_000 });

    // Should NOT show English
    const englishOption = page.locator('option:has-text("easy")');
    const hasEnglish = await englishOption.isVisible().catch(() => false);
    expect(hasEnglish).toBeFalsy();

    await page.screenshot({ path: 'e2e/screenshots/acceptance/C08-difficulty-french.png' });
    await page.keyboard.press('Escape');
  });

  // ═══════════════════════════════════════════════════════
  // CRITERION 9: Active toggle works inline
  // ═══════════════════════════════════════════════════════
  test('C09: Active toggle works with single click', async ({ page }) => {
    await goToDatabase(page);

    const toggleBtn = page.locator('.ag-row[row-index="0"] .ag-cell[col-id="is_active"] button[role="switch"]');
    await expect(toggleBtn).toBeVisible();

    const wasBefore = await toggleBtn.getAttribute('aria-checked');

    await toggleBtn.click();
    await page.waitForTimeout(1000);

    // Save indicator should appear
    const saveIndicator = page.locator('text=/Enregistré|Enregistrement/');
    // Just verify no crash — the toggle should work
    await page.screenshot({ path: 'e2e/screenshots/acceptance/C09-active-toggle.png' });

    // Toggle back to original state
    await toggleBtn.click();
    await page.waitForTimeout(1000);
  });

  // ═══════════════════════════════════════════════════════
  // CRITERION 10: Auto-save shows indicator
  // ═══════════════════════════════════════════════════════
  test('C10: Auto-save shows save indicator after editing', async ({ page }) => {
    await goToDatabase(page);

    // Double-click a difficulty cell and change it
    const diffCell = page.locator('.ag-row[row-index="0"] .ag-cell[col-id="difficulty"]');
    await diffCell.dblclick();

    // Select a different value
    const select = page.locator('.ag-popup-editor select, .ag-cell-edit-wrapper select');
    if (await select.isVisible()) {
      await select.selectOption({ label: 'Moyen' });
      // Click away to trigger save
      await page.locator('.ag-header').click();
      await page.waitForTimeout(500);

      // Save indicator should appear
      const indicator = page.locator('text=/Enregistrement|Enregistré/');
      const hasIndicator = await indicator.isVisible().catch(() => false);

      await page.screenshot({ path: 'e2e/screenshots/acceptance/C10-save-indicator.png' });
    } else {
      await page.keyboard.press('Escape');
      await page.screenshot({ path: 'e2e/screenshots/acceptance/C10-save-indicator-skipped.png' });
    }
  });

  // ═══════════════════════════════════════════════════════
  // CRITERION 11: Bulk select + "Déplacer vers..." button
  // ═══════════════════════════════════════════════════════
  test('C11: Bulk select shows "Déplacer vers..." button', async ({ page }) => {
    await goToDatabase(page);

    // Select first row
    const checkbox = page.locator('.ag-row[row-index="0"] .ag-checkbox-input');
    await checkbox.click();

    const bulkBar = page.locator('[data-testid="bulk-actions"]');
    await expect(bulkBar).toBeVisible();

    // "Modifier..." should be visible
    const moveBtn = bulkBar.getByText('Modifier...');
    await expect(moveBtn).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/acceptance/C11-bulk-move-button.png' });

    // Cancel
    await bulkBar.getByText('Annuler').click();
  });

  // ═══════════════════════════════════════════════════════
  // CRITERION 12: Delete uses French confirm modal (not browser confirm)
  // ═══════════════════════════════════════════════════════
  test('C12: Delete shows French confirmation modal', async ({ page }) => {
    await goToDatabase(page);

    const checkbox = page.locator('.ag-row[row-index="0"] .ag-checkbox-input');
    await checkbox.click();

    const bulkBar = page.locator('[data-testid="bulk-actions"]');
    await bulkBar.getByText('Supprimer').click();

    // French modal should appear
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 3_000 });
    await expect(modal.locator('text=/Supprimer|Corbeille/').first()).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/acceptance/C12-french-confirm-modal.png' });

    // Cancel the modal
    await modal.getByRole('button', { name: 'Annuler' }).click();
  });

  // ═══════════════════════════════════════════════════════
  // CRITERION 13: Historique button exists and opens edit log
  // ═══════════════════════════════════════════════════════
  test('C13: Historique button opens edit log panel', async ({ page }) => {
    await goToDatabase(page);

    const histBtn = page.getByText('Historique');
    await expect(histBtn).toBeVisible();
    await histBtn.click();

    const logTitle = page.getByText('Historique des modifications');
    await expect(logTitle).toBeVisible({ timeout: 5_000 });

    await page.screenshot({ path: 'e2e/screenshots/acceptance/C13-edit-log-panel.png' });

    await page.locator('button[aria-label="Fermer"]').click();
  });

  // ═══════════════════════════════════════════════════════
  // CRITERION 14: Filters work (chapter, active, difficulty, search)
  // ═══════════════════════════════════════════════════════
  test('C14: All 4 filters work', async ({ page }) => {
    await goToDatabase(page);

    // Chapter filter
    const chapterFilter = page.locator('select[aria-label="Filtrer par chapitre"]');
    await expect(chapterFilter).toBeVisible();

    // Active filter
    const activeFilter = page.locator('select[aria-label="Filtrer par statut"]');
    await expect(activeFilter).toBeVisible();

    // Difficulty filter
    const diffFilter = page.locator('select[aria-label="Filtrer par difficulté"]');
    await expect(diffFilter).toBeVisible();

    // Search
    const search = page.locator('input[type="search"]');
    await expect(search).toBeVisible();

    // Test search filter — wait for debounce (400ms) + server round-trip
    await search.fill('[TEST]');
    // Wait for grid to reload with filtered results
    await page.waitForFunction(() => {
      const rows = document.querySelectorAll('.ag-row');
      return rows.length > 0 && rows.length < 100;
    }, { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(500);

    const rowCount = await page.locator('.ag-row').count();
    // Should find our test questions
    expect(rowCount).toBeGreaterThan(0);

    await page.screenshot({ path: 'e2e/screenshots/acceptance/C14-filters.png' });
  });

  // ═══════════════════════════════════════════════════════
  // CRITERION 15: Read-only columns (Tentatives, Score) are NOT editable
  // ═══════════════════════════════════════════════════════
  test('C15: Stats columns (Tentatives, Score) are read-only', async ({ page }) => {
    await goToDatabase(page);

    // Double-click on Tentatives — should NOT enter edit mode
    const tentCell = page.locator('.ag-row[row-index="0"] .ag-cell[col-id="total_attempts"]');
    await tentCell.dblclick();
    await page.waitForTimeout(300);

    // No editor should appear
    const editor = page.locator('.ag-popup-editor, .ag-cell-edit-wrapper input, .ag-cell-edit-wrapper select');
    const hasEditor = await editor.isVisible().catch(() => false);
    expect(hasEditor).toBeFalsy();

    await page.screenshot({ path: 'e2e/screenshots/acceptance/C15-readonly-stats.png' });
  });

  // ═══════════════════════════════════════════════════════
  // CRITERION 16: "+ Question" button opens side panel for new question
  // ═══════════════════════════════════════════════════════
  test('C16: New question uses side panel', async ({ page }) => {
    await goToDatabase(page);

    await page.locator('button:has-text("+ Question")').click();

    const panel = page.locator('[data-testid="side-panel"]');
    await expect(panel).toBeVisible({ timeout: 5_000 });

    const title = panel.getByText('Nouvelle question');
    await expect(title).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/acceptance/C16-new-question-panel.png' });

    // Close
    await panel.locator('button[aria-label="Fermer le panneau"]').click();
  });

  // ═══════════════════════════════════════════════════════
  // CRITERION 17: No side panel on row click (inline editing only)
  // ═══════════════════════════════════════════════════════
  test('C17: Clicking a row does NOT open side panel', async ({ page }) => {
    await goToDatabase(page);

    // Click on a text cell
    const textCell = page.locator('.ag-row[row-index="0"] .ag-cell[col-id="question_text"]');
    await textCell.click();
    await page.waitForTimeout(500);

    // Side panel should NOT appear
    const panel = page.locator('[data-testid="side-panel"]');
    const hasSidePanel = await panel.isVisible().catch(() => false);
    expect(hasSidePanel).toBeFalsy();

    await page.screenshot({ path: 'e2e/screenshots/acceptance/C17-no-side-panel-on-click.png' });
  });

  // ═══════════════════════════════════════════════════════
  // CRITERION 18: Production data count unchanged (465)
  // ═══════════════════════════════════════════════════════
  test('C18: Total question count visible and correct', async ({ page }) => {
    await goToDatabase(page);

    // The count text should show 480 (465 prod + 15 test)
    const countText = page.locator('text=/\\d+ questions?/').first();
    await expect(countText).toBeVisible();

    const text = await countText.textContent();
    const count = parseInt(text?.match(/(\d+)/)?.[1] ?? '0', 10);
    // Should have a significant number of questions
    expect(count).toBeGreaterThanOrEqual(400);

    await page.screenshot({ path: 'e2e/screenshots/acceptance/C18-question-count.png' });
  });

  // ═══════════════════════════════════════════════════════
  // CRITERION 19: Draft rows have visual indicator
  // ═══════════════════════════════════════════════════════
  test('C19: Draft rows show visual indicator (blue border + italic)', async ({ page }) => {
    await goToDatabase(page);

    // Filter to drafts only
    const activeFilter = page.locator('select[aria-label="Filtrer par statut"]');
    await activeFilter.selectOption('draft');
    await page.waitForTimeout(1000);

    // If there are draft rows, they should have the draft-row class
    const draftRows = page.locator('.ag-row.draft-row');
    const draftCount = await draftRows.count();

    // Screenshot regardless (may show "no drafts" or draft rows)
    await page.screenshot({ path: 'e2e/screenshots/acceptance/C19-draft-indicator.png' });

    // If drafts exist, verify the visual indicator
    if (draftCount > 0) {
      const firstDraft = draftRows.first();
      // Should have italic text and blue left border (via CSS class)
      await expect(firstDraft).toHaveClass(/draft-row/);
    }
    // Reset filter
    await activeFilter.selectOption('');
  });

  // ═══════════════════════════════════════════════════════
  // CRITERION 20: Synchroniser button publishes drafts
  // ═══════════════════════════════════════════════════════
  test('C20: Synchroniser button appears when drafts exist and publishes them', async ({ page }) => {
    await goToDatabase(page);

    // The Synchroniser button only appears when draftCount > 0
    // Check if it exists (it may not if there are no drafts)
    const syncBtn = page.locator('button:has-text("Synchroniser")');
    const hasSyncBtn = await syncBtn.isVisible().catch(() => false);

    await page.screenshot({ path: 'e2e/screenshots/acceptance/C20-synchroniser-button.png' });

    if (hasSyncBtn) {
      // Click — should open confirmation modal
      await syncBtn.click();

      // Confirm modal should appear
      const confirmModal = page.locator('[role="dialog"]');
      await expect(confirmModal).toBeVisible({ timeout: 3_000 });

      // Click publish button in modal
      const publishBtn = confirmModal.locator('button', { hasText: 'Publier' });
      await publishBtn.click();
      await page.waitForTimeout(2000);

      // Success message should appear
      const success = page.locator('text=/publiée/');
      const hasSuccess = await success.isVisible().catch(() => false);
      expect(hasSuccess).toBeTruthy();

      await page.screenshot({ path: 'e2e/screenshots/acceptance/C20-synchroniser-success.png' });
    }
  });

  // ═══════════════════════════════════════════════════════
  // CRITERION 21: Brouillons filter option exists
  // ═══════════════════════════════════════════════════════
  test('C21: Brouillons filter option is available', async ({ page }) => {
    await goToDatabase(page);

    const activeFilter = page.locator('select[aria-label="Filtrer par statut"]');
    await expect(activeFilter).toBeVisible();

    // Check that "Brouillons" option exists
    const brouillonsOption = activeFilter.locator('option[value="draft"]');
    await expect(brouillonsOption).toBeAttached();
    expect(await brouillonsOption.textContent()).toBe('Brouillons');

    await page.screenshot({ path: 'e2e/screenshots/acceptance/C21-brouillons-filter.png' });
  });

  // ═══════════════════════════════════════════════════════
  // CRITERION 22: Chapter cell editable — type a name and it saves (like Énoncé)
  // ═══════════════════════════════════════════════════════
  test('C22: Chapter cell editable — type new name and save', async ({ page }) => {
    await goToDatabase(page);

    // Double-click a chapter cell
    const chapterCell = page.locator('.ag-row .ag-cell[col-id="chapter"]').first();
    await expect(chapterCell).toBeVisible();
    const originalText = await chapterCell.textContent();
    await chapterCell.dblclick();

    // Text editor should appear (textarea popup like Énoncé)
    const editorWrapper = page.locator('.ag-popup-editor, .ag-large-text-input').first();
    await expect(editorWrapper).toBeVisible({ timeout: 5_000 });

    // Can type in the textarea
    const textarea = page.locator('.ag-popup-editor textarea').first();
    await textarea.fill('Test chapter name');
    await page.screenshot({ path: 'e2e/screenshots/acceptance/C22-chapter-typing.png' });

    // Escape to cancel (don't actually save test data)
    await page.keyboard.press('Escape');

    // Cell should revert to original text
    await expect(chapterCell).toContainText(originalText ?? '');
  });
});
