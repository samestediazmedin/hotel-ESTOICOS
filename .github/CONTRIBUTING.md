# Contributing to HotelOS AI

## CI Overview

Every push to `master` and every pull request targeting `master` triggers the
GitHub Actions workflow defined in `.github/workflows/ci.yml`.

The workflow runs a **single linear job** on `ubuntu-latest`.  Each step must
pass before the next one starts (fail-fast).  If any blocking step fails, the
run is marked red and the PR cannot be merged.

```
Install → Audit → Typecheck → Lint → Test
```

---

## What each step does and what it blocks

| # | Step | Blocks merge? | Threshold |
|---|------|---------------|-----------|
| 1 | `pnpm install --frozen-lockfile` | Yes | Lockfile must not drift from committed `pnpm-lock.yaml` |
| 2 | `pnpm audit --prod --audit-level=high` | Yes | High or Critical CVEs in production deps only |
| 3 | Typecheck shared-kernel | Yes | Zero TypeScript errors in `packages/shared-kernel` |
| 4 | Typecheck api | Yes | Zero TypeScript errors in `apps/api` |
| 5 | Typecheck web | Yes | Zero TypeScript errors in `apps/web` |
| 6 | Lint web | **No (non-blocking)** | 48 pre-existing errors — see note below |
| 7 | Test api | Yes | All 440 tests must pass |
| 8 | Test web | Yes | All 159 tests must pass |

### Lint non-blocking note

`apps/web` has 48 ESLint errors and 5 warnings carried forward from before
milestone v1.4.  They are intentionally allowed to not block CI in this phase.
A dedicated lint-polish phase will eliminate them.  Once that phase is merged,
`continue-on-error: true` will be removed from the lint step and lint will
become a blocking gate.

**Do not add new lint errors.**  The step still runs and reports; reviewers
can see failures in the step output.

---

## How to enable branch protection on `master` (admin only)

GitHub branch protection rules cannot be created by a CI workflow without
repo-admin credentials.  An admin must enable them once through the GitHub UI:

1. Go to the repository on GitHub.
2. Navigate to **Settings → Branches**.
3. Under "Branch protection rules", click **Add rule**.
4. In "Branch name pattern" enter `master`.
5. Enable the following options:
   - **Require a pull request before merging**
     - Require approvals: 1
   - **Require status checks to pass before merging**
     - Enable "Require branches to be up to date before merging"
     - Search for and add the status check named `ci` (the job name in
       `ci.yml` — it appears after the first CI run completes)
   - **Do not allow bypassing the above settings** (optional but recommended)
6. Click **Save changes**.

After this is set, any PR that does not have a green `ci` check will be
blocked from merging regardless of approvals.

---

## Caching strategy

The workflow uses `actions/setup-node@v4` with `cache: 'pnpm'`, which caches
the pnpm content-addressable store (keyed on `pnpm-lock.yaml`).

- **Cold cache** (first run, or after lockfile changes): ~3–4 minutes.
- **Warm cache** (subsequent runs, same lockfile): ~1–2 minutes.

There is no Turbo remote cache configured in this phase.  Turbo's local cache
does not persist between GitHub Actions runs by default.  If CI time grows,
configure `turbo` with a remote cache token (Vercel Remote Cache or
self-hosted) and set `TURBO_TOKEN` + `TURBO_TEAM` in repository secrets.

---

## How to debug a failing CI locally

Run the exact same commands the CI workflow runs, in the same order:

```sh
# 1. Install (must not mutate the lockfile)
pnpm install --frozen-lockfile

# 2. Audit
pnpm audit --prod --audit-level=high

# 3. Typecheck (each workspace)
pnpm --filter @hotel/shared-kernel typecheck
pnpm --filter @hotel/api typecheck
pnpm --filter @hotel/web typecheck

# 4. Lint (informational — non-blocking while pre-existing errors exist)
pnpm --filter @hotel/web lint

# 5. Tests
pnpm --filter @hotel/api test -- --run
pnpm --filter @hotel/web test -- --run
```

If `pnpm install --frozen-lockfile` fails locally it means your local
workspace has uncommitted dependency changes.  Run `pnpm install` normally to
update the lockfile, verify the changes are intentional, then commit
`pnpm-lock.yaml`.

If a typecheck step fails, run it in isolation:

```sh
pnpm --filter @hotel/api typecheck 2>&1 | head -40
```

If a test step fails, Vitest's `--run` output will list the failing test files
and assertion details.  Omit `--run` to enter watch mode:

```sh
pnpm --filter @hotel/api test
```

---

## Deferred CI extensions

| Phase | What it adds |
|-------|-------------|
| 18 | Playwright E2E smoke tests |
| 19 | Backend authz-matrix + API contract tests |
| 20 | Dependabot, Semgrep, gitleaks |
| 21 | k6 load baseline, Lighthouse CI |
