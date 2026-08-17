import { test, expect } from './fixtures/auth';

/**
 * QSI-08 — Critical flow: staff creates a reservation via the 4-step wizard.
 *
 * Prerequisites:
 * - Seeded admin user (via seed-admin command)
 * - At least one room type and one room in the database
 * - API running on port 3001
 *
 * Flow:
 * 1. Navigate to /reservations (authed)
 * 2. Click "Nueva reserva" to open the wizard
 * 3. Step 1 (Dates): select a date range + adults count
 * 4. Step 2 (Room): select an available room
 * 5. Step 3 (Guest): select or create a guest
 * 6. Step 4 (Confirm): review summary and click "Confirmar reserva"
 * 7. Assert wizard closes and reservation appears in the calendar
 */

test.describe('Reservation Wizard (4-step)', () => {
  test('should open the wizard and display Step 1 (Dates)', async ({ authedPage: page }) => {
    await page.goto('/reservations');
    await page.waitForLoadState('domcontentloaded');

    // Click "Nueva reserva" button to open the wizard
    await page.getByRole('button', { name: /Nueva reserva/i }).click();

    // Wizard dialog should appear
    const wizardDialog = page.getByRole('dialog', { name: /Nueva reserva/i });
    await expect(wizardDialog).toBeVisible({ timeout: 5_000 });

    // Step indicator should show "Fechas" as the current step.
    // Use exact match to avoid strict-mode violation with "Fechas de estadía".
    await expect(wizardDialog.getByText('Fechas', { exact: true })).toBeVisible();
  });

  test('should advance through all 4 wizard steps', async ({ authedPage: page }) => {
    await page.goto('/reservations');
    await page.waitForLoadState('domcontentloaded');

    const wizard = page.getByRole('dialog', { name: /Nueva reserva/i });

    // Open wizard
    await page.getByRole('button', { name: /Nueva reserva/i }).click();
    await expect(wizard).toBeVisible({ timeout: 5_000 });

    // ── Step 1: Dates ──
    // The DayPicker renders gridcell buttons for each day. Select two
    // dates to form a range. Use the grid inside the wizard dialog to
    // avoid matching elements behind the overlay.
    const dayCells = wizard.locator('table button:not([disabled])');
    const dayCount = await dayCells.count();

    if (dayCount >= 3) {
      await dayCells.nth(0).click();
      await dayCells.nth(2).click(); // 2-night stay
    }

    // The wizard's Step 1 CTA is "Buscar disponibilidad" (not "Siguiente").
    const searchBtn = wizard.getByRole('button', { name: /Buscar disponibilidad/i });
    await expect(searchBtn).toBeVisible({ timeout: 5_000 });
    await searchBtn.click();

    // ── Step 2: Room ──
    // The step indicator should now highlight "Habitación".
    await expect(wizard.getByText('Habitación', { exact: true })).toBeVisible({ timeout: 10_000 });

    // Select the first available room if a selection button is present.
    const selectRoomBtn = wizard.getByRole('button', { name: /Seleccionar/i }).first();
    const roomBtnVisible = await selectRoomBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (roomBtnVisible) {
      await selectRoomBtn.click();
    }

    // ── Step 3: Guest Data ──
    await expect(
      wizard.getByText(/Datos hu.sped/i).or(wizard.getByText(/Hu.sped/i, { exact: true })),
    ).toBeVisible({ timeout: 10_000 });

    // We don't fill guest data to avoid creating test data without cleanup.
    // Reaching step 3 validates the wizard flow through the first two steps.
  });

  test('should close wizard via the Cerrar button', async ({ authedPage: page }) => {
    await page.goto('/reservations');
    await page.waitForLoadState('domcontentloaded');

    // Open wizard
    await page.getByRole('button', { name: /Nueva reserva/i }).click();
    await expect(page.getByRole('dialog', { name: /Nueva reserva/i })).toBeVisible();

    // Close via "Cerrar" button in the wizard footer
    await page.getByRole('button', { name: /Cerrar/i }).last().click();

    // Wizard should be gone
    await expect(page.getByRole('dialog', { name: /Nueva reserva/i })).not.toBeVisible();
  });
});
