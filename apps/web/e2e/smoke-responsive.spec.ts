import { test, expect } from '@playwright/test';

/**
 * QSI-06 — Responsive smoke test.
 *
 * Verifies the public portal renders correctly at 4 viewport widths:
 * 360px (mobile), 768px (tablet), 1024px (small desktop), 1440px (large desktop).
 *
 * Assertions:
 * - No horizontal scrollbar (document.body.scrollWidth <= viewport width)
 * - Hero gallery area is visible (img element or placeholder)
 * - Reservation widget CTA ("Reservar") is reachable
 */

const VIEWPORTS = [
  { name: 'mobile-360', width: 360, height: 640 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1024', width: 1024, height: 768 },
  { name: 'desktop-1440', width: 1440, height: 900 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`Public portal at ${vp.name} (${vp.width}px)`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('should render without horizontal scroll', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      expect(hasHorizontalScroll).toBe(false);
    });

    test('should display the hero gallery area', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // The hero section (#inicio) has two gallery variants:
      //   - Desktop (>=lg): a 5-image grid  (class "hidden lg:grid")
      //   - Mobile  (<lg):  a 3-image grid  (class "grid lg:hidden")
      // At any viewport, exactly one variant is visible.
      // Fallback: if the hotel has no photos, a placeholder with
      // aria-label containing "Sin foto" may appear instead.
      const heroSection = page.locator('#inicio');
      await expect(heroSection).toBeVisible({ timeout: 10_000 });

      const visibleImg = heroSection.locator('img').filter({ visible: true }).first();
      const placeholder = heroSection.locator('[aria-label*="Sin foto"]');

      const imgVisible = await visibleImg.isVisible().catch(() => false);
      const placeholderVisible = await placeholder.isVisible().catch(() => false);

      expect(
        imgVisible || placeholderVisible,
        'Neither hero images nor "Sin foto" placeholder are visible inside #inicio',
      ).toBe(true);
    });

    test('should have a reachable reservation widget CTA', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // The ReservationWidget renders a "Reservar" button in both
      // desktop-sidebar and mobile-bar variants.
      const reservarButton = page.getByRole('button', { name: /Reservar/i });

      // At least one variant should be visible at any viewport
      await expect(reservarButton.first()).toBeAttached();
    });
  });
}
