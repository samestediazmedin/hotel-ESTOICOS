/**
 * reporting.controller.spec.ts — Phase 06 Plans 01 + 03
 *
 * Tests for ReportingController (Plan 06-01 endpoints + Plan 06-03 export endpoints).
 *
 * NOTE: Reflects.getMetadata(ROLES_KEY, fn) — on the function object directly.
 * SetMetadata stores metadata on the decorated function, NOT on the prototype key.
 * (Confirmed in Phase 04-04 SUMMARY — same pattern as TRAExportController spec)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ReportingController } from './reporting.controller';
import { DashboardService } from './dashboard.service';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { ROLES_KEY } from '../../shared/decorators/roles.decorator';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_DASHBOARD = {
  businessDate: '2026-05-15',
  snapshot: null,
  liveKpis: {
    roomsInCleaning: 2,
    activeServiceRequests: 1,
    roomStatusBreakdown: { occupied: 5, cleaning: 2, maintenance: 0, available: 13 },
  },
};

const MOCK_ROOM_STATUS = {
  occupied: 5,
  cleaning: 2,
  maintenance: 0,
  available: 13,
};

const MOCK_OPERATIONS_REPORT = {
  range: { startDate: '2026-05-01', endDate: '2026-05-07' },
  totals: {
    totalRevenue: 6475000,
    avgOccupancyPct: 0.75,
    avgAdr: 185000,
    avgRevpar: 138750,
    totalArrivals: 35,
    totalDepartures: 28,
    daysCount: 7,
  },
  daily: [],
};

const MOCK_USER = { id: 'user-admin-001', role: 'ADMIN' };

// ─── Test module setup ────────────────────────────────────────────────────────

describe('ReportingController', () => {
  let controller: ReportingController;
  let dashboardServiceMock: any;
  let reportServiceMock: any;

  beforeEach(async () => {
    dashboardServiceMock = {
      getDashboard: vi.fn().mockResolvedValue(MOCK_DASHBOARD),
      getDailySnapshots: vi.fn().mockResolvedValue([]),
      getRoomStatus: vi.fn().mockResolvedValue(MOCK_ROOM_STATUS),
    };

    reportServiceMock = {
      aggregate: vi.fn().mockResolvedValue(MOCK_OPERATIONS_REPORT),
      getSnapshotsForRange: vi.fn().mockResolvedValue([]),
      buildCsv: vi.fn().mockReturnValue('﻿test-csv'),
      generatePdfBuffer: vi.fn().mockResolvedValue(Buffer.from('%PDF-TEST')),
      csvFilename: vi.fn().mockReturnValue('reporte.csv'),
      pdfFilename: vi.fn().mockReturnValue('reporte.pdf'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportingController],
      providers: [
        { provide: DashboardService, useValue: dashboardServiceMock },
        { provide: ReportService, useValue: reportServiceMock },
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ReportingController>(ReportingController);
  });

  // ─── Plan 06-01 tests (regression) ───────────────────────────────────────

  it('Test 1: GET /reports/dashboard delegates to DashboardService.getDashboard()', async () => {
    const result = await controller.getDashboard();
    expect(dashboardServiceMock.getDashboard).toHaveBeenCalledTimes(1);
    expect(result).toEqual(MOCK_DASHBOARD);
  });

  it('Test 2: GET /reports/daily-snapshots calls getDailySnapshots with parsed range', async () => {
    const result = await controller.getDailySnapshots({
      startDate: '2026-05-01',
      endDate: '2026-05-15',
    });
    expect(dashboardServiceMock.getDailySnapshots).toHaveBeenCalledWith({
      startDate: '2026-05-01',
      endDate: '2026-05-15',
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it('Test 3: GET /reports/daily-snapshots throws 400 when startDate > endDate', () => {
    expect(() =>
      controller.getDailySnapshots({ startDate: '2026-05-15', endDate: '2026-05-01' }),
    ).toThrow(BadRequestException);
    expect(dashboardServiceMock.getDailySnapshots).not.toHaveBeenCalled();
  });

  it('Test 4: GET /reports/daily-snapshots throws 400 when date format is invalid', () => {
    expect(() =>
      controller.getDailySnapshots({ startDate: 'not-a-date', endDate: '2026-05-15' } as any),
    ).toThrow(BadRequestException);
  });

  it('Test 5: GET /reports/room-status delegates to DashboardService.getRoomStatus()', async () => {
    const result = await controller.getRoomStatus();
    expect(dashboardServiceMock.getRoomStatus).toHaveBeenCalledTimes(1);
    expect(result).toEqual(MOCK_ROOM_STATUS);
  });

  it('Test 6: ReportingController has JwtAuthGuard in __guards__ metadata', () => {
    const guards = Reflect.getMetadata('__guards__', ReportingController);
    const hasJwtGuard =
      Array.isArray(guards) && guards.some((g) => g === JwtAuthGuard || g?.name === 'JwtAuthGuard');
    expect(hasJwtGuard).toBe(true);
  });

  it('Test 7: ReportingController has NO @Roles decorator at class level (any authenticated user may read)', () => {
    const roles = Reflect.getMetadata('roles', ReportingController);
    expect(roles).toBeUndefined();
  });

  // ─── Plan 06-03 tests — RBAC on export endpoints ─────────────────────────

  it('Test 8: getOperations has @Roles ADMIN and MANAGER', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, controller.getOperations);
    expect(Array.isArray(roles)).toBe(true);
    expect(roles).toContain('ADMIN');
    expect(roles).toContain('MANAGER');
    expect(roles).toHaveLength(2);
  });

  it('Test 9: exportCsv has @Roles ADMIN and MANAGER', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, controller.exportCsv);
    expect(Array.isArray(roles)).toBe(true);
    expect(roles).toContain('ADMIN');
    expect(roles).toContain('MANAGER');
    expect(roles).toHaveLength(2);
  });

  it('Test 10: exportPdf has @Roles ADMIN and MANAGER', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, controller.exportPdf);
    expect(Array.isArray(roles)).toBe(true);
    expect(roles).toContain('ADMIN');
    expect(roles).toContain('MANAGER');
    expect(roles).toHaveLength(2);
  });

  // ─── Plan 06-03 tests — getOperations delegates to ReportService ─────────

  it('Test 11: getOperations calls report.aggregate with parsed dates', async () => {
    const result = await controller.getOperations({ startDate: '2026-05-01', endDate: '2026-05-07' });
    expect(reportServiceMock.aggregate).toHaveBeenCalledWith({
      startDate: '2026-05-01',
      endDate: '2026-05-07',
    });
    expect(result).toEqual(MOCK_OPERATIONS_REPORT);
  });

  it('Test 12: getOperations throws 400 when date params are invalid', async () => {
    await expect(controller.getOperations({ startDate: 'bad', endDate: '2026-05-07' } as any))
      .rejects.toThrow(BadRequestException);
  });
});
