# Branch Protection Settings — HotelOS AI

> **Required settings for `master` branch** (manual configuration in GitHub UI).
> This file documents the intended configuration; it does NOT auto-apply settings.

## Required Checks (must pass before merge)

| Check | Workflow | Status |
|-------|----------|--------|
| Install → Audit → Typecheck → Lint → Test | `ci.yml` / `ci` job | ✅ Required |
| Security (Semgrep + gitleaks) | `ci.yml` / `security` job | ✅ Required |
| E2E (Playwright) | `ci.yml` / `e2e` job | ✅ Required (PR only) |

## Settings

### Branch: `master`

```
☑️ Require a pull request before merging
   ☐ Require approvals: 1
   ☐ Dismiss stale PR approvals when new commits are pushed
   ☐ Require review from Code Owners

☑️ Require status checks to pass before merging
   ☑️ Require branches to be up to date before merging
   Required checks:
     - ci (Install → Audit → Typecheck → Lint → Test)
     - security (Security — Semgrep + gitleaks)
     - e2e (E2E — Playwright)

☑️ Require conversation resolution before merging

☐ Require signed commits

☐ Require linear history

☐ Require deployments to succeed before merging

☐ Lock branch

☐ Do not allow bypassing the above settings
```

### Branch: `develop` (if used)

Same settings as `master` but with:
- `e2e` job optional (runs only on PRs to `master`)

## Notes

- **Lint step**: Currently `continue-on-error: true` due to 48 pre-existing ESLint errors in `apps/web`. Once resolved, remove `continue-on-error` from `ci.yml`.
- **E2E job**: Only runs on pull requests (not push to `master`) to save CI minutes.
- **Security job**: Runs in parallel with `ci` job — does not block the main feedback loop.

## How to Apply

1. Go to **Settings → Branches** in the GitHub repository
2. Click **Add rule** for `master`
3. Configure as documented above
4. Save changes

---
*Documented: 2026-06-17*
*Phase: 17 — CI/CD Gates*
