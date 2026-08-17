# Phase 17 — CI/CD Gates

**Milestone:** v1.4 Quality & Security Infrastructure
**Phase position:** 1 of 5 (foundation — other v1.4 phases depend on this)
**Trigger:** External QA audit Section 12 P2 — "Agregar gates completos de QA y Security en CI"
**Goal:** Every push and PR runs audit + typecheck + lint + tests via GitHub Actions. PRs to master require all checks green to merge.

---

## Why this matters

Right now the repo has **zero CI**. All quality gates (pnpm audit, typecheck, lint, tests) are run manually by the developer on their laptop before push. There is no automated guarantee that:

- A commit that breaks tests will be detected before merge
- A PR that introduces a vulnerable dependency will be flagged
- A typecheck regression in `shared-kernel` (like the TS5095 from this morning) will be caught
- Lint will continue to run (it just crashed silently in the past)

Without CI gates, future feature work can silently regress quality. This phase establishes the foundation that Phases 18-21 build on.

---

## Requirements

- [ ] **QSI-01**: GitHub Actions workflow `.github/workflows/ci.yml` runs on every push and PR. Executes (in this order): `pnpm install --frozen-lockfile`, `pnpm audit --prod` (failing on high/critical), per-workspace `pnpm tsc --noEmit`, `pnpm --filter @hotel/web lint`, `pnpm --filter @hotel/api test -- --run`, `pnpm --filter @hotel/web test -- --run`.
- [ ] **QSI-02**: Workflow fails fast — typecheck error stops downstream; audit high/critical stops downstream.
- [ ] **QSI-03**: Branch protection rule on `master`: PRs require all CI checks to pass before merge. Documented in `.github/CONTRIBUTING.md`.
- [ ] **QSI-04**: Workflow runs in under 5 minutes on cold cache via pnpm cache + Turbo remote cache (if configured).

---

## Success criteria (what must be TRUE)

1. **CI runs on push to master AND on PRs**: `.github/workflows/ci.yml` exists, with triggers `on: [push, pull_request]` scoped to relevant branches.

2. **Job order is fail-fast**:
   - Install dependencies with `--frozen-lockfile`
   - `pnpm audit --prod --audit-level=high` (blocks on high or critical)
   - Per-workspace `pnpm tsc --noEmit` (api, web, shared-kernel)
   - `pnpm --filter @hotel/web lint` (errors fail; warnings don't)
   - `pnpm --filter @hotel/api test -- --run` (must pass)
   - `pnpm --filter @hotel/web test -- --run` (must pass)

3. **Branch protection**: `master` branch enforces required status checks before merge.

4. **Performance**: Cold-cache CI run < 5 minutes. Cached run ideally < 2 minutes.

5. **Caching**: pnpm store cached between runs via `actions/setup-node@v4` with `cache: pnpm`. Node modules cached by lockfile hash.

6. **Reproducibility**: Workflow uses fixed Node version (read from `.nvmrc` or hardcoded). pnpm version pinned.

7. **CONTRIBUTING.md documents**: how to enable branch protection, what checks are required, what to do if a check fails locally.

---

## Out of scope (deferred to other Phase 17+ phases)

- ❌ Playwright E2E (Phase 18)
- ❌ Authz matrix / API contract tests (Phase 19)
- ❌ Dependabot configuration (Phase 20)
- ❌ Semgrep / gitleaks integration (Phase 20)
- ❌ AI abuse fixtures (Phase 20)
- ❌ k6 / Lighthouse CI (Phase 21)

This phase ONLY establishes the GitHub Actions foundation. Other phases extend it.

---

## Constraints

- **Workspace structure**: monorepo with `apps/api`, `apps/web`, `packages/shared-kernel` — pnpm workspaces + Turbo. Workflow must respect that structure.
- **Conventional commits**: project rule — commits must follow conventional format.
- **No Co-Authored-By**: project rule — no AI attribution in commits.
- **Never build after changes**: project rule — no `pnpm build` step in CI (typecheck + tests cover correctness).
- **Existing gates that already pass** (so CI should preserve them):
  - `pnpm audit --prod`: 0 vulnerabilities
  - `apps/api tsc`: 0 errors
  - `apps/web tsc`: 0 errors
  - `packages/shared-kernel tsc`: 0 errors
  - `apps/web lint`: runs to completion (48 errors + 5 warnings pre-existing, deferred to dedicated phase — CI should NOT block on them, but should report them)
  - `apps/api test`: 440/440 passing
  - `apps/web test`: 159/159 passing

- **Pre-existing lint errors**: 48 errors and 5 warnings exist in `apps/web` from before this milestone. They are documented as carry-forward and should NOT block CI in this phase. The CI lint step should run but treat existing errors as informational. Future polish phase will eliminate them and then we tighten the gate.

---

## Decisions to make during plan

- **Node version**: read from `.nvmrc` if exists, else pin to current LTS (v20 or v22).
- **pnpm version**: read from `packageManager` field in root `package.json`.
- **Lint blocking strategy**: option A — run lint but `continue-on-error: true`; option B — generate a lint diff for new code only (more complex). Default to A in this phase; B is future polish.
- **Audit level**: `--audit-level=high` (blocks high + critical, allows moderate). Discuss in plan.
- **Workflow file organization**: single `ci.yml` with one job, or split into multiple jobs (audit, typecheck, lint, test) running in parallel after install? Parallel is faster but more complex. Decision in plan.

---

## Files expected to change

- NEW `.github/workflows/ci.yml`
- NEW `.github/CONTRIBUTING.md` (or extend existing)
- Possibly NEW `.nvmrc` if it doesn't exist
- Possibly `package.json` (add `engines.node` field if missing)

---

## Verification

After implementation:
1. Push a test commit to a feature branch
2. Observe CI workflow triggers automatically
3. All 5 steps run in order
4. Total time < 5 minutes
5. Open a PR and confirm checks appear in the PR UI
6. Try merging a PR with failing tests → blocked by branch protection

---

## Notes on previous patterns

- Project uses **pnpm 10.x** with strict isolation. Some transitive deps need explicit declarations.
- **Turbo cache** is in `turbo.json` (read it for cache config). Could speed up typecheck + lint significantly.
- The `pnpm audit` baseline is already clean — establishing the gate now is the right time.
- Branch protection on `master` requires repo admin access — GitHub Actions workflow can configure it via API only if the workflow has admin perms. Manual documentation in CONTRIBUTING.md is safer.
