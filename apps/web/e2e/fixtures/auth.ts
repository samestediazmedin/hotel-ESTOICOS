import { test as base, expect, type Page } from '@playwright/test';

/**
 * E2E Auth Fixture — provides an authenticated page for staff tests.
 *
 * Strategy: perform a real UI login at /login (fill email + password, click
 * Entrar). This is the most reliable approach because it sets the httpOnly
 * refresh cookie AND the localStorage `hos-recent-auth` flag through the
 * normal app flow, avoiding race conditions between page.evaluate and React
 * hydration.
 *
 * The previous API-only approach (POST /api/auth/login + page.evaluate to
 * inject localStorage) failed because useRestoreSession reads localStorage
 * during the initial React render — before page.evaluate can run.
 *
 * Credentials: read from environment variables with sensible defaults for
 * local development (matching the seed-admin command defaults).
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@hotel.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'admin123';

export interface AuthFixtures {
  /** A Page already authenticated as the admin user. */
  authedPage: Page;
}

export const test = base.extend<AuthFixtures>({
  authedPage: async ({ page }, use) => {
    // Perform a real browser login — same flow a human user follows.
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    await page.getByLabel(/Correo electr.nico/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/Contrase.a/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /Entrar/i }).click();

    // Wait for redirect to /dashboard after successful login
    await page.waitForURL('**/dashboard', { timeout: 15_000 });

    // Ensure dashboard content has actually rendered
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });

    await use(page);
  },
});

export { expect } from '@playwright/test';
