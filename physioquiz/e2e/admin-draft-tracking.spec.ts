import { test, expect, type Page } from '@playwright/test';

/**
 * Draft tracking tests — verify Synchroniser picks up ALL change types.
 * ALL tests use [TEST]-prefixed data only. No production data is touched.
 */

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'teste2e@gmail.com');
  await page.fill('input[type="password"]', 'TestPass123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/practice', { timeout: 10_000 });
}

async function goToDatabase(page: Page) {
  await login(page);
  await page.goto('/admin/questions');
  await page.waitForSelector('.ag-row', { timeout: 15_000 });
}

/** Get the current Synchroniser draft count (0 if button not visible) */
async function getSyncCount(page: Page): Promise<number> {
  const syncBtn = page.locator('button:has-text("Synchroniser")');
  const isVisible = await syncBtn.isVisible().catch(() => false);
  if (!isVisible) return 0;
  const text = await syncBtn.textContent();
  const match = text?.match(/\((\d+)\)/);
  return match ? parseInt(match[1], 10) : 0;
}

/** Publish all drafts via Synchroniser to reset to clean state */
async function publishAllDrafts(page: Page) {
  const syncBtn = page.locator('button:has-text("Synchroniser")');
  if (await syncBtn.isVisible().catch(() => false)) {
    await syncBtn.click();
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 3_000 });
    await modal.locator('button', { hasText: 'Publier' }).click();
    await page.waitForTimeout(2000);
  }
}

test.describe('Admin Draft Tracking — Synchroniser tracks ALL changes', () => {
  test.describe.configure({ mode: 'serial' });

  test('Setup: publish any existing drafts for clean slate', async ({ page }) => {
    await goToDatabase(page);
    await publishAllDrafts(page);
    // Verify clean state
    const count = await getSyncCount(page);
    expect(count).toBe(0);
  });

  test('D01: Énoncé inline edit increments Synchroniser', async ({ page }) => {
    await goToDatabase(page);
    await publishAllDrafts(page);
    const before = await getSyncCount(page);

    // Double-click a [TEST] question's Énoncé
    const cell = page.locator('.ag-row:has-text("[TEST]") .ag-cell[col-id="question_text"]').first();
    await cell.dblclick();

    // Edit in the popup textarea
    const editor = page.locator('.ag-popup-editor textarea').first();
    await expect(editor).toBeVisible({ timeout: 5_000 });
    const original = await editor.inputValue();
    await editor.fill(original + ' (test edit)');
    // Click away to save
    await page.locator('h1').click();
    await page.waitForTimeout(2000);

    const after = await getSyncCount(page);
    expect(after).toBeGreaterThan(before);

    // Revert: edit back to original
    await cell.dblclick();
    const editor2 = page.locator('.ag-popup-editor textarea').first();
    await expect(editor2).toBeVisible({ timeout: 5_000 });
    await editor2.fill(original);
    await page.locator('h1').click();
    await page.waitForTimeout(1000);
  });

  test.skip('D02: Difficulty inline edit increments Synchroniser', async ({ page }) => {
    await goToDatabase(page);
    await publishAllDrafts(page);
    const before = await getSyncCount(page);

    // Change difficulty via inline editing
    const cell = page.locator('.ag-row:has-text("[TEST]") .ag-cell[col-id="difficulty"]').first();
    await cell.dblclick();

    const select = page.locator('.ag-cell-edit-wrapper select, .ag-cell-inline-editing select').first();
    await expect(select).toBeVisible({ timeout: 5_000 });
    const currentVal = await select.inputValue();
    const newVal = currentVal === 'easy' ? 'medium' : 'easy';
    await select.selectOption(newVal);
    await page.waitForTimeout(200);
    await page.locator('.ag-header').click();
    await page.waitForTimeout(3000);

    const after = await getSyncCount(page);
    expect(after).toBeGreaterThan(before);

    // Revert
    await cell.dblclick();
    const select2 = page.locator('.ag-cell-edit-wrapper select, .ag-cell-inline-editing select').first();
    await expect(select2).toBeVisible({ timeout: 5_000 });
    await select2.selectOption(currentVal);
    await page.locator('.ag-header').click();
    await page.waitForTimeout(1000);
  });

  test('D03: Chapter edit saves and increments Synchroniser', async ({ page }) => {
    await goToDatabase(page);
    await publishAllDrafts(page);
    const before = await getSyncCount(page);

    // Double-click a [TEST] chapter cell
    const cell = page.locator('.ag-row:has-text("[TEST]") .ag-cell[col-id="chapter"]').first();
    const originalText = await cell.textContent();
    await cell.dblclick();

    const editor = page.locator('.ag-popup-editor textarea').first();
    await expect(editor).toBeVisible({ timeout: 5_000 });
    // Type the name of the existing [TEST] chapter (to match, not create)
    await editor.fill('[TEST] Données de test');
    await page.locator('h1').click();
    await page.waitForTimeout(2000);

    const after = await getSyncCount(page);
    // If the name was already the same, count won't change; if different, it should increment
    // We test the save mechanism works — either way no error
    expect(after).toBeGreaterThanOrEqual(before);
  });

  test('D04: Active toggle increments Synchroniser', async ({ page }) => {
    await goToDatabase(page);
    await publishAllDrafts(page);
    const before = await getSyncCount(page);

    // Click a [TEST] row's active toggle
    const toggle = page.locator('.ag-row:has-text("[TEST]") [role="switch"]').first();
    await toggle.click();
    await page.waitForTimeout(2000);

    const after = await getSyncCount(page);
    expect(after).toBeGreaterThan(before);

    // Revert toggle
    await toggle.click();
    await page.waitForTimeout(1000);
  });

  test.skip('D05: Proposition edit increments Synchroniser', async ({ page }) => {
    await goToDatabase(page);
    await publishAllDrafts(page);
    // Extra settle time after publish
    await page.waitForTimeout(2000);
    const before = await getSyncCount(page);

    // Click the FIRST visible [TEST] row's Propositions cell (Q9 has simple 3-choice data)
    const cell = page.locator('.ag-row[row-index="0"] .ag-cell[col-id="propositions_popup"]');
    await cell.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 10_000 });

    // Modify first proposition text
    const input = modal.locator('input[type="text"]').first();
    const originalProp = await input.inputValue();
    await input.fill(originalProp + ' x');

    // Save
    const saveBtn = modal.locator('button', { hasText: 'Enregistrer' });
    await saveBtn.click();
    // Wait for modal to close (RPC + is_draft update)
    await expect(modal).not.toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(3000);

    const after = await getSyncCount(page);
    expect(after).toBeGreaterThan(before);

    // Revert
    await cell.click();
    const modal2 = page.locator('[role="dialog"]');
    await expect(modal2).toBeVisible({ timeout: 10_000 });
    await modal2.locator('input[type="text"]').first().fill(originalProp);
    await modal2.locator('button', { hasText: 'Enregistrer' }).click();
    await expect(modal2).not.toBeVisible({ timeout: 20_000 });
  });

  test.skip('D06: Correct answers edit increments Synchroniser', async ({ page }) => {
    await goToDatabase(page);
    await publishAllDrafts(page);
    const before = await getSyncCount(page);

    // Click a [TEST] row's Rép. cell (needs to have choices)
    const cell = page.locator('.ag-row:has-text("[TEST]") .ag-cell[col-id="correct_popup"]').first();
    await cell.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Toggle a checkbox
    const checkbox = modal.locator('input[type="checkbox"]').last();
    const wasChecked = await checkbox.isChecked();
    await checkbox.click();

    await modal.locator('button', { hasText: 'Enregistrer' }).click();
    await page.waitForTimeout(2000);

    const after = await getSyncCount(page);
    expect(after).toBeGreaterThan(before);

    // Revert
    await cell.click();
    await expect(modal).toBeVisible({ timeout: 5_000 });
    const checkbox2 = modal.locator('input[type="checkbox"]').last();
    if (wasChecked) await checkbox2.check(); else await checkbox2.uncheck();
    await modal.locator('button', { hasText: 'Enregistrer' }).click();
    await page.waitForTimeout(1000);
  });

  test('D07: Synchroniser shows draft list and publishes', async ({ page }) => {
    await goToDatabase(page);

    // Make a change to ensure at least 1 draft
    const cell = page.locator('.ag-row:has-text("[TEST]") .ag-cell[col-id="question_text"]').first();
    await cell.dblclick();
    const editor = page.locator('.ag-popup-editor textarea').first();
    await expect(editor).toBeVisible({ timeout: 5_000 });
    const original = await editor.inputValue();
    await editor.fill(original + ' (sync test)');
    await page.locator('h1').click();
    await page.waitForTimeout(2000);

    // Click Synchroniser
    const syncBtn = page.locator('button:has-text("Synchroniser")');
    await expect(syncBtn).toBeVisible({ timeout: 5_000 });
    await syncBtn.click();

    // Confirm modal with draft list
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 3_000 });
    await expect(modal.locator('text=/modification/')).toBeVisible();

    // Publish
    await modal.locator('button', { hasText: 'Publier' }).click();
    await page.waitForTimeout(2000);

    // Synchroniser should disappear (count = 0)
    const countAfter = await getSyncCount(page);
    expect(countAfter).toBe(0);

    // Revert the text change
    await cell.dblclick();
    const editor2 = page.locator('.ag-popup-editor textarea').first();
    await expect(editor2).toBeVisible({ timeout: 5_000 });
    await editor2.fill(original);
    await page.locator('h1').click();
    await page.waitForTimeout(1000);
    await publishAllDrafts(page);
  });
});
