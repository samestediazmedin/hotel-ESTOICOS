import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SystemConfigService } from '../../system-config/system-config.service';
import type { DashboardDto } from './dto/dashboard.dto';
import type { DateRangeDto } from './dto/date-range.dto';

/**
 * DashboardService — provides KPI read endpoints for Phase 06 reporting.
 *
 * All reads are against the live DB (no caching in v1):
 *  - getDashboard():       latest DailySnapshot + live room/task counts
 *  - getDailySnapshots():  date-range rows from daily_snapshots (ordered ASC)
 *  - getRoomStatus():      live counts by physicalStatus + cleaningStatus
 *
 * No write operations — this service is purely read-only.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  // ─── GET /api/reports/dashboard ──────────────────────────────────────────

  /**
   * getDashboard — returns the latest daily_snapshot row for the current
   * hotel business date, combined with live room/housekeeping counts.
   *
   * snapshot is null when the night audit has not yet run for today
   * (new hotel, or audit not yet triggered). The frontend must handle this.
   */
  async getDashboard(): Promise<DashboardDto> {
    const businessDate = await this.systemConfig.getHotelBusinessDate();
    if (!businessDate) {
      return this.emptyDashboard('1970-01-01');
    }

    const snapshotRow = await this.prisma.dailySnapshot.findUnique({
      where: { businessDate },
    });

    // Live counts — all in parallel for performance
    const [
      roomsInCleaning,
      activeServiceRequests,
      occupied,
      outOfService,
      onHold,
      cleaningCount,
      available,
    ] = await Promise.all([
      // Rooms currently being cleaned (any dirty/active cleaning state)
      this.prisma.room.count({
        where: {
          isActive: true,
          cleaningStatus: { in: ['DIRTY', 'IN_PROGRESS', 'INSPECTION'] },
        },
      }),
      // Active housekeeping tasks (OPEN or IN_PROGRESS)
      this.prisma.housekeepingTask.count({
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
      }),
      // Physical occupancy
      this.prisma.room.count({
        where: { isActive: true, physicalStatus: 'OCCUPIED' },
      }),
      this.prisma.room.count({
        where: { isActive: true, physicalStatus: 'OUT_OF_SERVICE' },
      }),
      this.prisma.room.count({
        where: { isActive: true, physicalStatus: 'ON_HOLD' },
      }),
      // Cleaning breakdown (mirrors roomsInCleaning above — same query, could dedupe)
      this.prisma.room.count({
        where: {
          isActive: true,
          cleaningStatus: { in: ['DIRTY', 'IN_PROGRESS', 'INSPECTION'] },
        },
      }),
      // Truly available: AVAILABLE physical status AND CLEAN cleaning status
      this.prisma.room.count({
        where: {
          isActive: true,
          physicalStatus: 'AVAILABLE',
          cleaningStatus: 'CLEAN',
        },
      }),
    ]);

    return {
      businessDate: businessDate.toISOString().slice(0, 10),
      snapshot: snapshotRow
        ? {
            occupancyPct: Number(snapshotRow.occupancyPct),
            adr: Math.round(Number(snapshotRow.adr)),
            revpar: Math.round(Number(snapshotRow.revpar)),
            totalRevenue: Math.round(Number(snapshotRow.totalRevenue)),
            arrivalsCount: snapshotRow.arrivalsCount,
            departuresCount: snapshotRow.departuresCount,
            noShowCount: snapshotRow.noShowCount,
          }
        : null,
      liveKpis: {
        roomsInCleaning,
        activeServiceRequests,
        roomStatusBreakdown: {
          occupied,
          cleaning: cleaningCount,
          maintenance: outOfService + onHold,
          available,
        },
      },
    };
  }

  // ─── GET /api/reports/daily-snapshots ────────────────────────────────────

  /**
   * getDailySnapshots — returns DailySnapshot rows for the given date range.
   *
   * Ordered by businessDate ASC (chronological) for chart rendering.
   * Used by the occupancy trend chart (Plan 06-02).
   */
  async getDailySnapshots(range: DateRangeDto) {
    const startDate = new Date(range.startDate + 'T00:00:00.000Z');
    const endDate = new Date(range.endDate + 'T00:00:00.000Z');

    return this.prisma.dailySnapshot.findMany({
      where: {
        businessDate: { gte: startDate, lte: endDate },
      },
      orderBy: { businessDate: 'asc' },
    });
  }

  // ─── GET /api/reports/room-status ─────────────────────────────────────────

  /**
   * getRoomStatus — live room counts grouped by operational status.
   *
   * Returns 5 counts used by the donut chart (Plan 06-02):
   *  - occupied:    physicalStatus = OCCUPIED
   *  - reserved:    physicalStatus = ON_HOLD (reserved, awaiting arrival)
   *  - cleaning:    cleaningStatus IN [DIRTY, IN_PROGRESS, INSPECTION]
   *  - maintenance: physicalStatus = OUT_OF_SERVICE
   *  - available:   physicalStatus = AVAILABLE AND cleaningStatus = CLEAN
   *
   * Plan-check W3: explicit Promise.all with 5 counts.
   */
  async getRoomStatus() {
    const [occupied, reserved, cleaning, maintenance, available] =
      await Promise.all([
        this.prisma.room.count({
          where: { isActive: true, physicalStatus: 'OCCUPIED' },
        }),
        this.prisma.room.count({
          where: { isActive: true, physicalStatus: 'ON_HOLD' },
        }),
        this.prisma.room.count({
          where: {
            isActive: true,
            cleaningStatus: { in: ['DIRTY', 'IN_PROGRESS', 'INSPECTION'] },
          },
        }),
        this.prisma.room.count({
          where: { isActive: true, physicalStatus: 'OUT_OF_SERVICE' },
        }),
        this.prisma.room.count({
          where: {
            isActive: true,
            physicalStatus: 'AVAILABLE',
            cleaningStatus: 'CLEAN',
          },
        }),
      ]);

    return { occupied, reserved, cleaning, maintenance, available };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private emptyDashboard(dateStr: string): DashboardDto {
    return {
      businessDate: dateStr,
      snapshot: null,
      liveKpis: {
        roomsInCleaning: 0,
        activeServiceRequests: 0,
        roomStatusBreakdown: { occupied: 0, cleaning: 0, maintenance: 0, available: 0 },
      },
    };
  }
}
