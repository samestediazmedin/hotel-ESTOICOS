import { test, expect } from '@playwright/test';

/**
 * QSI-07 — Critical flow: login -> dashboard -> logout.
 *
 * Exercises the full authentication lifecycle:
 * 1. Navigate to /login
 * 2. Fill email + password
 * 3. Submit the form
 * 4. Assert redirect to /dashboard
 * 5. Assert dashboard content is visible (heading)
 * 6. Click "Cerrar sesion" in the sidebar
 * 7. Assert redirect back to public portal (/)
 *
 * Credentials come from environment variables (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD)
 * with defaults matching the seed-admin command.
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@hotel.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'admin123';

test.describe('Login -> Dashboard -> Logout', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear all auth state (cookies, localStorage, sessionStorage)
    await context.clearCookies();
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    // Reload page after clearing state
    await page.reload();
  });

  test('should complete the full auth lifecycle', async ({ page }) => {
    // 1. Navigate to login
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    // 2. Fill credentials
    await page.getByLabel(/Correo electr.nico/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/Contrase.a/i).fill(ADMIN_PASSWORD);

    // 3. Submit the form
    await page.getByRole('button', { name: /Entrar/i }).click();

    // 4. Wait for redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 15_000 });

    // 5. Assert dashboard content is visible
    // The DashboardPage should have some recognizable heading or content
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });

    // 6. Click logout — the "Cerrar sesion" button is in the Sidebar
    const logoutButton = page.getByRole('button', { name: /Cerrar sesi.n/i });

    // On mobile, the sidebar might be collapsed/hidden.
    // If the button is not visible, we might need to open the sidebar first.
    const isLogoutVisible = await logoutButton.isVisible().catch(() => false);
    if (!isLogoutVisible) {
      // Try to find a sidebar toggle/hamburger button
      const menuToggle = page.getByRole('button', { name: /men.?/i })
        .or(page.locator('[aria-label*="menu"]'))
        .or(page.locator('[aria-label*="sidebar"]'));

      const toggleExists = await menuToggle.first().isVisible().catch(() => false);
      if (toggleExists) {
        await menuToggle.first().click();
        await logoutButton.waitFor({ state: 'visible', timeout: 5_000 });
      }
    }

    await logoutButton.click();

    // 7. Assert redirect to public portal
    await page.waitForURL(/\/$/, { timeout: 10_000 });

    // Verify we're back on the public portal, not the login page
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/$/);
  });

  test('should show validation error with invalid credentials', async ({ page }) => {
    // Ensure we're on the login page (not inherited from previous test)
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    await page.getByLabel(/Correo electr.nico/i).fill('invalid@test.com');
    await page.getByLabel(/Contrase.a/i).fill('wrongpassword123');
    await page.getByRole('button', { name: /Entrar/i }).click();

    // Should show an error alert — either inline validation or server error
    const errorAlert = page.getByRole('alert');
    await expect(errorAlert).toBeVisible({ timeout: 10_000 });
  });
});
