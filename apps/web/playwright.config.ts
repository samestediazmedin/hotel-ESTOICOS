import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for HotelOS AI E2E tests.
 *
 * Two projects: chromium-desktop (1280x720) and chromium-mobile (Pixel 5).
 * Web server: `vite preview` on port 4173 (requires `pnpm build` first).
 * API server: NestJS on port 3001 (must be started separately or via multi-server).
 *
 * @see apps/web/e2e/README.md for local prerequisites.
 */
export default defineConfig({
  testDir: './e2e',

  /* Fail fast on CI — don't run all tests if one fails early */
  fullyParallel: true,

  /* Retry once on CI to absorb flakes; never locally */
  retries: process.env.CI ? 1 : 0,

  /* Limit workers on CI to avoid resource contention */
  workers: process.env.CI ? 2 : undefined,

  /* Reporters: HTML (for artifact upload on failure) + list (for CI logs) */
  reporter: [['html', { open: 'never' }], ['list']],

  /* Shared settings for all projects */
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 5'],
      },
    },
  ],

  /* Web server — serves the production build via Vite preview.
   * Prerequisite: `pnpm --filter @hotel/web build` must succeed first.
   * The API server (port 3001) is NOT managed here — start it separately
   * or let CI handle it via background processes.
   *
   * NOTE: Vite preview does NOT proxy /api requests like `vite dev` does.
   * E2E tests that hit the API rely on the API being available at port 3001
   * and the frontend using absolute API URLs or the browser going through
   * the same origin. For auth flows, the tests use direct API calls to
   * localhost:3001 in fixtures.
   */
  webServer: {
    command: 'npx vite preview --port 4173',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
