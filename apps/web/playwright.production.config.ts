import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for running E2E tests against PRODUCTION.
 *
 * Key difference from playwright.config.ts:
 * - No webServer block (production is already running on Railway)
 * - baseURL comes from E2E_BASE_URL env var (required)
 * - Desktop-only project (no mobile — reduces flakiness against remote)
 * - Longer timeouts for network latency to Railway
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,       // sequential against prod to avoid rate-limit / contention
  retries: 1,                 // one retry to absorb network flakes
  workers: 1,                 // single worker against production
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 60_000,            // 60s per test (remote latency)

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://hotel-os-web-production.up.railway.app',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],

  // NO webServer — production is already deployed
});
