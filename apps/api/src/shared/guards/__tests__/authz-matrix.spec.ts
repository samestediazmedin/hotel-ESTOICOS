/**
 * authz-matrix.spec.ts — QSI-12: Table-driven authz matrix for every staff endpoint x role.
 *
 * Strategy: Use Reflect.getMetadata to read @Roles() from each controller method.
 * This tests the DECORATOR CONFIGURATION (the source of truth for RBAC) rather than
 * doing HTTP-level integration tests. If a @Roles() decorator is missing or misconfigured,
 * this test fails — catching silent privilege escalation at the unit level.
 *
 * For endpoints that use class-level @Roles (e.g., OperationsController, FolioController),
 * we test both the class and method-level metadata to verify the merged set.
 *
 * Controllers out of scope:
 * - PublicPortalController (no guards, public)
 * - PublicBookingController (no JwtAuthGuard, public)
 * - ReviewsPublicController (no JwtAuthGuard, public)
 * - ConciergeController (no JwtAuthGuard, public)
 * - ConciergePublicCsrfController (no guards, public)
 *
 * Note on ReportingController: dashboard/daily-snapshots/room-status have JwtAuthGuard
 * but NO @Roles — any authenticated user is allowed. The operations/export endpoints
 * have @Roles('ADMIN', 'MANAGER') applied at method level via @UseGuards(RolesGuard).
 *
 * Note on ReviewsAdminController: JwtAuthGuard + RolesGuard at class level but NO @Roles
 * at any level — RolesGuard passes when requiredRoles is empty (allows any authenticated user).
 *
 * Note on AiAssistantController: JwtAuthGuard at class level, NO RolesGuard, NO @Roles —
 * any authenticated staff member can use the AI assistant.
 */

import { describe, it, expect } from 'vitest';
import { ROLES_KEY } from '../../decorators/roles.decorator';

// ─── Staff controllers (RBAC-protected) ──────────────────────────────────────

import { InventoryController } from '../../../modules/inventory/inventory.controller';
import { PhotosController } from '../../../modules/inventory/photos/photos.controller';
import { PricingController } from '../../../modules/pricing/pricing.controller';
import { GuestsController } from '../../../modules/guests/guests.controller';
import { ReservationsController } from '../../../modules/reservations/reservations.controller';
import { OperationsController } from '../../../modules/operations/operations.controller';
import { NightAuditController } from '../../../modules/night-audit/night-audit.controller';
import { FolioController } from '../../../modules/folio/folio.controller';
import { TRAExportController } from '../../../modules/tra-export/tra-export.controller';
import { HousekeepingController } from '../../../modules/housekeeping/housekeeping.controller';
import { ReportingController } from '../../../modules/reporting/reporting.controller';
import { AiAssistantController } from '../../../modules/ai-assistant/ai-assistant.controller';
import { ConciergeAdminController } from '../../../modules/concierge/admin/concierge-admin.controller';
import { ConciergePhotosController } from '../../../modules/concierge/photos/concierge-photos.controller';
import { HotelPhotosController } from '../../../modules/hotel-photos/hotel-photos.controller';
import { ReviewsAdminController } from '../../../modules/reviews/reviews-admin.controller';
import { GuestContactController } from '../../../modules/guest-contact/guest-contact.controller';

// ─── All 4 staff roles ───────────────────────────────────────────────────────

const ALL_ROLES = ['ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING'] as const;
type Role = (typeof ALL_ROLES)[number];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolves the effective allowed roles for a controller method.
 * Checks method-level @Roles first, then falls back to class-level @Roles.
 * Returns null if NO @Roles decorator exists (any authenticated user allowed).
 */
function getEffectiveRoles(
  controllerClass: any,
  methodName: string,
): string[] | null {
  const instance = controllerClass.prototype;
  const methodFn = instance[methodName];
  if (!methodFn) throw new Error(`Method ${methodName} not found on ${controllerClass.name}`);

  // Method-level roles take priority
  const methodRoles = Reflect.getMetadata(ROLES_KEY, methodFn);
  if (Array.isArray(methodRoles) && methodRoles.length > 0) {
    return methodRoles;
  }

  // Fall back to class-level roles
  const classRoles = Reflect.getMetadata(ROLES_KEY, controllerClass);
  if (Array.isArray(classRoles) && classRoles.length > 0) {
    return classRoles;
  }

  // No @Roles at all — any authenticated user is allowed
  return null;
}

/**
 * Matrix entry: [controllerClass, methodName, httpMethod, path, allowedRoles].
 * allowedRoles = null means "any authenticated user" (no @Roles restriction).
 */
type MatrixEntry = [any, string, string, string, Role[] | null];

// ─── THE MATRIX ──────────────────────────────────────────────────────────────
//
// Single source of truth: every staff endpoint x expected allowed roles.
// Extracted by reading @Roles decorators from the controller source code.

const AUTHZ_MATRIX: MatrixEntry[] = [
  // ── InventoryController ──────────────────────────────────────────────────
  [InventoryController, 'findAllRoomTypes',  'GET',   '/inventory/room-types',         ['ADMIN', 'MANAGER', 'RECEPTION']],
  [InventoryController, 'createRoomType',    'POST',  '/inventory/room-types',         ['ADMIN', 'MANAGER']],
  [InventoryController, 'findRoomType',      'GET',   '/inventory/room-types/:id',     ['ADMIN', 'MANAGER', 'RECEPTION']],
  [InventoryController, 'updateRoomType',    'PATCH', '/inventory/room-types/:id',     ['ADMIN', 'MANAGER']],
  [InventoryController, 'deactivateRoomType','POST',  '/inventory/room-types/:id/deactivate', ['ADMIN', 'MANAGER']],
  [InventoryController, 'activateRoomType',  'POST',  '/inventory/room-types/:id/activate',   ['ADMIN', 'MANAGER']],
  [InventoryController, 'findAvailableRooms','GET',   '/inventory/rooms/available',    ['ADMIN', 'MANAGER', 'RECEPTION']],
  [InventoryController, 'findAllRooms',      'GET',   '/inventory/rooms',              ['ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING']],
  [InventoryController, 'createRoom',        'POST',  '/inventory/rooms',              ['ADMIN', 'MANAGER']],
  [InventoryController, 'findRoom',          'GET',   '/inventory/rooms/:id',          ['ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING']],
  [InventoryController, 'updateRoom',        'PATCH', '/inventory/rooms/:id',          ['ADMIN', 'MANAGER']],
  [InventoryController, 'updateRoomStatus',  'PATCH', '/inventory/rooms/:id/status',   ['ADMIN', 'MANAGER', 'RECEPTION']],
  [InventoryController, 'deactivateRoom',    'POST',  '/inventory/rooms/:id/deactivate', ['ADMIN', 'MANAGER']],
  [InventoryController, 'activateRoom',      'POST',  '/inventory/rooms/:id/activate',   ['ADMIN', 'MANAGER']],

  // ── PhotosController (inventory room photos) ────────────────────────────
  [PhotosController, 'getPhotos', 'GET',    '/inventory/rooms/:roomId/photos',          ['ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING']],
  [PhotosController, 'upload',    'POST',   '/inventory/rooms/:roomId/photos',          ['ADMIN', 'MANAGER', 'RECEPTION']],
  [PhotosController, 'delete',    'DELETE', '/inventory/rooms/:roomId/photos/:photoId', ['ADMIN', 'MANAGER']],

  // ── PricingController ────────────────────────────────────────────────────
  [PricingController, 'findAllRatePlans',    'GET',    '/pricing/rate-plans',                    ['ADMIN', 'MANAGER', 'RECEPTION']],
  [PricingController, 'createRatePlan',      'POST',   '/pricing/rate-plans',                    ['ADMIN', 'MANAGER']],
  [PricingController, 'findRatePlan',        'GET',    '/pricing/rate-plans/:id',                ['ADMIN', 'MANAGER', 'RECEPTION']],
  [PricingController, 'updateRatePlan',      'PATCH',  '/pricing/rate-plans/:id',                ['ADMIN', 'MANAGER']],
  [PricingController, 'deactivateRatePlan',  'POST',   '/pricing/rate-plans/:id/deactivate',     ['ADMIN', 'MANAGER']],
  [PricingController, 'findExtras',          'GET',    '/pricing/rate-plans/:id/extras',         ['ADMIN', 'MANAGER', 'RECEPTION']],
  [PricingController, 'createExtra',         'POST',   '/pricing/rate-plans/:id/extras',         ['ADMIN', 'MANAGER']],
  [PricingController, 'updateExtra',         'PATCH',  '/pricing/extras/:extraId',               ['ADMIN', 'MANAGER']],
  [PricingController, 'deleteExtra',         'DELETE', '/pricing/extras/:extraId',               ['ADMIN', 'MANAGER']],
  [PricingController, 'findSeasons',         'GET',    '/pricing/seasons',                       ['ADMIN', 'MANAGER', 'RECEPTION']],
  [PricingController, 'createSeason',        'POST',   '/pricing/seasons',                       ['ADMIN', 'MANAGER']],
  [PricingController, 'updateSeason',        'PATCH',  '/pricing/seasons/:id',                   ['ADMIN', 'MANAGER']],
  [PricingController, 'deleteSeason',        'DELETE', '/pricing/seasons/:id',                   ['ADMIN', 'MANAGER']],
  [PricingController, 'calculatePrice',      'GET',    '/pricing/calculate',                     ['ADMIN', 'MANAGER', 'RECEPTION']],

  // ── GuestsController ─────────────────────────────────────────────────────
  [GuestsController, 'findAll',    'GET',   '/guests',              ['ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING']],
  [GuestsController, 'findOne',    'GET',   '/guests/:id',          ['ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING']],
  [GuestsController, 'create',     'POST',  '/guests',              ['ADMIN', 'MANAGER', 'RECEPTION']],
  [GuestsController, 'update',     'PATCH', '/guests/:id',          ['ADMIN', 'MANAGER', 'RECEPTION']],
  [GuestsController, 'getHistory', 'GET',   '/guests/:id/history',  ['ADMIN', 'MANAGER', 'RECEPTION']],
  [GuestsController, 'anonymize',  'POST',  '/guests/:id/anonymize',['ADMIN']],

  // ── ReservationsController ───────────────────────────────────────────────
  [ReservationsController, 'searchAvailability', 'GET',   '/reservations/availability',    ['ADMIN', 'MANAGER', 'RECEPTION']],
  [ReservationsController, 'findAll',            'GET',   '/reservations',                 ['ADMIN', 'MANAGER', 'RECEPTION']],
  [ReservationsController, 'findOne',            'GET',   '/reservations/:id',             ['ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING']],
  [ReservationsController, 'create',             'POST',  '/reservations',                 ['ADMIN', 'MANAGER', 'RECEPTION']],
  [ReservationsController, 'modify',             'PATCH', '/reservations/:id',             ['ADMIN', 'MANAGER', 'RECEPTION']],
  [ReservationsController, 'cancel',             'POST',  '/reservations/:id/cancel',      ['ADMIN', 'MANAGER', 'RECEPTION']],

  // ── OperationsController (class-level @Roles) ───────────────────────────
  [OperationsController, 'checkIn',  'POST', '/operations/reservations/:id/check-in',  ['ADMIN', 'MANAGER', 'RECEPTION']],
  [OperationsController, 'checkOut', 'POST', '/operations/reservations/:id/check-out', ['ADMIN', 'MANAGER', 'RECEPTION']],

  // ── NightAuditController ─────────────────────────────────────────────────
  [NightAuditController, 'backfill', 'POST', '/night-audit/backfill', ['ADMIN', 'MANAGER']],
  [NightAuditController, 'runNow',   'POST', '/night-audit/run-now',  ['ADMIN']],

  // ── FolioController (class-level @Roles) ─────────────────────────────────
  [FolioController, 'getFolio',        'GET',  '/folios/:id',                    ['ADMIN', 'MANAGER', 'RECEPTION']],
  [FolioController, 'downloadFolioPdf','GET',  '/folios/:id/pdf',                ['ADMIN', 'MANAGER', 'RECEPTION']],
  [FolioController, 'postCharge',      'POST', '/folios/:id/charges',            ['ADMIN', 'MANAGER', 'RECEPTION']],
  [FolioController, 'voidCharge',      'POST', '/folios/:id/items/:itemId/void', ['ADMIN', 'MANAGER', 'RECEPTION']],

  // ── TRAExportController ──────────────────────────────────────────────────
  [TRAExportController, 'exportCsv', 'GET', '/tra-export', ['ADMIN', 'MANAGER']],

  // ── HousekeepingController ───────────────────────────────────────────────
  [HousekeepingController, 'listRoomsForBoard',       'GET',   '/housekeeping/rooms/board',              ['ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING']],
  [HousekeepingController, 'transitionCleaningStatus', 'PATCH', '/housekeeping/rooms/:id/cleaning-status',['ADMIN', 'MANAGER', 'HOUSEKEEPING']],
  [HousekeepingController, 'listTasks',                'GET',   '/housekeeping/tasks',                    ['ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING']],
  [HousekeepingController, 'createTask',               'POST',  '/housekeeping/tasks',                    ['ADMIN', 'MANAGER']],
  [HousekeepingController, 'updateTaskStatus',         'PATCH', '/housekeeping/tasks/:id/status',         ['ADMIN', 'MANAGER', 'HOUSEKEEPING']],

  // ── ReportingController — mixed: some no-roles, some ADMIN/MANAGER ──────
  [ReportingController, 'getDashboard',      'GET', '/reports/dashboard',               null],
  [ReportingController, 'getDailySnapshots', 'GET', '/reports/daily-snapshots',          null],
  [ReportingController, 'getRoomStatus',     'GET', '/reports/room-status',              null],
  [ReportingController, 'getOperations',     'GET', '/reports/operations',               ['ADMIN', 'MANAGER']],
  [ReportingController, 'exportCsv',         'GET', '/reports/operations/export/csv',    ['ADMIN', 'MANAGER']],
  [ReportingController, 'exportPdf',         'GET', '/reports/operations/export/pdf',    ['ADMIN', 'MANAGER']],

  // ── AiAssistantController — JwtAuthGuard only, no roles restriction ─────
  [AiAssistantController, 'stream', 'GET',  '/ai-assistant/stream',             null],
  [AiAssistantController, 'list',   'GET',  '/ai-assistant/conversations',      null],
  [AiAssistantController, 'load',   'GET',  '/ai-assistant/conversations/:id',  null],
  [AiAssistantController, 'create', 'POST', '/ai-assistant/conversations',      null],

  // ── ConciergeAdminController (class-level @Roles('ADMIN')) ──────────────
  [ConciergeAdminController, 'list',      'GET',    '/admin/concierge/venues',        ['ADMIN']],
  [ConciergeAdminController, 'create',    'POST',   '/admin/concierge/venues',        ['ADMIN']],
  [ConciergeAdminController, 'update',    'PATCH',  '/admin/concierge/venues/:id',    ['ADMIN']],
  [ConciergeAdminController, 'disable',   'DELETE', '/admin/concierge/venues/:id',    ['ADMIN']],
  [ConciergeAdminController, 'importCsv', 'POST',   '/admin/concierge/venues/import', ['ADMIN']],

  // ── ConciergePhotosController (class-level @Roles('ADMIN')) ─────────────
  [ConciergePhotosController, 'upload',  'POST',   '/admin/concierge/venues/:id/photos',          ['ADMIN']],
  [ConciergePhotosController, 'delete',  'DELETE', '/admin/concierge/venues/:id/photo',           ['ADMIN']],

  // ── HotelPhotosController (all ADMIN-only) ──────────────────────────────
  [HotelPhotosController, 'list',    'GET',    '/admin/hotel-photos',         ['ADMIN']],
  [HotelPhotosController, 'upload',  'POST',   '/admin/hotel-photos',         ['ADMIN']],
  [HotelPhotosController, 'reorder', 'PATCH',  '/admin/hotel-photos/reorder', ['ADMIN']],
  [HotelPhotosController, 'delete',  'DELETE', '/admin/hotel-photos/:id',     ['ADMIN']],

  // ── ReviewsAdminController — JwtAuthGuard + RolesGuard but NO @Roles ────
  [ReviewsAdminController, 'queue',    'GET',   '/reviews',              null],
  [ReviewsAdminController, 'moderate', 'PATCH', '/reviews/:id/moderate', null],

  // ── GuestContactController ──────────────────────────────────────────────
  [GuestContactController, 'create', 'POST', '/guests/:id/contact-events', ['ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING']],
  [GuestContactController, 'list',   'GET',  '/guests/:id/contact-events', ['ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING']],
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Authz Matrix — QSI-12', () => {
  describe.each(AUTHZ_MATRIX)(
    '%s.prototype.%s — %s %s',
    (controllerClass, methodName, httpMethod, path, allowedRoles) => {
      const effectiveRoles = getEffectiveRoles(controllerClass, methodName);

      if (allowedRoles === null) {
        // Endpoint has NO @Roles restriction — any authenticated user is allowed.
        it('allows any authenticated user (no @Roles restriction)', () => {
          expect(effectiveRoles).toBeNull();
        });
      } else {
        // Verify the exact set of allowed roles
        it(`allows exactly [${allowedRoles.join(', ')}]`, () => {
          expect(effectiveRoles).not.toBeNull();
          expect(effectiveRoles!.sort()).toEqual([...allowedRoles].sort());
        });

        // For each role, verify access or denial
        for (const role of ALL_ROLES) {
          const shouldAllow = allowedRoles.includes(role);
          it(`${shouldAllow ? 'ALLOWS' : 'DENIES'} ${role}`, () => {
            if (shouldAllow) {
              expect(effectiveRoles).toContain(role);
            } else {
              expect(effectiveRoles).not.toContain(role);
            }
          });
        }
      }
    },
  );

  // ── Summary: ensure matrix covers a meaningful number of endpoints ──────
  it(`matrix covers at least 50 endpoint x role combinations`, () => {
    let combos = 0;
    for (const [, , , , roles] of AUTHZ_MATRIX) {
      if (roles === null) {
        // All 4 roles are implicitly allowed
        combos += ALL_ROLES.length;
      } else {
        combos += ALL_ROLES.length; // we test both allow + deny for each role
      }
    }
    expect(combos).toBeGreaterThanOrEqual(50);
  });
});
