import { test, expect } from '@playwright/test';

test('Debug styles', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('input[type="email"]', 'teste2e@gmail.com');
  await page.fill('input[type="password"]', 'TestPass123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/practice');
  await page.waitForTimeout(1000);

  // Check computed styles on "Les Incollables"
  const headerLink = page.locator('header a').first();
  const color = await headerLink.evaluate(el => window.getComputedStyle(el).color);
  const fontFamily = await headerLink.evaluate(el => window.getComputedStyle(el).fontFamily);
  const classList = await headerLink.evaluate(el => el.className);

  console.log('=== HEADER LINK ===');
  console.log('Color:', color);
  console.log('Font:', fontFamily);
  console.log('Classes:', classList);

  // Check if text-primary generates any CSS
  const bodyFont = await page.locator('body').evaluate(el => window.getComputedStyle(el).fontFamily);
  const bodyBg = await page.locator('body').evaluate(el => window.getComputedStyle(el).backgroundColor);
  console.log('=== BODY ===');
  console.log('Font:', bodyFont);
  console.log('Background:', bodyBg);

  // Check html classes
  const htmlClass = await page.locator('html').evaluate(el => el.className);
  console.log('HTML class:', htmlClass);

  // Navigate to stats and screenshot
  await page.goto('/stats');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/stats-page.png', fullPage: true });

  // Check "Voir tout" button color if exists
  const voirTout = page.locator('text=Voir tout').first();
  if (await voirTout.count() > 0) {
    const vtColor = await voirTout.evaluate(el => window.getComputedStyle(el).color);
    console.log('Voir tout color:', vtColor);
  }
});
