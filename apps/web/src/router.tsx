import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/reporting/DashboardPage';
import { UsersPage } from '@/features/admin/UsersPage';
import { StaffLayout } from '@/components/layout/StaffLayout';
import { useAuthStore } from '@/features/auth/auth.store';
import { useRestoreSession } from '@/features/auth/useRestoreSession';

/**
 * ProtectedRoute — G3 fix (Phase 2)
 *
 * Reads isRestoring and accessToken from the Zustand store.
 *
 * Flow on hard refresh:
 *  1. isRestoring starts as true — show loading state (no premature redirect)
 *  2. useRestoreSession (called in AppWrapper) hits POST /auth/refresh
 *  3a. Success → setAccessToken + setIsRestoring(false) → renders children
 *  3b. Failure → setIsRestoring(false) → accessToken still null → Navigate to /
 *
 * Cannot receive dynamic props because it lives inside createBrowserRouter array.
 * Store is the single channel for state.
 *
 * UX rule (2026-05-22): Unauthenticated users redirected to public portal,
 * NOT to /login. Login is reachable only via Staff button or direct URL.
 */
function ProtectedRoute() {
  const isRestoring = useAuthStore((s) => s.isRestoring);
  const accessToken = useAuthStore((s) => s.accessToken);

  if (isRestoring) {
    return (
      <div className="h-screen bg-warm-paper flex items-center justify-center">
        <span className="text-ink-3 text-sm">Restaurando sesión...</span>
      </div>
    );
  }

  return accessToken ? <Outlet /> : <Navigate to="/" replace />;
}

/**
 * AppWrapper — root component above RouterProvider
 *
 * Calls useRestoreSession once on mount before any route renders.
 * This is the only place the hook should be called.
 */
function AppWrapper() {
  useRestoreSession();
  return <Outlet />;
}

// ─── Dev-only routes (tree-shaken in production by Vite) ────────────────────
import { DesignSystemPage } from '@/features/design-system/DesignSystemPage';
const devRoutes = import.meta.env.DEV
  ? [{ path: '/design-system', element: <DesignSystemPage /> }]
  : [];

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppWrapper />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
      // ─── Public portal routes — wrapped in PublicPortalShell ─────────────
      // Shell provides: ConciergeFab (floating button) + ConciergeDrawer
      // (slide-over) on ALL public pages, driven by the zustand store.
      {
        element: <PublicPortalShell />,
        children: [
          {
            path: '/',
            element: <HotelHomePage />,
          },
          // ─── Public concierge chat (NO auth required) ──────────────────
          {
            path: '/concierge',
            element: (
              <PublicConciergeLayout>
                <ConciergePage />
              </PublicConciergeLayout>
            ),
          },
          // ─── Public booking routes (NO auth required) ──────────────────
          // These MUST be outside ProtectedRoute — anonymous visitors use these.
          {
            path: '/booking',
            element: <HotelHomePage />,
          },
          {
            path: '/booking/rooms',
            element: <BookingResultsPage />,
          },
          {
            path: '/booking/checkout',
            element: <BookingFormPage />,
          },
          {
            path: '/booking/confirmation',
            element: <BookingConfirmationPage />,
          },
          // ─── Public review submission (NO auth required) ────────────────
          // Guest arrives from post-checkout email link: /review/submit?token=...
          // Must be OUTSIDE ProtectedRoute — anonymous guests use this.
          {
            path: '/review/submit',
            element: <ReviewSubmitPage />,
          },
        ],
      },
      // ─── Dev-only design system demo (not mounted in production) ─────────
      ...devRoutes,
      // ─── Staff PMS routes (auth required) ───────────────────────────────
      {
        path: '/',
        element: <ProtectedRoute />,
        children: [
          {
            // StaffLayout provides the persistent Sidebar for all PMS pages (Phase 6)
            element: <StaffLayout />,
            children: [
              {
                path: 'dashboard',
                element: <DashboardPage />,
              },
              {
                path: 'users',
                element: <UsersPage />,
              },
              {
                path: 'room-types',
                element: <RoomTypesPage />,
              },
              {
                path: 'rooms',
                element: <RoomsPage />,
              },
              {
                path: 'pricing/rate-plans',
                element: <RatePlansPage />,
              },
              {
                path: 'pricing/seasons',
                element: <SeasonsPage />,
              },
              {
                path: 'guests',
                element: <GuestsPage />,
              },
              {
                path: 'guests/:id',
                element: <GuestDetailPage />,
              },
              {
                path: 'reservations',
                element: <ReservationsPage />,
              },
              {
                path: 'folios/:reservationId',
                element: <FolioPage />,
              },
              {
                path: 'admin/night-audit',
                element: <NightAuditPage />,
              },
              {
                path: 'admin/tra-export',
                element: <TraExportPage />,
              },
              {
                path: 'front-desk',
                element: <FrontDeskPage />,
              },
              {
                path: 'housekeeping',
                element: <HousekeepingPage />,
              },
              {
                path: 'reportes',
                element: <ReportExportPage />,
              },
              {
                path: 'admin/concierge/venues',
                element: <VenuesPage />,
              },
              {
                path: 'settings/hotel',
                element: <HotelSettingsPage />,
              },
              {
                path: 'reviews',
                element: <ReviewsModeratorPage />,
              },
              {
                path: 'offers',
                element: <OffersAdminPage />,
              },
            ],
          },
        ],
      },
      // Unknown URLs → friendly 404 (2026-06-02). Home link goes to public
      // portal (NOT login) — login stays reachable only via Staff button.
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);

// Lazy imports at module level to avoid circular — these are imported after router
// is defined so they can reference the router shape.
import { RoomTypesPage } from '@/features/inventory/RoomTypesPage';
import { RoomsPage } from '@/features/inventory/RoomsPage';
import { RatePlansPage } from '@/features/pricing/RatePlansPage';
import { SeasonsPage } from '@/features/pricing/SeasonsPage';
import { GuestsPage } from '@/features/guests/GuestsPage';
import { GuestDetailPage } from '@/features/guests/GuestDetailPage';
import { ReservationsPage } from '@/features/reservations/ReservationsPage';
// Public portal — HotelHomePage replaces BookingPage at / and /booking (Phase 10)
import { HotelHomePage } from '@/features/public-portal';
// Public booking pages (no auth — imported after router to avoid circular refs)
import { BookingResultsPage } from '@/features/public-booking/BookingResultsPage';
import { BookingFormPage } from '@/features/public-booking/BookingFormPage';
import { BookingConfirmationPage } from '@/features/public-booking/BookingConfirmationPage';
import { FolioPage } from '@/features/operations/FolioPage';
import { NightAuditPage } from '@/features/admin/NightAuditPage';
import { TraExportPage } from '@/features/admin/TraExportPage';
import { FrontDeskPage } from '@/features/operations/FrontDeskPage';
import { HousekeepingPage } from '@/features/housekeeping/HousekeepingPage';
import { ReportExportPage } from '@/features/reporting/ReportExportPage';
// Public concierge + admin catalog (Phase 08-03)
import { PublicConciergeLayout } from '@/layouts/PublicConciergeLayout';
import { PublicPortalShell } from '@/layouts/PublicPortalShell';
import { ConciergePage } from '@/features/concierge/ConciergePage';
import { VenuesPage } from '@/features/concierge-admin/VenuesPage';
import { HotelSettingsPage } from '@/features/settings/HotelSettingsPage';
// Public review submission (Phase 14-03)
import ReviewSubmitPage from '@/features/review-submit/ReviewSubmitPage';
// Staff moderation queue (Phase 14-05)
import ReviewsModeratorPage from '@/features/reviews-admin/ReviewsModeratorPage';
// Admin offers (2026-05-28)
import { OffersAdminPage } from '@/features/offers-admin/OffersAdminPage';
// Friendly 404 for unknown routes (2026-06-02)
import { NotFoundPage } from '@/features/not-found/NotFoundPage';
