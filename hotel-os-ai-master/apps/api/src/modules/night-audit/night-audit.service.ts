import {
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { addDays } from 'date-fns';
import { PrismaService } from '../../prisma/prisma.service';
import { SystemConfigService } from '../../system-config/system-config.service';
import { PricingService } from '../pricing/pricing.service';
import { ReviewsService } from '../reviews/reviews.service';

/**
 * ADVISORY_LOCK_KEY — stable integer key for pg_try_advisory_xact_lock.
 *
 * This key is derived from the UTF-8 encoding of "hotelOS-night-audit" (no collision
 * with PostgreSQL OID space in practice). Value documented here so any future
 * advisory lock in this codebase uses a different key.
 *
 * Key: 4827361 (arbitrary but stable — change only if another service collides)
 */
const ADVISORY_LOCK_BASE = 4827361n;

export interface NightAuditResult {
  skipped: boolean;
  businessDate: Date;
  openFoliosProcessed?: number;
  chargesPosted?: number;
  noShowsMarked?: number;
}

/**
 * NightAuditService — autonomous hotel accounting day cycle.
 *
 * Fires daily at 03:00 America/Bogotá via @Cron.
 * For each run:
 *  1. Idempotency check: if night_audit_runs row status=COMPLETED → no-op
 *  2. IVA rate validation: refuse to post if rate is 0 or null (P5)
 *  3. Advisory lock: pg_try_advisory_xact_lock prevents duplicate runs on Railway
 *  4. Post ROOM_CHARGE + TAX to every open folio with per-folio idempotency check
 *  5. Mark CONFIRMED reservations with checkInDate < businessDate as NO_SHOW
 *  6. Write DailySnapshot (occupancy metrics)
 *  7. Advance hotel_business_date by 1 day (raw SQL INTERVAL)
 *  8. Detect and alert if N > 1 days skipped (gap detection)
 */
@Injectable()
export class NightAuditService {
  private readonly logger = new Logger(NightAuditService.name);

  /** Cached system user ID — resolved once at first run (Q3 RESEARCH resolution). */
  private systemUserIdCache: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
    private readonly pricingService: PricingService,
    private readonly reviewsService: ReviewsService,
  ) {}

  // ─── Scheduled entry point ────────────────────────────────────────────────

  /**
   * scheduledNightAudit — cron trigger at 03:00 America/Bogotá daily.
   *
   * Colombia does NOT observe DST (permanently UTC-5). The timeZone option
   * adjusts Railway (UTC) container correctly — no DST edge cases ever.
   *
   * If hotel_business_date is not set, logs error and skips.
   */
  @Cron('0 3 * * *', { name: 'night-audit', timeZone: 'America/Bogota' })
  async scheduledNightAudit(): Promise<void> {
    const bd = await this.systemConfig.getHotelBusinessDate();
    if (!bd) {
      this.logger.error('No hotel_business_date configured — cannot run night audit');
      return;
    }
    await this.runForBusinessDate(bd);
    await this.detectAndAlertSkippedDays(bd);

    // Phase 14 — review invites (fire-and-forget, outside main $transaction)
    // Failures are caught + logged — they do NOT block night audit completion.
    // Failed reservations retain reviewInviteSentAt=null and are retried on next cron run.
    await this.reviewsService.sendPendingReviewInvites(bd).catch((err) => {
      this.logger.error('Review invite batch failed (non-critical)', err);
    });
  }

  // ─── Core run ─────────────────────────────────────────────────────────────

  /**
   * runForBusinessDate — main night audit logic.
   *
   * Can be called directly for backfill (POST /api/night-audit/backfill).
   * Idempotent: calling twice for the same date returns { skipped: true }.
   */
  async runForBusinessDate(businessDate: Date): Promise<NightAuditResult> {
    const dateStr = businessDate.toISOString().slice(0, 10);

    // Layer 1 idempotency: check night_audit_runs table BEFORE acquiring lock
    const existing = await this.prisma.nightAuditRun.findUnique({
      where: { businessDate },
    });
    if (existing?.status === 'COMPLETED') {
      this.logger.log(`Night audit ${dateStr} already COMPLETED — skipping (idempotency)`);
      return { skipped: true, businessDate };
    }

    // IVA rate validation (P5) — fail-fast before posting anything
    const ivaRate = await this.systemConfig.getIvaRate();
    if (!ivaRate || ivaRate <= 0) {
      const msg = `Invalid IVA rate: ${ivaRate} — refusing to post charges`;
      this.logger.error(msg);
      await this.prisma.nightAuditRun.upsert({
        where: { businessDate },
        create: { businessDate, status: 'FAILED', errorMessage: msg },
        update: { status: 'FAILED', errorMessage: msg },
      });
      throw new Error(msg);
    }

    // Resolve system user ID (cached after first call)
    const systemUserId = await this.resolveSystemUserId();

    // Upsert the run row as IN_PROGRESS
    const run = await this.prisma.nightAuditRun.upsert({
      where: { businessDate },
      create: { businessDate, status: 'IN_PROGRESS' },
      update: { status: 'IN_PROGRESS', errorMessage: null },
    });

    try {
      const txResult = await this.prisma.$transaction(async (tx) => {
        // Advisory lock — non-blocking, transaction-scoped
        // Lock key: date-derived bigint unique per calendar date
        const lockKey = ADVISORY_LOCK_BASE + BigInt(dateStr.replaceAll('-', ''));
        const [{ result: locked }] = await tx.$queryRaw<[{ result: boolean }]>`
          SELECT pg_try_advisory_xact_lock(${lockKey}::bigint) AS result
        `;
        if (!locked) {
          throw new ConflictException(
            `Night audit ${dateStr} already running on another instance — lock not acquired`,
          );
        }

        // Find all open folios
        const openFolios = await tx.folio.findMany({
          where: { isOpen: true },
          include: {
            reservation: {
              include: {
                room: true,
              },
            },
          },
        });

        let chargesPosted = 0;

        for (const folio of openFolios) {
          // Per-folio idempotency check (Layer 2 — handles partial-run recovery)
          const existingCharge = await tx.folioItem.count({
            where: {
              folioId: folio.id,
              type: 'ROOM_CHARGE',
              businessDate,
            },
          });
          if (existingCharge > 0) {
            this.logger.log(`Folio ${folio.id}: ROOM_CHARGE already posted for ${dateStr} — skipping`);
            continue;
          }

          await this.postNightCharges(tx, folio, businessDate, ivaRate, systemUserId);
          chargesPosted += 2; // ROOM_CHARGE + TAX
        }

        // NO_SHOW: mark CONFIRMED reservations with checkInDate < businessDate
        const { count: noShowsMarked } = await tx.reservation.updateMany({
          where: {
            status: 'CONFIRMED',
            checkInDate: { lt: businessDate },
          },
          data: { status: 'NO_SHOW' },
        });

        // Write DailySnapshot (NA-05) — real KPI computation (Phase 06-01)
        await this.writeDailySnapshot(tx, businessDate);

        // Advance business date INSIDE the transaction — ensures atomicity (W1 closed)
        await this.systemConfig.advanceBusinessDateTx(tx);

        return {
          openFoliosProcessed: openFolios.length,
          chargesPosted,
          noShowsMarked,
        };
      });

      // Mark run as COMPLETED
      await this.prisma.nightAuditRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          openFoliosProcessed: txResult.openFoliosProcessed,
          chargesPosted: txResult.chargesPosted,
          noShowsMarked: txResult.noShowsMarked,
        },
      });

      this.logger.log(
        `Night audit ${dateStr} COMPLETED — folios: ${txResult.openFoliosProcessed}, charges: ${txResult.chargesPosted}, no-shows: ${txResult.noShowsMarked}`,
      );

      return { skipped: false, businessDate, ...txResult };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await this.prisma.nightAuditRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', errorMessage },
      });
      throw err;
    }
  }

  // ─── Private: post night charges per folio ───────────────────────────────

  private async postNightCharges(
    tx: any,
    folio: any,
    businessDate: Date,
    ivaRate: number,
    systemUserId: string,
  ): Promise<void> {
    const r = folio.reservation;
    const dateStr = businessDate.toISOString().slice(0, 10);

    // Calculate nightly rate via PricingService (single-night calc)
    const breakdown = await this.pricingService.calculateBreakdown({
      roomTypeId: r.roomTypeId,
      checkIn: businessDate,
      checkOut: addDays(businessDate, 1),
    });

    const baseAmount = Math.round(breakdown.items[0].nightRate); // COP integer
    const taxAmount = Math.round(baseAmount * ivaRate);
    const ivaPct = Math.round(ivaRate * 100);

    // ROOM_CHARGE — taxRate=0 on this line (IVA is on its own separate line, FOL-06)
    await tx.folioItem.create({
      data: {
        folioId: folio.id,
        type: 'ROOM_CHARGE',
        description: `Habitación ${r.room?.number ?? 'N/A'} — ${dateStr}`,
        quantity: 1,
        unitPrice: baseAmount,
        amount: baseAmount,
        taxRate: 0,
        taxAmount: 0,
        postedByUserId: systemUserId,
        businessDate,
      },
    });

    // TAX — the IVA line (FOL-06 Colombia accounting practice)
    await tx.folioItem.create({
      data: {
        folioId: folio.id,
        type: 'TAX',
        description: `IVA ${ivaPct}% — ${dateStr}`,
        quantity: 1,
        unitPrice: taxAmount,
        amount: taxAmount,
        taxRate: ivaRate,
        taxAmount,
        postedByUserId: systemUserId,
        businessDate,
      },
    });
  }

  // ─── Private: write daily snapshot ───────────────────────────────────────

  /**
   * writeDailySnapshot — computes and persists real KPI metrics for the night audit date.
   *
   * All queries run inside the passed `tx` (Prisma transaction client) so a rollback
   * leaves daily_snapshots untouched. All COP amounts are Math.round integers.
   *
   * KPI formulas (Phase 06-01 — locked in RESEARCH):
   *  - occupiedRooms: CHECKED_IN reservations spanning businessDate (NOT openFoliosCount)
   *  - occupancyPct:  occupiedRooms / totalRooms  (Decimal 0..1, stored as 4dp)
   *  - adr:           roomChargeRevenue / occupiedRooms  (0 when occupancy=0)
   *  - revpar:        roomChargeRevenue / totalRooms      (0 when totalRooms=0)
   *  - totalRevenue:  ROOM_CHARGE + MANUAL_CHARGE (void-safe, businessDate-scoped)
   *  - arrivalsCount: CHECKED_IN with checkInDate = businessDate
   *  - departuresCount: CHECKED_OUT with checkOutDate = businessDate
   *  - noShowCount:   NO_SHOW with checkInDate = businessDate
   */
  private async writeDailySnapshot(
    tx: any,
    businessDate: Date,
  ): Promise<void> {
    try {
      // 1. Room denominators
      const totalRooms = await tx.room.count({ where: { isActive: true } });

      // 2. Occupied rooms — CHECKED_IN reservations spanning businessDate (closes W3)
      //    checkInDate <= businessDate < checkOutDate
      const occupiedRooms = await tx.reservation.count({
        where: {
          status: 'CHECKED_IN',
          checkInDate: { lte: businessDate },
          checkOutDate: { gt: businessDate },
        },
      });

      // 3. Occupancy % — Decimal(5,4): store 0..1
      const occupancyPct =
        totalRooms > 0
          ? Math.round((occupiedRooms / totalRooms) * 10000) / 10000
          : 0;

      // 4. ROOM_CHARGE revenue for the day (void-safe: voidedByEntryId = null)
      const roomChargeAgg = await tx.folioItem.aggregate({
        where: {
          type: 'ROOM_CHARGE',
          businessDate,
          voidedByEntryId: null,
        },
        _sum: { amount: true },
      });
      const roomChargeRevenue = Math.round(Number(roomChargeAgg._sum.amount ?? 0));

      // 5. ADR = roomChargeRevenue / occupiedRooms (0 if no occupancy — no division by zero)
      const adr = occupiedRooms > 0
        ? Math.round(roomChargeRevenue / occupiedRooms)
        : 0;

      // 6. RevPAR = roomChargeRevenue / totalRooms (0 if no rooms)
      const revpar = totalRooms > 0
        ? Math.round(roomChargeRevenue / totalRooms)
        : 0;

      // 7. Arrivals: CHECKED_IN with checkInDate = businessDate (arrived today)
      const arrivalsCount = await tx.reservation.count({
        where: { status: 'CHECKED_IN', checkInDate: businessDate },
      });

      // 8. Departures: CHECKED_OUT with checkOutDate = businessDate (left today)
      const departuresCount = await tx.reservation.count({
        where: { status: 'CHECKED_OUT', checkOutDate: businessDate },
      });

      // 9. No-shows: NO_SHOW with checkInDate = businessDate
      const noShowCount = await tx.reservation.count({
        where: { status: 'NO_SHOW', checkInDate: businessDate },
      });

      // 10. Total revenue: ROOM_CHARGE + MANUAL_CHARGE (void-safe)
      const totalRevenueAgg = await tx.folioItem.aggregate({
        where: {
          type: { in: ['ROOM_CHARGE', 'MANUAL_CHARGE'] },
          businessDate,
          voidedByEntryId: null,
        },
        _sum: { amount: true },
      });
      const totalRevenue = Math.round(Number(totalRevenueAgg._sum.amount ?? 0));

      // 11. Upsert snapshot (unique on businessDate)
      await tx.dailySnapshot.upsert({
        where: { businessDate },
        create: {
          businessDate,
          totalRooms,
          occupiedRooms,
          occupancyPct,
          adr,
          revpar,
          totalRevenue,
          arrivalsCount,
          departuresCount,
          noShowCount,
        },
        update: {
          totalRooms,
          occupiedRooms,
          occupancyPct,
          adr,
          revpar,
          totalRevenue,
          arrivalsCount,
          departuresCount,
          noShowCount,
        },
      });
    } catch (err) {
      // Snapshot failure does NOT abort the audit (non-critical — can be recomputed)
      this.logger.warn(
        `DailySnapshot write failed for ${businessDate.toISOString().slice(0, 10)}: ${err}`,
      );
    }
  }

  // ─── Gap detection ────────────────────────────────────────────────────────

  /**
   * detectAndAlertSkippedDays — called after successful run.
   *
   * If the last COMPLETED run was > 1 day before currentBusinessDate,
   * emits a gap alert (email to ADMIN users + Logger.error).
   * Email is OUTSIDE the main $transaction (fire-and-forget, per RESEARCH pattern).
   */
  async detectAndAlertSkippedDays(currentBusinessDate: Date): Promise<void> {
    const lastRun = await this.prisma.nightAuditRun.findFirst({
      where: { status: 'COMPLETED' },
      orderBy: { businessDate: 'desc' },
    });

    if (!lastRun) return;

    const currentStr = currentBusinessDate.toISOString().slice(0, 10);
    const lastStr = lastRun.businessDate.toISOString().slice(0, 10);

    // Date diff using string comparison (P6 — safe for ISO date strings)
    const currentMs = new Date(currentStr + 'T00:00:00.000Z').getTime();
    const lastMs = new Date(lastStr + 'T00:00:00.000Z').getTime();
    const gapDays = Math.round((currentMs - lastMs) / 86_400_000);

    if (gapDays > 1) {
      this.logger.error(
        `Night audit gap detected: ${gapDays} days since last completed run (${lastStr} → ${currentStr})`,
      );
      await this.emitGapAlert({ lastRunDate: lastStr, currentDate: currentStr, gapDays });
    }
  }

  /**
   * emitGapAlert — override in tests; in production sends Resend email to ADMIN users.
   * Fire-and-forget: NOT inside any $transaction.
   */
  protected async emitGapAlert(payload: {
    lastRunDate: string;
    currentDate: string;
    gapDays: number;
  }): Promise<void> {
    this.logger.error(
      `GAP ALERT: Night audit not run for ${payload.gapDays} days. Last: ${payload.lastRunDate}, now: ${payload.currentDate}`,
    );
    // Post-MVP: send Resend email to all ADMIN users (Q2 from RESEARCH)
    // For MVP: Logger.error is sufficient (Sentry deferred per RESEARCH section 7)
  }

  // ─── Utility: resolve system user ID ────────────────────────────────────

  /**
   * resolveSystemUserId — first active ADMIN user (by createdAt ASC) serves as
   * the system user for night audit charges (Q3 from RESEARCH 3.3).
   *
   * Cached at first call — the ADMIN user is stable for the lifetime of the process.
   * folio_items.postedByUserId is NOT NULL, so we MUST resolve a real user.
   */
  private async resolveSystemUserId(): Promise<string> {
    if (this.systemUserIdCache) return this.systemUserIdCache;

    const adminUser = await this.prisma.user.findFirst({
      where: { role: 'ADMIN', isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!adminUser) {
      throw new Error(
        'No active ADMIN user found — cannot resolve systemUserId for night audit charges',
      );
    }

    this.systemUserIdCache = adminUser.id;
    return this.systemUserIdCache;
  }
}
