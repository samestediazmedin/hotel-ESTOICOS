/**
 * Vitest global setup — test-only environment secrets (2026-06-02)
 *
 * Several middlewares fail-fast at module load if their secret env var is
 * absent (security hardening S03: CSRF_SECRET must never fall back to a
 * hardcoded value). That guard is correct for production but breaks unit
 * tests, which run without a real environment.
 *
 * This setup file runs BEFORE any test module is imported, so it injects
 * deterministic, non-production test secrets. It does NOT weaken the
 * production fail-fast — it only satisfies the guard during tests.
 */
process.env['CSRF_SECRET'] ??= 'test-only-csrf-secret-not-used-in-production';
process.env['JWT_ACCESS_SECRET'] ??= 'test-only-jwt-access-secret';
process.env['REVIEW_TOKEN_SECRET'] ??= 'test-only-review-token-secret';
