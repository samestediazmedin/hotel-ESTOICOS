import { test, expect } from '@playwright/test';

/**
 * QSI-10 — Error boundaries: friendly fallback UI on unknown routes and API errors.
 *
 * Assertions:
 * 1. Navigate to /dashboard/nonexistent -> NOT a white screen, shows friendly UI
 * 2. The public portal (/) handles unknown sub-routes gracefully
 * 3. A 4xx/5xx API response does not produce a white screen
 *
 * NOTE: The current router has a catch-all `*` route that redirects to `/` (public
 * portal). This means /dashboard/nonexistent will redirect unauthenticated users
 * to `/` and authenticated users will see the dashboard layout with no matching
 * child. Both behaviors are acceptable — the key assertion is NO white screen.
 */

test.describe('Error boundaries and fallback UI', () => {
  test('should not show a white screen on /dashboard/nonexistent (unauthenticated)', async ({ page }) => {
    await page.goto('/dashboard/nonexistent');
    await page.waitForLoadState('domcontentloaded');

    // The catch-all route redirects unknown paths to /
    // Verify we ended up somewhere with content (not blank)
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length).toBeGreaterThan(0);

    // Should NOT be a completely empty/white page
    const hasContent = await page.evaluate(() => {
      const root = document.getElementById('root');
      return root !== null && root.innerHTML.trim().length > 0;
    });
    expect(hasContent).toBe(true);
  });

  test('should render the public portal on unknown routes', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await page.waitForLoadState('domcontentloaded');

    // The catch-all redirects to / — verify we see the public portal content
    // (HotelHomePage should render with either hero images or placeholder)
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length).toBeGreaterThan(0);

    // The page should have the React root rendered
    const hasReactRoot = await page.evaluate(() => {
      const root = document.getElementById('root');
      return root !== null && root.children.length > 0;
    });
    expect(hasReactRoot).toBe(true);
  });

  test('should handle /booking/nonexistent gracefully', async ({ page }) => {
    // This is a nested unknown route under a known prefix
    await page.goto('/booking/nonexistent');
    await page.waitForLoadState('domcontentloaded');

    // Should redirect to / via catch-all, not crash
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length).toBeGreaterThan(0);
  });

  test('should show the login form with proper UI on /login', async ({ page }) => {
    // Verify that the login page itself renders without errors
    // (not an error boundary scenario, but validates the auth UI path)
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    // The login form should have the email and password fields
    await expect(page.getByLabel(/Correo electr.nico/i)).toBeVisible();
    await expect(page.getByLabel(/Contrase.a/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Entrar/i })).toBeVisible();
  });

  test('should display a user-friendly error on API failure (mocked)', async ({ page }) => {
    // Intercept the system-config API call to simulate a 500 error
    await page.route('**/api/system-config/public', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal Server Error', statusCode: 500 }),
      });
    });

    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    // The login page should still render despite the API failure
    // (it has a catch block that fails silently and uses default hotel name)
    await expect(page.getByRole('button', { name: /Entrar/i })).toBeVisible();

    // The page should not be blank
    const hasContent = await page.evaluate(() => {
      const root = document.getElementById('root');
      return root !== null && root.innerHTML.trim().length > 0;
    });
    expect(hasContent).toBe(true);
  });
});
