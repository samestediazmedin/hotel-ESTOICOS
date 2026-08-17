# Phase 19: Backend Coverage Gaps — PLAN

**Phase:** 19
**Milestone:** v1.4 — Quality & Security Infrastructure
**Mode:** infrastructure
**Goal:** Close test coverage gaps — authz matrix, API contracts, throttling burst, regression for refresh race.
**Trigger:** External QA audit — need comprehensive backend test coverage
**Depends on:** Phase 17 (CI workflow exists)
**Requirements:** QSI-12, QSI-13, QSI-14, QSI-15

## Success Criteria

1. Authz matrix — 82 endpoints × 4 roles = 328 combinations with 200/403 assertions
2. API contract test verifies every controller returns consistent error shape on 4xx/5xx
3. Throttling burst test fires N+1 requests against booking/reviews/concierge and asserts 1×429
4. Concurrent /auth/refresh race test — 5 concurrent same-cookie calls produce 1×200 + 4×401, never 500

## Tasks

### Task 1: Authz Matrix Test
- `apps/api/src/shared/guards/__tests__/authz-matrix.spec.ts`
- Enumerate all 82 staff endpoints from all controllers
- Test each endpoint with 4 roles: ADMIN, MANAGER, RECEPTION, HOUSEKEEPING
- Assert 200 for allowed, 403 for forbidden
- Use supertest with NestJS testing module
- Generate report of uncovered endpoints

### Task 2: API Contract Test
- `apps/api/src/shared/__tests__/api-contract.spec.ts`
- Test every controller for consistent error envelope:
  - `statusCode`, `message`, `error` fields present
  - Same shape for 400, 401, 403, 404, 409, 500
- Test with invalid payloads, missing auth, wrong roles
- POST /public/bookings included (note: may flake under full-suite load)

### Task 3: Throttle Burst Test
- `apps/api/src/shared/__tests__/throttle-burst.spec.ts`
- Fire N+1 requests (where N = limit) against:
  - POST /api/public/bookings
  - POST /api/public/reviews
  - POST /api/public/concierge/chat
- Assert exactly 1×429 response
- Assert remaining N requests succeed
- Verify rate limit headers present

### Task 4: Refresh Race Regression Test
- `apps/api/src/auth/__tests__/refresh-race-regression.spec.ts`
- 5 concurrent requests with same refresh cookie
- Assert: 1×200 (new token pair), 4×401 (token already used)
- Assert: never 500, never 2×200
- Test both sequential and parallel execution patterns

## Verification

- [ ] Authz matrix: 328 assertions all pass
- [ ] API contract: all controllers tested
- [ ] Throttle burst: 429 returned correctly
- [ ] Refresh race: 1×200 + 4×401 pattern verified
- [ ] All tests pass in CI
- [ ] Total: 408 tests added

## Files Created/Modified

- `apps/api/src/shared/guards/__tests__/authz-matrix.spec.ts` (new)
- `apps/api/src/shared/__tests__/api-contract.spec.ts` (new)
- `apps/api/src/shared/__tests__/throttle-burst.spec.ts` (new)
- `apps/api/src/auth/__tests__/refresh-race-regression.spec.ts` (new)

## Security Finding (Carry-Forward)

`NightAuditController` and `TRAExportController` use `@Controller('api/night-audit')` with `api` prefix already global → routes are at `/api/api/...`. Routing defect, not security vuln. File as HIGH priority carry-forward.

## Sub-agent

`mia`

## Commit

`f08e3d7`
