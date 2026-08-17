/**
 * throttle-burst.spec.ts — QSI-14: Throttling burst test.
 *
 * Verifies that rate-limited endpoints have correct throttle configuration:
 *
 * 1. POST /api/public/bookings — @Throttle({ short: { limit: 5, ttl: 60_000 } })
 * 2. POST /api/public/reviews  — @Throttle({ 'reviews-submit': { limit: 5, ttl: 3_600_000 } })
 * 3. POST /api/concierge/chat  — IpThrottlerGuard (20/hr per IP, via ThrottlerModule config)
 * 4. GET  /api/ai-assistant/stream — UserThrottlerGuard (30/hr per user, via ThrottlerModule config)
 *
 * Strategy: Read @Throttle decorator metadata and @UseGuards metadata from controller
 * methods/classes to verify the limit and ttl are correctly configured.
 * Also verifies staff endpoints are NOT rate-limited (W5 pattern).
 *
 * @nestjs/throttler@6.5.0 stores metadata using:
 *   Reflect.defineMetadata('THROTTLER:LIMIT' + name, limit, target)
 *   Reflect.defineMetadata('THROTTLER:TTL' + name, ttl, target)
 */

import { describe, it, expect } from 'vitest';

// ── All imports at top level (require() doesn't work with SWC) ──────────────

import { ThrottlerGuard } from '@nestjs/throttler';
import { PublicBookingController } from '../../modules/public-booking/public-booking.controller';
import { ReviewsPublicController } from '../../modules/reviews/reviews-public.controller';
import { ConciergeController } from '../../modules/concierge/concierge.controller';
import { AiAssistantController } from '../../modules/ai-assistant/ai-assistant.controller';
import { IpThrottlerGuard } from '../../modules/concierge/guards/ip-throttler.guard';
import { UserThrottlerGuard } from '../../modules/ai-assistant/guards/user-throttler.guard';
import { PublicPortalController } from '../../modules/public-portal/public-portal.controller';
import { InventoryController } from '../../modules/inventory/inventory.controller';
import { PricingController } from '../../modules/pricing/pricing.controller';
import { GuestsController } from '../../modules/guests/guests.controller';
import { ReservationsController } from '../../modules/reservations/reservations.controller';
import { OperationsController } from '../../modules/operations/operations.controller';
import { FolioController } from '../../modules/folio/folio.controller';
import { HousekeepingController } from '../../modules/housekeeping/housekeeping.controller';
import { AppModule } from '../../app.module';

// ─── Throttler metadata keys from @nestjs/throttler@6.5.0 ──────────────────

const THROTTLER_LIMIT = 'THROTTLER:LIMIT';
const THROTTLER_TTL = 'THROTTLER:TTL';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Throttle Configuration — QSI-14', () => {
  // ── POST /public/bookings ─────────────────────────────────────────────────

  describe('POST /public/bookings — @Throttle metadata', () => {
    it('has @Throttle with short: { limit: 5, ttl: 60000 }', () => {
      const method = PublicBookingController.prototype.createBooking;

      const limit = Reflect.getMetadata(THROTTLER_LIMIT + 'short', method);
      const ttl = Reflect.getMetadata(THROTTLER_TTL + 'short', method);

      expect(limit).toBe(5);
      expect(ttl).toBe(60_000);
    });

    it('ThrottlerGuard is applied at controller class level', () => {
      const guards = Reflect.getMetadata('__guards__', PublicBookingController) ?? [];
      const hasThrottler = guards.some(
        (g: any) => g === ThrottlerGuard || g?.name === 'ThrottlerGuard',
      );
      expect(hasThrottler).toBe(true);
    });
  });

  // ── POST /public/reviews ──────────────────────────────────────────────────

  describe('POST /public/reviews — @Throttle metadata', () => {
    it('has @Throttle with reviews-submit: { limit: 5, ttl: 3600000 }', () => {
      const method = ReviewsPublicController.prototype.submit;

      const limit = Reflect.getMetadata(THROTTLER_LIMIT + 'reviews-submit', method);
      const ttl = Reflect.getMetadata(THROTTLER_TTL + 'reviews-submit', method);

      expect(limit).toBe(5);
      expect(ttl).toBe(3_600_000);
    });

    it('ThrottlerGuard is applied at controller class level', () => {
      const guards = Reflect.getMetadata('__guards__', ReviewsPublicController) ?? [];
      const hasThrottler = guards.some(
        (g: any) => g === ThrottlerGuard || g?.name === 'ThrottlerGuard',
      );
      expect(hasThrottler).toBe(true);
    });
  });

  // ── POST /concierge/chat — IpThrottlerGuard ──────────────────────────────

  describe('POST /concierge/chat — IpThrottlerGuard', () => {
    it('IpThrottlerGuard is applied at method level on chat()', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        ConciergeController.prototype.chat,
      ) ?? [];
      const hasIpThrottler = guards.some(
        (g: any) => g === IpThrottlerGuard || g?.name === 'IpThrottlerGuard',
      );
      expect(hasIpThrottler).toBe(true);
    });

    it('IpThrottlerGuard tracker uses concierge: namespace prefix', async () => {
      const guard = new IpThrottlerGuard({} as any, {} as any, {} as any);
      const tracker = await (guard as any).getTracker({ ip: '10.0.0.1' });
      expect(tracker).toBe('concierge:10.0.0.1');
    });

    it('ConciergeModule registers ThrottlerModule in its imports', async () => {
      const { ConciergeModule } = await import(
        '../../modules/concierge/concierge.module'
      );
      const imports = Reflect.getMetadata('imports', ConciergeModule) ?? [];
      const throttlerImport = imports.find(
        (imp: any) => imp?.module?.name === 'ThrottlerModule',
      );
      expect(throttlerImport).toBeDefined();
    });
  });

  // ── GET /ai-assistant/stream — UserThrottlerGuard ─────────────────────────

  describe('GET /ai-assistant/stream — UserThrottlerGuard', () => {
    it('UserThrottlerGuard is applied at method level on stream()', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        AiAssistantController.prototype.stream,
      ) ?? [];
      const hasUserThrottler = guards.some(
        (g: any) => g === UserThrottlerGuard || g?.name === 'UserThrottlerGuard',
      );
      expect(hasUserThrottler).toBe(true);
    });

    it('UserThrottlerGuard tracker uses ai: namespace prefix', async () => {
      const guard = new UserThrottlerGuard({} as any, {} as any, {} as any);
      const tracker = await (guard as any).getTracker({
        user: { id: 'staff-001' },
        ip: '10.0.0.1',
      });
      expect(tracker).toBe('ai:staff-001');
    });

    it('AiAssistantModule registers ThrottlerModule in its imports', async () => {
      const { AiAssistantModule } = await import(
        '../../modules/ai-assistant/ai-assistant.module'
      );
      const imports = Reflect.getMetadata('imports', AiAssistantModule) ?? [];
      const throttlerImport = imports.find(
        (imp: any) => imp?.module?.name === 'ThrottlerModule',
      );
      expect(throttlerImport).toBeDefined();
    });
  });

  // ── GET /public/* (portal) — ThrottlerGuard (LOW-3 fix) ───────────────────

  describe('GET /public/* (portal) — ThrottlerGuard', () => {
    it('ThrottlerGuard is applied at PublicPortalController class level', () => {
      const guards = Reflect.getMetadata('__guards__', PublicPortalController) ?? [];
      const hasThrottler = guards.some(
        (g: any) => g === ThrottlerGuard || g?.name === 'ThrottlerGuard',
      );
      expect(hasThrottler).toBe(true);
    });
  });

  // ── Cross-cutting: staff endpoints do NOT have ThrottlerGuard ─────────────

  describe('Staff endpoints are NOT throttled (W5 pattern)', () => {
    const staffControllers: [string, any][] = [
      ['InventoryController',    InventoryController],
      ['PricingController',      PricingController],
      ['GuestsController',       GuestsController],
      ['ReservationsController', ReservationsController],
      ['OperationsController',   OperationsController],
      ['FolioController',        FolioController],
      ['HousekeepingController', HousekeepingController],
    ];

    it.each(staffControllers)(
      '%s does NOT have ThrottlerGuard at class level',
      (_name, controllerClass) => {
        const guards: any[] = Reflect.getMetadata('__guards__', controllerClass) ?? [];
        const hasThrottler = guards.some(
          (g: any) => g === ThrottlerGuard || g?.name === 'ThrottlerGuard',
        );
        expect(hasThrottler).toBe(false);
      },
    );
  });

  // ── Global ThrottlerModule config (AppModule) ─────────────────────────────

  describe('AppModule global throttle config', () => {
    it('imports ThrottlerModule with throttle configuration', () => {
      const imports = Reflect.getMetadata('imports', AppModule) ?? [];
      const throttlerImport = imports.find(
        (imp: any) => imp?.module?.name === 'ThrottlerModule',
      );
      expect(throttlerImport).toBeDefined();
    });

    it('ThrottlerGuard is NOT registered as APP_GUARD globally', () => {
      const providers: any[] = Reflect.getMetadata('providers', AppModule) ?? [];
      const hasGlobalThrottler = providers.some((p: any) => {
        if (typeof p === 'object' && p?.provide?.toString?.()?.includes('APP_GUARD')) {
          return true;
        }
        return false;
      });
      expect(hasGlobalThrottler).toBe(false);
    });
  });
});
