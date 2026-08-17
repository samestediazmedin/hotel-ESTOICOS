# E2E Tests (Playwright)

End-to-end test suite for HotelOS AI web application.

## Prerequisites

1. **Node.js 20+** and **pnpm 10.29+**
2. **PostgreSQL** running with seeded data
3. **Chromium browser** installed for Playwright

### First-time setup

```bash
# From repo root
pnpm install

# Install Playwright browsers (chromium only)
cd apps/web
npx playwright install --with-deps chromium

# Seed the database (requires API env vars set)
cd ../api
pnpm seed:admin
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `E2E_ADMIN_EMAIL` | `admin@hotelsumapaz.co` | Admin user email for login tests |
| `E2E_ADMIN_PASSWORD` | `Admin123!` | Admin user password |
| `E2E_BASE_URL` | `http://localhost:4173` | Frontend URL (Vite preview) |
| `E2E_API_URL` | `http://localhost:3001` | API URL for direct API calls in fixtures |

## Running locally

### Option A: Production build (recommended, matches CI)

```bash
# 1. Build the frontend
pnpm --filter @hotel/web build

# 2. Start the API in a separate terminal
cd apps/api
pnpm dev

# 3. Run E2E tests (auto-starts Vite preview server)
cd apps/web
npx playwright test
```

### Option B: Against dev server

```bash
# 1. Start both API and Web dev servers
pnpm dev

# 2. Run E2E tests against the dev server
cd apps/web
E2E_BASE_URL=http://localhost:5180 npx playwright test
```

### Useful commands

```bash
# Run a specific test file
npx playwright test smoke-responsive

# Run in headed mode (see the browser)
npx playwright test --headed

# Run with Playwright UI (interactive debugger)
npx playwright test --ui

# List all tests without running them
npx playwright test --list

# View the HTML report after a run
npx playwright show-report
```

## Test files

| File | QSI | Description |
|---|---|---|
| `smoke-responsive.spec.ts` | QSI-06 | Public portal at 4 viewports: no horizontal scroll, hero visible, CTA reachable |
| `login-dashboard-logout.spec.ts` | QSI-07 | Full auth lifecycle: login form -> dashboard -> sidebar logout -> portal |
| `reservation-wizard.spec.ts` | QSI-08 | 4-step reservation wizard: open, navigate steps, close |
| `calendar-drag-to-move.spec.ts` | QSI-09 | Room rack DnD: draggable chips, grid cells, drag-and-drop interaction |
| `error-boundaries.spec.ts` | QSI-10 | Unknown routes, API failures: no white screens |

## CI behavior (QSI-11)

The E2E job runs in `.github/workflows/ci.yml` as a separate job (`e2e`) that
depends on the main `ci` job. It only triggers on pull requests to save CI
minutes on direct pushes to master.

Steps:
1. Checkout + install dependencies
2. Build the web app (`pnpm --filter @hotel/web build`)
3. Install Playwright chromium
4. Start a PostgreSQL service container
5. Run Prisma migrations + seed admin user
6. Start API + Vite preview in background
7. Run `npx playwright test`
8. Upload HTML report as artifact on failure

Retries: 1 retry on CI to absorb flakes. 0 retries locally.

## data-testid attributes

The following `data-testid` attributes were added to production components
for reliable E2E selection. Each is documented and minimal:

| Component | Attribute | Purpose |
|---|---|---|
| `RoomRackTable.tsx` | `data-testid="rack-grid"` | Outer grid container — verifies calendar rendered |
| `RoomRackTable.tsx` | `data-testid="rack-cell"` | Each day cell — drop target for DnD |
| `RoomRackTable.tsx` | `data-testid="rack-event-chip"` | Reservation chip — drag source for DnD |

## Troubleshooting

**Tests fail with "Login failed"**: Ensure the API is running and the admin
user is seeded with the credentials matching `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`.

**Vite preview shows blank page**: Run `pnpm --filter @hotel/web build` first.
The preview server serves the `dist/` directory which must exist.

**Drag-and-drop test skipped**: The calendar DnD test requires at least one
reservation in the current 30-day window. Seed reservations via `seed-phase12`
or create one manually.
