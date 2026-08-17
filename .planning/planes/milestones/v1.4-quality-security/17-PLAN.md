# Phase 17: CI/CD Gates — PLAN

**Phase:** 17
**Milestone:** v1.4 — Quality & Security Infrastructure
**Mode:** infrastructure
**Goal:** Every push and PR runs audit + typecheck + lint + tests via GitHub Actions. PRs to master require all checks green to merge.
**Trigger:** External QA audit (`documento_hallazgos_qa_seguridad.docx`) Sections 10/11/12 P2
**Depends on:** Nothing (first phase of v1.4)
**Requirements:** QSI-01, QSI-02, QSI-03, QSI-04

## Success Criteria

1. `.github/workflows/ci.yml` runs on push + PR with audit + per-workspace typecheck + lint + api/web tests
2. Fail-fast — single linear job, first error stops downstream
3. Branch protection documented in `.github/CONTRIBUTING.md` for manual admin setup
4. Cold-cache estimated 3-4 min, warm-cache 1.5-2 min (under 5 min target)

## Tasks

### Task 1: CI Workflow Definition
- Create `.github/workflows/ci.yml`
- Trigger: push to any branch + pull_request
- Jobs (linear, fail-fast):
  1. `pnpm install --frozen-lockfile`
  2. `pnpm audit --prod`
  3. Per-workspace typecheck (api, web, shared-kernel)
  4. Per-workspace lint
  5. Per-workspace tests (api, web)
- Use `actions/setup-node` with pnpm caching
- Node version: 20.x (LTS)

### Task 2: Branch Protection Documentation
- Create `.github/CONTRIBUTING.md`
- Document manual admin setup for branch protection on `master`:
  - Require status checks to pass before merging
  - Require branches to be up to date before merging
  - Include all CI check names

### Task 3: Performance Validation
- Run cold-cache CI manually and measure duration
- Verify warm-cache duration with subsequent runs
- Document actual timings in this plan

## Verification

- [ ] Push to any branch triggers CI workflow
- [ ] PR to master shows all checks
- [ ] Intentionally break a test → CI fails at test step, no downstream steps run
- [ ] Intentionally break typecheck → CI fails at typecheck step
- [ ] Cold-cache run completes under 5 minutes
- [ ] Warm-cache run completes under 2 minutes

## Files Created/Modified

- `.github/workflows/ci.yml` (new)
- `.github/CONTRIBUTING.md` (new)

## Sub-agent

`deployer`

## Commit

`e81e54b`
