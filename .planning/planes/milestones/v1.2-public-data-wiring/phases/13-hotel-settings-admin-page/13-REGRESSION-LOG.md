# Phase 13 — Regression Log

Captured: 2026-05-18T11:02:45Z
Operator: claude-sonnet-4-6 (automated)

---

## Backend

### tsc --noEmit
Exit code: 0
Output: (clean — no errors, no output)

### vitest src/system-config/
Exit code: 0
Tests passed: 4 / 4
Duration: 699ms

### vitest src/modules/hotel-photos/
Exit code: 0
Tests passed: 15 / 15
Duration: 793ms
Note: 1 expected WARN log — `[HotelPhotosService] Failed to delete R2 object hotel-photos/ts-photo2.jpg: R2 unavailable` — this is the best-effort R2 delete test asserting graceful degradation.

### vitest src/modules/public-portal/ (Phase 12 regression)
Exit code: 0
Tests passed: 18 / 18
Duration: 718ms
Note: Covers Phase 12 + Phase 13-01 dual-shape URL resolution and DB-backed address.

### vitest full (api)
Exit code: 0
Tests passed: 361 / 361
Test files: 46 / 46
Duration: 4.55s
Note: Several ERROR log lines are intentional (EmailService, NightAuditService, CheckoutListener — all testing error-handling paths). All tests pass.

---

## Frontend

### tsc --noEmit
Exit code: 0
Output: (clean — no errors, no output)

### vitest src/features/settings/
Exit code: 1 (no test files found — expected)
Note: No unit tests were authored for the settings feature in Phase 13 plans 03-04. The plan doc explicitly notes "may be 0 if not authored". This is not a regression — it is expected per the plan's threat model.

### vitest src/features/public-portal/ (Phase 10 + 12 regression)
Exit code: 0
Tests passed: 11 / 11
Test files: 3 / 3
Duration: 3.57s

### vitest full (web)
Exit code: 0
Tests passed: 116 / 116
Test files: 14 / 14
Duration: 3.93s

---

## Token / Color Checks

### Zero hex check — settings feature (*.tsx)
Pattern: `#[0-9a-fA-F]{3,6}`
Path: apps/web/src/features/settings
Result: ZERO matches — all colors via CSS token utilities

### Zero Tailwind palette check — settings feature (*.tsx)
Pattern: `(text|bg|border)-(gray|blue|red|green|yellow|purple|pink|indigo|slate|zinc|neutral|stone|amber|orange|lime|emerald|teal|cyan|sky|violet|fuchsia|rose)-[0-9]`
Path: apps/web/src/features/settings
Result: ZERO matches — no generic Tailwind palette classes

---

## Summary

| Suite | Exit | Tests | Notes |
|-------|------|-------|-------|
| api tsc | 0 | — | clean |
| api vitest system-config | 0 | 4/4 | — |
| api vitest hotel-photos | 0 | 15/15 | expected WARN in best-effort R2 test |
| api vitest public-portal (P12 regression) | 0 | 18/18 | — |
| api vitest full | 0 | 361/361 | 46 files |
| web tsc | 0 | — | clean |
| web vitest settings | N/A | 0/0 | no tests authored — expected per plan |
| web vitest public-portal (P10+P12 regression) | 0 | 11/11 | — |
| web vitest full | 0 | 116/116 | 14 files |
| zero-hex check (settings/*.tsx) | — | — | ZERO matches |
| zero-palette check (settings/*.tsx) | — | — | ZERO matches |

All gates green: YES
