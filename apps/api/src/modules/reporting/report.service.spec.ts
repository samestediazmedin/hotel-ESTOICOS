/**
 * report.service.spec.ts — Phase 06 Plan 03
 *
 * TDD RED → GREEN tests for ReportService.
 * Tests cover: CSV format correctness, aggregate math, PDF buffer, audit log insertion.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ReportService } from './report.service';
import { ReportPdfService } from './pdf/report-pdf.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SystemConfigService } from '../../system-config/system-config.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeSnapshot(overrides: Partial<ReturnType<typeof baseSnapshot>> = {}) {
  return { ...baseSnapshot(), ...overrides };
}

function baseSnapshot() {
  return {
    id: 'snap-001',
    businessDate: new Date('2026-05-10T00:00:00.000Z'),
    totalRooms: 20,
    occupiedRooms: 15,
    occupancyPct: { toString: () => '0.7500' },
    adr: { toString: () => '185000.00' },
    revpar: { toString: () => '138750.00' },
    totalRevenue: { toString: () => '925000.00' },
    arrivalsCount: 5,
    departuresCount: 3,
    noShowCount: 0,
    createdAt: new Date(),
  };
}

const RANGE_7D = { startDate: '2026-05-10', endDate: '2026-05-16' };
const RANGE_EXACT_31 = { startDate: '2026-01-01', endDate: '2026-01-31' };
const RANGE_OVER_31 = { startDate: '2026-01-01', endDate: '2026-02-02' };

// ─── Service mocks ────────────────────────────────────────────────────────────

describe('ReportService', () => {
  let service: ReportService;
  let prismaMock: any;
  let systemConfigMock: any;
  let pdfServiceMock: any;

  beforeEach(async () => {
    prismaMock = {
      dailySnapshot: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      reportExportLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };

    systemConfigMock = {
      getHotelName: vi.fn().mockResolvedValue('Hotel Sumapaz'),
    };

    pdfServiceMock = {
      renderToBuffer: vi.fn().mockResolvedValue(Buffer.from('%PDF-TEST')),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SystemConfigService, useValue: systemConfigMock },
        { provide: ReportPdfService, useValue: pdfServiceMock },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
  });

  // ─── Test 2: CSV starts with UTF-8 BOM ────────────────────────────────────

  it('Test 2: buildCsv output starts with UTF-8 BOM (U+FEFF)', () => {
    const snapshots = [makeSnapshot()];
    const csv = service.buildCsv(snapshots as any);

    // BOM is the Unicode character U+FEFF — '﻿'
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  // ─── Test 3: CSV header exact match ───────────────────────────────────────

  it('Test 3: buildCsv header row matches locked spec exactly', () => {
    const csv = service.buildCsv([makeSnapshot()] as any);
    const lines = csv.split('\n');
    // lines[0] starts with BOM — strip BOM for header check
    const header = lines[0].replace(/^﻿/, '');
    expect(header).toBe('Fecha;OcupacionPct;ADR;RevPAR;Llegadas;Salidas;Ingresos');
  });

  // ─── Test 4: CSV occupancy formatting ────────────────────────────────────

  it('Test 4: buildCsv formats occupancyPct=0.75 as "75,00" (comma decimal, ×100)', () => {
    const snap = makeSnapshot({ occupancyPct: { toString: () => '0.7500' } });
    const csv = service.buildCsv([snap] as any);
    const dataLine = csv.split('\n')[1];
    const cols = dataLine.split(';');
    // Column index 1 = OcupacionPct
    expect(cols[1]).toBe('75,00');
  });

  // ─── Test 5a: aggregate — daysCount equals snapshot array length ──────────

  it('Test 5a: aggregate — totals.daysCount equals number of snapshots', async () => {
    const snaps = [makeSnapshot(), makeSnapshot({ id: 'snap-002' })];
    prismaMock.dailySnapshot.findMany.mockResolvedValue(snaps);

    const result = await service.aggregate(RANGE_7D);
    expect(result.totals.daysCount).toBe(2);
  });

  // ─── Test 5b: aggregate — totalRevenue sums correctly ───────────────────

  it('Test 5b: aggregate — totalRevenue = Math.round sum of 7 daily rows each at 925000', async () => {
    const snaps = Array.from({ length: 7 }, (_, i) =>
      makeSnapshot({ id: `snap-00${i}`, businessDate: new Date(`2026-05-${10 + i}T00:00:00.000Z`) }),
    );
    prismaMock.dailySnapshot.findMany.mockResolvedValue(snaps);

    const result = await service.aggregate(RANGE_7D);
    expect(result.totals.totalRevenue).toBe(Math.round(7 * 925000));
  });

  // ─── Test 5c: aggregate — avgOccupancyPct is average of 0..1 values ──────

  it('Test 5c: aggregate — avgOccupancyPct is arithmetic mean (0..1)', async () => {
    const s1 = makeSnapshot({ occupancyPct: { toString: () => '0.5000' } });
    const s2 = makeSnapshot({ id: 'snap-002', occupancyPct: { toString: () => '1.0000' } });
    prismaMock.dailySnapshot.findMany.mockResolvedValue([s1, s2]);

    const result = await service.aggregate(RANGE_7D);
    expect(result.totals.avgOccupancyPct).toBeCloseTo(0.75);
  });

  // ─── Test 6: PDF 31-day cap enforced ─────────────────────────────────────

  it('Test 6: generatePdfBuffer throws BadRequestException for range > 31 days', async () => {
    await expect(service.generatePdfBuffer(RANGE_OVER_31, 'user-001')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.generatePdfBuffer(RANGE_OVER_31, 'user-001')).rejects.toThrow(
      'El reporte PDF está limitado a 31 días',
    );
  });

  // ─── Test 6b: range exactly 31 days is allowed ───────────────────────────

  it('Test 6b: generatePdfBuffer allows range exactly 31 days', async () => {
    prismaMock.dailySnapshot.findMany.mockResolvedValue([]);
    await expect(service.generatePdfBuffer(RANGE_EXACT_31, 'user-001')).resolves.not.toThrow();
  });

  // ─── Test 7: PDF buffer starts with %PDF magic bytes ─────────────────────

  it('Test 7: generatePdfBuffer returns a Buffer (mocked renderToBuffer)', async () => {
    prismaMock.dailySnapshot.findMany.mockResolvedValue([makeSnapshot()]);
    const buf = await service.generatePdfBuffer(RANGE_7D, 'user-001');
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.toString().startsWith('%PDF')).toBe(true);
  });

  // ─── Test 8: audit log inserted after successful CSV generation ───────────

  it('Test 8: generateCsv inserts reportExportLog row with correct fields', async () => {
    const snaps = [makeSnapshot()];
    prismaMock.dailySnapshot.findMany.mockResolvedValue(snaps);

    await service.generateCsv(RANGE_7D, 'user-admin');

    expect(prismaMock.reportExportLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-admin',
        fromDate: new Date(RANGE_7D.startDate + 'T00:00:00.000Z'),
        toDate: new Date(RANGE_7D.endDate + 'T00:00:00.000Z'),
        format: 'csv',
        rowCount: snaps.length,
      }),
    });
  });

  // ─── Test 9: audit log inserted after successful PDF generation ───────────

  it('Test 9: generatePdfBuffer inserts reportExportLog row with format=pdf', async () => {
    prismaMock.dailySnapshot.findMany.mockResolvedValue([makeSnapshot()]);

    await service.generatePdfBuffer(RANGE_EXACT_31, 'user-manager');

    expect(prismaMock.reportExportLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-manager',
        format: 'pdf',
        rowCount: expect.any(Number),
      }),
    });
  });

  // ─── Test 10: Zod PdfReportSchema rejects non-YYYY-MM-DD ─────────────────

  it('Test 10a: PdfReportSchema rejects non-YYYY-MM-DD date', async () => {
    const { PdfReportSchema } = await import('./dto/report-export.dto');
    const result = PdfReportSchema.safeParse({ startDate: '05/01/2026', endDate: '05/31/2026' });
    expect(result.success).toBe(false);
  });

  it('Test 10b: PdfReportSchema rejects reversed range', async () => {
    const { PdfReportSchema } = await import('./dto/report-export.dto');
    const result = PdfReportSchema.safeParse({ startDate: '2026-05-31', endDate: '2026-05-01' });
    expect(result.success).toBe(false);
  });

  it('Test 10c: PdfReportSchema rejects range > 31 days with Spanish message', async () => {
    const { PdfReportSchema } = await import('./dto/report-export.dto');
    const result = PdfReportSchema.safeParse({ startDate: '2026-01-01', endDate: '2026-02-02' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const spanishError = result.error.issues.find((i) =>
        i.message.includes('31 días'),
      );
      expect(spanishError).toBeDefined();
    }
  });

  // ─── Test: CSV date format DD/MM/YYYY ─────────────────────────────────────

  it('CSV dates use DD/MM/YYYY format (UTC accessors)', () => {
    const snap = makeSnapshot({ businessDate: new Date('2026-05-10T00:00:00.000Z') });
    const csv = service.buildCsv([snap] as any);
    const dataLine = csv.split('\n')[1];
    expect(dataLine.startsWith('10/05/2026')).toBe(true);
  });

  // ─── Test: CSV uses semicolon delimiter ───────────────────────────────────

  it('CSV uses semicolon as field delimiter', () => {
    const csv = service.buildCsv([makeSnapshot()] as any);
    const dataLine = csv.split('\n')[1];
    const cols = dataLine.split(';');
    expect(cols).toHaveLength(7);
  });

  // ─── Test: aggregate returns empty totals when no snapshots ───────────────

  it('aggregate returns 0 totals when no snapshots found', async () => {
    prismaMock.dailySnapshot.findMany.mockResolvedValue([]);
    const result = await service.aggregate(RANGE_7D);
    expect(result.totals.daysCount).toBe(0);
    expect(result.totals.totalRevenue).toBe(0);
    expect(result.totals.avgOccupancyPct).toBe(0);
  });
});
