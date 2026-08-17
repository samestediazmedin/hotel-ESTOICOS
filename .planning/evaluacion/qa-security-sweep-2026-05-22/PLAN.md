# QA + Security Sweep — 2026-05-22

**Trigger**: External QA/security audit document (`documento_hallazgos_qa_seguridad.docx`) delivered 8 findings.
**Goal**: Resolve all P0/P1 findings + verify P2 remediation claims.
**Approach**: Hybrid SDD/GSD — formal plan artifact, atomic commits per group, specialized sub-agent execution.

---

## Validated findings (read-only audit completed 2026-05-22 15:30)

Validation report persisted in engram observation #826. **All 8 findings are real and unfixed** — the audit document's "IMPLEMENTADO" markers for SEC-002, SEC-003, SEC-004 were **incorrect** (no code matches the claim).

| ID | Severity | File | Issue |
|----|----------|------|-------|
| SEC-001 | 🔴 CRITICAL | (root deps) | 15 CVEs: tar, fast-xml-parser, ws (via engine.io), qs, @hono/node-server, more |
| SEC-002 | 🔴 HIGH | `apps/api/src/modules/public-booking/public-booking.controller.ts` | Uses bare `.parse()` at L60+L89 → 500 on invalid body |
| SEC-003 | 🔴 HIGH | `apps/api/src/modules/reviews/reviews.service.ts` | `'fallback-dev-secret'` literal at L62-64 (silent degradation in prod) |
| SEC-004 | 🟡 MED | `.env.example` (root) | `JWT_REFRESH_SECRET` declared but unused; refresh tokens are opaque DB-stored |
| BE-001 | 🔴 HIGH | `tsconfig.base.json` | `module: commonjs` incompatible with `moduleResolution: bundler` → TS5095 |
| FE-001 | 🔴 HIGH | `apps/web/package.json` | `eslint@10.3.0` + `eslint-plugin-react@7.37.5` → `getFilename is not a function` |
| FE-002 | 🟡 MED | `apps/web/src/test-setup.ts` | No MSW → real XHR warnings polluting Vitest output |
| SEC-005 | (test) | (runtime) | Validation gate — verify 400 (not 500) returned post-SEC-002 |

---

## Execution groups

### G1 — Security code (`mia`)
- **SEC-002**: `parse()` → `safeParse() + BadRequestException(400)` in `public-booking.controller.ts` (both endpoints).
- **SEC-003**: Remove `'fallback-dev-secret'`. Throw at module init if `REVIEW_TOKEN_SECRET` missing.
- **SEC-004**: Add deprecation comment to `JWT_REFRESH_SECRET` in `.env.example` clarifying it is unused (refresh tokens are opaque DB-stored).
- Update specs: `public-booking.controller.spec.ts`, `reviews.service.spec.ts`.

### G2 — Dependencies (`mia`)
- **SEC-001**: Add `pnpm.overrides` to root `package.json`:
  - `tar: ">=7.5.7"` (CVE-2026-24842 — hardlink path traversal)
  - `fast-xml-parser: ">=5.7.0"`
  - `ws: ">=8.20.1"` (DoS via excessive subprotocol headers)
  - `qs: ">=6.15.2"`
- Direct upgrade of `engine.io` to `>=6.6.8` (if used directly).
- Run `pnpm install` to regenerate lockfile.
- Re-run `pnpm audit --prod` and confirm 0 critical/high.

### G3 — Toolchain (`olaf`)
- **BE-001**: In `tsconfig.base.json`, change `module: "commonjs"` → `module: "ES2022"` (or `"preserve"`). Verify no cascade breakage in packages that depend on commonjs (e.g. NestJS apps may need their own override).
- **FE-001**: Downgrade `eslint` from `^10.x` to `^9.20.0` in `apps/web/package.json` (most pragmatic; React plugin ecosystem not ready for ESLint 10). Run `pnpm install`. Verify `pnpm --filter @hotel/web lint` runs clean.

### G4 — Tests hardening (`zoe`)
- **FE-002**: Install `msw@^2.x` as dev dep in `apps/web`. Add MSW setup in `apps/web/src/test-setup.ts` with `setupServer()` and `beforeAll/afterEach/afterAll` lifecycle. Add an empty default handler set + onUnhandledRequest: 'warn'. Ensure existing 153 tests still pass.

---

## Execution waves

| Wave | Groups | Rationale |
|------|--------|-----------|
| **Wave 1** (parallel) | G1 + G3 | G1 touches `apps/api/src/modules/`; G3 touches `tsconfig.base.json` + `apps/web/package.json` (eslint downgrade) — different paths |
| **Wave 2** (sequential) | G2 | Touches root `package.json` (pnpm.overrides) — must run after Wave 1 to consolidate lockfile |
| **Wave 3** (sequential) | G4 | Adds `msw` to `apps/web/package.json` — must run after G3's eslint downgrade settles |
| **Final verification** | (orchestrator) | `pnpm audit`, `pnpm typecheck`, `pnpm lint`, full test suites, SEC-005 curl probe |

---

## Acceptance criteria

| Gate | Target |
|------|--------|
| `pnpm audit --prod` | 0 critical / 0 high |
| `pnpm typecheck` (monorepo root) | 0 errors |
| `pnpm --filter @hotel/web lint` | 0 errors, 0 warnings |
| `pnpm --filter @hotel/api test` | 428+ passing (existing) |
| `pnpm --filter @hotel/web test` | 153+ passing (existing) |
| SEC-005 — `curl -X POST /api/public/bookings` with empty body | HTTP 400 (not 500) |
| Git history | One atomic commit per group (4 commits) |

---

## Risks

- **R1**: ESLint 9 downgrade may surface lint errors that ESLint 10 was silently failing on. Mitigate: run `--fix` first; document remaining warnings as carry-forward if non-blocking.
- **R2**: `module: ES2022` change in `tsconfig.base.json` could break NestJS build (NestJS needs CommonJS). Mitigate: `apps/api/tsconfig.json` already has its own `module` override; verify with typecheck.
- **R3**: pnpm.overrides may pin transitive deps in unexpected ways. Mitigate: re-run full test suites after `pnpm install`.

---

## Status tracking

- [ ] Wave 1 — G1 + G3 dispatched
- [ ] Wave 2 — G2 dispatched
- [ ] Wave 3 — G4 dispatched
- [ ] Final verification
- [ ] Pushed to GitHub
