/**
 * Lighthouse CI configuration — QSI-22
 *
 * Runs against the production build served via `pnpm preview` (Vite preview server).
 * The preview server must be started BEFORE lhci autorun executes.
 *
 * Prerequisites (local):
 *   pnpm --filter @hotel/web build   # build production bundle
 *   pnpm --filter @hotel/web preview # start Vite preview on port 4173
 *   pnpm --filter @hotel/web lhci:autorun
 *
 * In CI (.github/workflows/perf.yml):
 *   - treosh/lighthouse-ci-action@v12 handles start/stop of the server
 *   - Reports uploaded to temporary-public-storage (shareable URLs)
 *   - Step is continue-on-error: true — informational only, never blocks merge
 *
 * Rationale for `pnpm preview` vs `pnpm dev`:
 *   Lighthouse scores production bundles. Dev server has no minification,
 *   no tree-shaking, and no code splitting — scores would be artificially low
 *   and not representative of what users actually load in production.
 *   Always benchmark the production build.
 *
 * Assertions use `warn` level — violations appear in PR comments but do NOT
 * fail the CI check (consistent with QSI-22 "informational, not blocking").
 * Change to `error` to make them blocking.
 */

/** @type {import('@lhci/cli').LighthouseRcConfig} */
module.exports = {
  ci: {
    collect: {
      // URL(s) to audit — public-facing portal homepage
      url: ['http://localhost:4173/'],
      // Number of Lighthouse runs per URL (3 for statistical stability)
      numberOfRuns: 3,
      // Vite preview default port
      startServerCommand: 'pnpm --filter @hotel/web preview --port 4173',
      startServerReadyPattern: 'Local',
      startServerReadyTimeout: 30000,
    },
    assert: {
      // Use `warn` so failures surface as PR comments without blocking the check.
      // Switch to `error` when the project is ready to enforce these gates.
      preset: 'lighthouse:no-pwa',
      assertions: {
        'categories:performance':      ['warn', { minScore: 0.80 }],
        'categories:accessibility':    ['warn', { minScore: 0.95 }],
        'categories:best-practices':   ['warn', { minScore: 0.90 }],
        'categories:seo':              ['warn', { minScore: 0.90 }],
      },
    },
    upload: {
      // Uploads reports to temporary public storage (shareable URLs in PR comments).
      // Reports expire after ~30 days.
      target: 'temporary-public-storage',
    },
  },
};
