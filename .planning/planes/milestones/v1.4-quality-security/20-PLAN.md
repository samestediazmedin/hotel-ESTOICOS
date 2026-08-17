# Phase 20: Security Automation — PLAN

**Phase:** 20
**Milestone:** v1.4 — Quality & Security Infrastructure
**Mode:** infrastructure
**Goal:** Dependabot + Semgrep + AI abuse + secrets sweep all run in CI.
**Trigger:** External QA audit — need automated security scanning
**Depends on:** Phase 17 (CI workflow exists)
**Requirements:** QSI-16, QSI-17, QSI-18, QSI-19

## Success Criteria

1. `.github/dependabot.yml` weekly PRs for npm + GitHub Actions
2. Semgrep CI step on p/security-audit + p/typescript; HIGH blocks PR, MEDIUM/LOW comment
3. AI abuse fixtures test prompt-injection on staff AI + Concierge IA; any execution failure fails CI
4. gitleaks / Trufflehog scans every PR diff for secrets; documented allowlist

## Tasks

### Task 1: Dependabot Configuration
- Create `.github/dependabot.yml`
- Weekly schedule for npm ecosystem
- Weekly schedule for github-actions ecosystem
- Limit to 5 open PRs per ecosystem
- Target branch: master
- Label: "dependencies"

### Task 2: Semgrep Integration
- Add Semgrep step to `.github/workflows/ci.yml`
- Rulesets: `p/security-audit` + `p/typescript`
- Block PR on HIGH/ERROR findings
- Comment on MEDIUM/LOW findings (non-blocking)
- Upload SARIF results to GitHub Security tab

### Task 3: AI Abuse Fixtures
- Create 8 prompt-injection fixtures shared between:
  - Staff AI assistant (Phase 7)
  - Concierge IA (Phase 8)
- 21 sanitization tests (always-run):
  - Input validation
  - Output encoding
  - Context isolation
- 17 pipeline tests (cost-gated via `RUN_AI_ABUSE_TESTS=1`):
  - Actual LLM calls with injection payloads
  - Assert no data leakage
  - Assert no tool misuse
- Tests located in `apps/api/src/modules/ai-assistant/__tests__/abuse/` and `apps/api/src/modules/concierge/__tests__/abuse/`

### Task 4: Secrets Scanning
- Add gitleaks action to CI
- Create `.gitleaks.toml` allowlist with 5 path patterns:
  - Test fixtures
  - Mock data
  - Example configs
  - Documentation
  - Local dev files
- Scan every PR diff for secrets
- Fail on findings (except allowlisted paths)

## Verification

- [ ] Dependabot creates PR for outdated dependency
- [ ] Semgrep detects HIGH severity → blocks PR
- [ ] AI abuse tests: 21 always-run pass, 17 cost-gated pass with flag
- [ ] gitleaks catches fake secret in test commit
- [ ] Allowlisted paths are ignored correctly

## Files Created/Modified

- `.github/dependabot.yml` (new)
- `.github/workflows/ci.yml` (modified — add Semgrep + gitleaks)
- `.gitleaks.toml` (new)
- `apps/api/src/modules/ai-assistant/__tests__/abuse/` (new — 21 tests)
- `apps/api/src/modules/ai-assistant/__tests__/abuse/pipeline/` (new — 17 tests)
- `apps/api/src/modules/concierge/__tests__/abuse/` (new — shared fixtures)

## Sub-agent

`mia`

## Commit

`882bf67`
