import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local for Supabase credentials
const envFile = fs.readFileSync(path.resolve(__dirname, '..', '.env.local'), 'utf-8');
const envVars: Record<string, string> = {};
for (const line of envFile.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
}

const TEST_EMAIL = 'teste2e@gmail.com';
const TEST_PASSWORD = 'TestPass123';
const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Helper: login via UI
async function login(page: Page) {
  await page.goto('/login');
  await page.fill('#email', TEST_EMAIL);
  await page.fill('#password', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/practice', { timeout: 10_000 });
}

// Helper: get Supabase access token by signing in via REST API (Node.js context)
async function getSupabaseToken(): Promise<{ accessToken: string; userId: string }> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  const data = await res.json();
  return { accessToken: data.access_token, userId: data.user.id };
}

test.describe('Security Tests', () => {
  test.describe.configure({ mode: 'serial' });

  test('T-S1: User cannot change own role via RLS policy', async () => {
    const { accessToken, userId } = await getSupabaseToken();

    // Read current role first
    const beforeRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    const beforeProfiles = await beforeRes.json();
    const originalRole = beforeProfiles[0]?.role;
    expect(originalRole).toBeTruthy();

    // Try to change role to something different
    const newRole = originalRole === 'admin' ? 'student' : 'admin';
    await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ role: newRole }),
      },
    );

    // Verify role has NOT changed
    const afterRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    const afterProfiles = await afterRes.json();
    expect(afterProfiles[0]?.role).toBe(originalRole);
  });

  test('T-S2: Student can still update display name', async () => {
    const { accessToken, userId } = await getSupabaseToken();

    // Update full_name (should succeed with 200)
    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ full_name: 'E2E Test Student' }),
      },
    );
    expect(updateRes.status).toBe(200);

    // Verify the name was updated
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=full_name`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    const profiles = await profileRes.json();
    expect(profiles[0]?.full_name).toBe('E2E Test Student');
  });

  test('T-S3: Student can still start a quiz session after RLS change', async ({ page }) => {
    await login(page);

    await page.goto('/practice');
    await page.waitForSelector('h1', { timeout: 10_000 });

    // Click on first topic with questions
    const topicLink = page.locator('a[href*="/quiz/setup/"]').first();
    await expect(topicLink).toBeVisible({ timeout: 10_000 });
    await topicLink.click();

    await page.waitForURL('**/quiz/setup/**', { timeout: 10_000 });

    // Verify question count is displayed (RPC works for authenticated users)
    const questionInfo = page.locator('text=/\\d+ questions? disponibles?/');
    await expect(questionInfo).toBeVisible({ timeout: 10_000 });
  });

  test('T-S4: Unauthenticated user accessing /admin redirects to /login', async ({ page }) => {
    // Without logging in, try to access admin page
    await page.goto('/admin');

    // Middleware should redirect unauthenticated users to /login
    await page.waitForURL('**/login', { timeout: 10_000 });
  });
});
