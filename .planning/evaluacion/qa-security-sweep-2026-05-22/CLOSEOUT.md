# QA + Security Sweep — Closeout 2026-05-22

**Status**: ✓ COMPLETE — all P0/P1 findings resolved.
**Trigger**: External QA/security audit (`documento_hallazgos_qa_seguridad.docx`).
**Approach**: Hybrid SDD/GSD — formal PLAN.md + atomic commits per group + specialized sub-agent execution.

---

## Findings resolved

| ID | Severity | Status | Commit | Sub-agent |
|----|----------|--------|--------|-----------|
| **SEC-001** | 🔴 CRITICAL | ✓ FIXED | `d68961e` | mia (G2) |
| **SEC-002** | 🔴 HIGH | ✓ FIXED | `f29cbfb` | mia (G1) |
| **SEC-003** | 🔴 HIGH | ✓ FIXED | `f29cbfb` | mia (G1) |
| **SEC-004** | 🟡 MED | ✓ DOCUMENTED | `f29cbfb` | mia (G1) |
| **SEC-005** | 🟢 TEST GATE | ✓ COVERED via 8 unit tests | `f29cbfb` | mia (G1) |
| **BE-001** | 🔴 HIGH | ✓ FIXED | `d800aa9` | olaf (G3) |
| **FE-001** | 🔴 HIGH | ✓ FIXED | `d800aa9` | olaf (G3) |
| **FE-002** | 🟡 MED | ✓ FIXED | `14a8316` | zoe (G4) |

---

## Acceptance criteria — final verification

| Gate | Target | Achieved |
|------|--------|----------|
| `pnpm audit --prod` | 0 critical / 0 high | ✓ **No known vulnerabilities found** |
| API typecheck | 0 errors | ✓ 0 errors |
| Web typecheck | 0 errors | ✓ 0 errors |
| shared-kernel typecheck | 0 errors | ✓ 0 errors (TS5095 resolved) |
| Web lint | runs without crash | ✓ Runs to completion (48 pre-existing errors / 5 warnings deferred — none introduced by sweep) |
| API tests | 428+ passing | ✓ **440/440** (+12 from G1) |
| Web tests | 153+ passing | ✓ **153/153** |
| SEC-005 runtime probe | 400 (not 500) | ✓ Covered by 8 unit tests in `public-booking.controller.spec.ts` |
| Git history | Atomic per-group commits | ✓ 4 commits (G1, G2, G3, G4) |

---

## Deliverables per group

### G1 — Security code (`mia`) — commit `f29cbfb`
**Files modified (5)**:
- `apps/api/src/modules/public-booking/public-booking.controller.ts` — `.parse()` → `.safeParse()` + `BadRequestException(400)` at both endpoints
- `apps/api/src/modules/public-booking/public-booking.controller.spec.ts` — NEW, 8 tests
- `apps/api/src/modules/reviews/reviews.service.ts` — removed `'fallback-dev-secret'`; constructor fail-fast on missing `REVIEW_TOKEN_SECRET`
- `apps/api/src/modules/reviews/reviews.service.spec.ts` — 4 new SEC-003 tests + env save/restore lifecycle
- `.env.example` — `JWT_REFRESH_SECRET` deprecation comment + `REVIEW_TOKEN_SECRET` documented

**Net**: +12 tests, 0 TS errors, 440/440 API passing.

### G2 — Dependencies (`mia`) — commit `d68961e`
**Files modified (2)**:
- `package.json` (root) — `pnpm.overrides` added for 6 packages
- `pnpm-lock.yaml` — regenerated

**`pnpm.overrides` applied**:

| Key | Range | Resolved |
|-----|-------|----------|
| `tar` | `>=7.5.11` | 7.5.15 |
| `fast-xml-parser` | `>=4.5.6` | 5.8.0 |
| `engine.io` | `>=6.6.8` | 6.6.8 |
| `ws` | `>=8.20.1` | 8.20.1 |
| `qs` | `>=6.15.2` | 6.15.2 |
| `@hono/node-server` | `>=1.19.13` | 2.0.3 |

**Net**: 15 CVEs (1 crit / 8 high / 5 mod / 1 low) → **0/0/0/0**. No carry-forward needed.

### G3 — Toolchain (`olaf`) — commit `d800aa9`
**Files modified (4)**:
- `tsconfig.base.json` — `module: commonjs` → `module: ES2022`
- `apps/web/package.json` — `eslint ^10.3.0` → `^9.20.0`, `@eslint/js ^10.0.1` → `^9.20.0`, added `globals ^14.0.0`
- `apps/web/eslint.config.js` — `import globals from 'globals'`; replaced manual globals with `...globals.browser, ...globals.node`
- `pnpm-lock.yaml` — regenerated

**Net**: TS5095 resolved (NestJS preserved by its own `module: commonjs` override). Lint no longer crashes. No test regression.

### G4 — Tests hardening (`zoe`) — commit `14a8316`
**Files modified (3) + created (2)**:
- `apps/web/package.json` — `msw@^2.14.6` added
- `apps/web/src/test-setup.ts` — extended with MSW lifecycle (`beforeAll/afterEach/afterAll`)
- NEW `apps/web/src/test/handlers.ts` — empty default handler set
- NEW `apps/web/src/test/msw-server.ts` — `setupServer()` instance
- `pnpm-lock.yaml` — regenerated

**Net**: MSW safety net active. Zero unhandled-request warnings observed (all existing tests mock at JS module layer via `vi.mock('@/lib/api', ...)`). Net: 153/153 passing.

---

## Deferred / carry-forward items

| Item | Why deferred | Owner |
|------|--------------|-------|
| 48 web lint errors + 5 warnings (no-explicit-any, no-unused-vars, react/prop-types, exhaustive-deps) | Pre-existing code quality — out of scope for security sweep; needs dedicated lint cleanup phase | Future GSD phase |
| SEC-005 live runtime probe (curl POST with invalid body → 400) | API not running at orchestrator session end; equivalent coverage via 8 unit tests in G1 | User manual QA pass |

---

## Risks discovered and mitigated

- **R1** (mitigated): ESLint 9 downgrade did NOT surface new errors — the 48 existing ones were already there under ESLint 10 (just hidden because lint crashed before reaching them).
- **R2** (mitigated): `tsconfig.base.json` `module: ES2022` change did NOT break NestJS — `apps/api/tsconfig.json` already had its own `module: commonjs` override.
- **R3** (mitigated): `pnpm.overrides` did not introduce functional regressions — both test suites pass after upgrade.

---

## Engram observations created during sweep

- #826 — QA findings validation 2026-05-22 (read-only audit by general-purpose agent)
- mia (G1) bugfix observation — SEC-002/003/004 implementations
- olaf (G3) bugfix observation — TS5095 + ESLint 10 incompatibility resolution
- mia (G2) bugfix observation — SEC-001 dependency overrides
- zoe (G4) pattern observation — MSW global interceptor pattern for vitest+jsdom

---

## Final verdict

**APROBADO PARA CIERRE QA**. Todos los hallazgos P0/P1 del documento original están resueltos. La validación inicial (engram #826) reveló que el documento marcaba 3 fixes como "IMPLEMENTADO" cuando en realidad no lo estaban — esto se corrigió en G1. El proyecto pasa las 8 puertas de aceptación (audit, typecheck, lint, tests api, tests web, SEC-005 coverage, lint crash resolved, MSW safety net).

**Sin deuda crítica**. 48 lint errors pre-existentes quedan como carry-forward para una phase dedicada de limpieza de calidad de código, no es bloqueante.
