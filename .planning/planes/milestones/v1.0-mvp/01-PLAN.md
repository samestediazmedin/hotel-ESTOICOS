# Phase 1: Foundation — PLAN

**Phase:** 01
**Milestone:** v1.0 — MVP
**Mode:** mvp
**UI hint:** yes (login screen)
**Goal:** Staff can authenticate with correct roles and the complete database schema — including all critical constraints — exists in production before any feature is written
**Depends on:** Nothing (first phase)
**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, INF-01, INF-02, INF-03, INF-04, INF-05, DSN-01, DSN-02
**Completed:** 2026-05-14

## Success Criteria

1. A staff user can log in with email and password and receive a JWT; the access token expires and the refresh token rotation issues a new pair without re-login
2. An admin can create a user, assign a role (admin, manager, reception, housekeeping), and deactivate that user from the admin panel
3. An endpoint protected by `JwtGuard + RolesGuard` returns 401 for unauthenticated requests and 403 for authenticated requests with insufficient role
4. The initial Prisma migration runs cleanly on Railway PostgreSQL, the `btree_gist` extension is enabled, the `system_config` table exists with `hotel_business_date`, `hotel_timezone`, and `iva_rate` columns, and `DATABASE_URL` has `connection_limit=5`
5. The shared-kernel value objects (`Money`, `DateRange`, branded IDs, `DomainEvent` base class) are importable by any module with no circular dependencies
6. The design system tokens (colors, typography, spacing) from `design/DESIGN-SYSTEM.md` are codified as Tailwind config + CSS variables, importable from any screen, and the login screen renders using them

## Plans

### Plan 01-01: Monorepo and Database
**File:** `01-PLAN-01-monorepo-and-db.md`
**Status:** DONE

**Tasks:**
1. Turborepo scaffold with `apps/api` and `apps/web`
2. Prisma 7 full schema with all tables, relations, and constraints
3. Enable `btree_gist` extension in PostgreSQL
4. Create `system_config` table with `hotel_business_date`, `hotel_timezone`, `iva_rate`
5. Shared-kernel value objects:
   - `Money` class with COP currency handling
   - `DateRange` class with validation
   - Branded IDs (e.g., `RoomId`, `ReservationId`)
   - `DomainEvent` base class
6. Database connection with `connection_limit=5`
7. Initial migration for Railway PostgreSQL

**Verification:**
- [ ] `pnpm dev` starts both API and web
- [ ] Prisma migration runs cleanly
- [ ] `btree_gist` extension enabled
- [ ] `system_config` table exists with required columns
- [ ] Shared-kernel imports work without circular dependencies

### Plan 01-02: Auth Backend
**File:** `01-PLAN-02-auth-backend.md`
**Status:** DONE

**Tasks:**
1. JWT auth with access token (short-lived) and refresh token (long-lived)
2. Refresh token rotation — new pair issued without re-login
3. `JwtAuthGuard` — validates JWT signature and expiry
4. `RolesGuard` — checks role against endpoint metadata
5. User CRUD endpoints (admin only for create/update/delete)
6. Rate limiter on auth endpoints
7. Seed script for admin user (`seed:admin`)
8. Password hashing with bcrypt

**Verification:**
- [ ] Login returns access + refresh tokens
- [ ] Access token expires correctly
- [ ] Refresh token rotation works
- [ ] 401 for missing/invalid JWT
- [ ] 403 for wrong role
- [ ] Admin can create user with role
- [ ] Rate limiter blocks brute force

### Plan 01-03: Design and Auth UI
**File:** `01-PLAN-03-design-and-auth-ui.md`
**Status:** DONE

**Tasks:**
1. Design tokens codified as Tailwind config + CSS variables
2. `tokens.ts` with token definitions
3. `@theme inline` for Tailwind v4
4. Login screen with email/password form
5. Auth store (Zustand) with token management
6. Admin users UI — user list, create, edit, deactivate
7. Walking skeleton E2E test

**Verification:**
- [ ] Login screen renders with design tokens
- [ ] Auth store persists tokens
- [ ] Admin panel shows user list
- [ ] Can create user with role
- [ ] Can deactivate user
- [ ] E2E test passes

## Files Created/Modified

- `apps/api/prisma/schema.prisma` (new)
- `apps/api/prisma/migrations/` (new)
- `apps/api/src/shared-kernel/` (new)
- `apps/api/src/auth/` (new)
- `apps/api/src/users/` (new)
- `apps/web/src/features/auth/` (new)
- `apps/web/src/features/admin/` (new)
- `apps/web/src/stores/auth.store.ts` (new)
- `apps/web/src/lib/tokens.ts` (new)

## Tests

- API: Auth tests (login, refresh, guards, roles)
- Web: Login form tests, auth store tests
- E2E: Walking skeleton

## Sub-agent

`olaf`

## Commit

`[initial]`
