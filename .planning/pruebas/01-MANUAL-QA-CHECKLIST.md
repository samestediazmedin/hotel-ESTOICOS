# Phase 1: Foundation — MANUAL QA CHECKLIST

**Phase:** 01
**Milestone:** v1.0 — MVP
**Date:** 2026-05-14
**Tester:** _____________

## Pre-conditions

- [ ] PostgreSQL database running (local or Railway)
- [ ] Prisma CLI installed
- [ ] Node.js 20+ and pnpm installed

---

## Scenarios

### Scenario 1: Database Migration
**Steps:**
1. Run `pnpm prisma migrate dev`
2. Check `btree_gist` extension: `SELECT * FROM pg_extension WHERE extname = 'btree_gist';`
3. Verify `system_config` table exists
4. Check columns: `hotel_business_date`, `hotel_timezone`, `iva_rate`

**Expected:**
- Migration runs without errors
- `btree_gist` extension enabled
- `system_config` table with all 3 columns
- `connection_limit=5` in `DATABASE_URL`

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 2: Shared Kernel Imports
**Steps:**
1. Import `Money` from shared-kernel in any module
2. Import `DateRange` from shared-kernel
3. Import branded IDs (e.g., `RoomId`)
4. Import `DomainEvent` base class

**Expected:**
- All imports work without circular dependency errors
- TypeScript compilation succeeds
- Classes instantiable with correct types

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 3: JWT Authentication
**Steps:**
1. POST `/api/auth/login` with valid credentials
2. Verify response contains `accessToken` and `refreshToken`
3. Use `accessToken` to call protected endpoint
4. Wait for token expiry
5. Use `refreshToken` to get new pair

**Expected:**
- Login returns both tokens
- Protected endpoint accessible with valid token
- Expired token returns 401
- Refresh returns new pair without re-login

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 4: Role-Based Access Control
**Steps:**
1. Create user with ADMIN role
2. Create user with HOUSEKEEPING role
3. Call admin-only endpoint with ADMIN token → 200
4. Call admin-only endpoint with HOUSEKEEPING token → 403
5. Call endpoint without token → 401

**Expected:**
- ADMIN accesses admin endpoints
- HOUSEKEEPING gets 403 on admin endpoints
- Unauthenticated gets 401
- `JwtGuard + RolesGuard` working

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 5: User CRUD
**Steps:**
1. Login as ADMIN
2. Create new user with RECEPTION role
3. Edit user email
4. Deactivate user
5. List all users

**Expected:**
- User created successfully
- Edit persists
- Deactivated user cannot login
- List shows all users with roles

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 6: Design Tokens
**Steps:**
1. Open login screen
2. Inspect colors with DevTools
3. Verify colors come from CSS variables
4. Check typography (headings, body, numbers)
5. Verify spacing tokens

**Expected:**
- No hardcoded hex values in components
- Colors from `var(--token-name)`
- Typography matches design system
- Spacing consistent

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 7: Admin Users UI
**Steps:**
1. Login as ADMIN
2. Navigate to Users page
3. Create user via UI form
4. Assign role from dropdown
5. Deactivate user via toggle

**Expected:**
- Form validates inputs
- Role dropdown shows all roles
- User appears in list after creation
- Deactivate toggle works
- Success toast shown

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

## Regression Checks

- [ ] API server starts without errors
- [ ] Web dev server starts without errors
- [ ] Login page renders correctly
- [ ] All API tests pass
- [ ] All web tests pass

---

## Sign-off

**Tester:** _________________________________
**Date:** _________________________________
**Verdict:** ☐ APPROVED ☐ REJECTED

**Blockers (if rejected):**
_________________________________
_________________________________
_________________________________
