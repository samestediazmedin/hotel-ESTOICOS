import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SystemConfigService } from './system-config.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Mock config row ──────────────────────────────────────────────────────────

const MOCK_CONFIG = {
  id: 'cfg-1',
  hotelBusinessDate: new Date('2026-05-15T00:00:00.000Z'),
  hotelTimezone: 'America/Bogota',
  ivaRate: { toNumber: () => 0.19 },
  hotelName: 'Hotel Sumapaz',
  hotelLogoUrl: null,
  updatedAt: new Date(),
  displayPricesWithIva: true,
};

describe('SystemConfigService', () => {
  let service: SystemConfigService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      systemConfig: {
        findFirst: vi.fn().mockResolvedValue(MOCK_CONFIG),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      systemConfigChangeLog: {
        create: vi.fn().mockResolvedValue({}),
      },
      $executeRaw: vi.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemConfigService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<SystemConfigService>(SystemConfigService);
  });

  // ─── Test 1: advanceBusinessDateTx uses tx.$executeRaw ─────────────────────

  it('Test 1: advanceBusinessDateTx(tx) calls tx.$executeRaw exactly once', async () => {
    const txMock = { $executeRaw: vi.fn().mockResolvedValue(1) };

    await service.advanceBusinessDateTx(txMock as any);

    expect(txMock.$executeRaw).toHaveBeenCalledTimes(1);
  });

  // ─── Test 2: advanceBusinessDateTx does NOT call this.prisma.$executeRaw ───

  it('Test 2: advanceBusinessDateTx does NOT call this.prisma.$executeRaw', async () => {
    const txMock = { $executeRaw: vi.fn().mockResolvedValue(1) };

    await service.advanceBusinessDateTx(txMock as any);

    expect(prismaMock.$executeRaw).not.toHaveBeenCalled();
  });

  // ─── Test 3: existing advanceBusinessDate() still works (backward compat) ──

  it('Test 3: advanceBusinessDate() calls this.prisma.$executeRaw (backward compat)', async () => {
    await service.advanceBusinessDate();

    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1);
  });

  // ─── Bonus: getHotelName returns value from config ──────────────────────────

  it('getHotelName() returns hotelName from config', async () => {
    const name = await service.getHotelName();
    expect(name).toBe('Hotel Sumapaz');
  });

  // ─── 2026-05-29: displayPricesWithIva field ──────────────────────────────────

  it('update() includes displayPricesWithIva in the Prisma updateMany payload', async () => {
    // Return the updated config with the toggled value
    const updatedConfig = { ...MOCK_CONFIG, displayPricesWithIva: false };
    prismaMock.systemConfig.findFirst
      .mockResolvedValueOnce(MOCK_CONFIG)   // initial read
      .mockResolvedValueOnce(updatedConfig); // post-update read

    await service.update({ displayPricesWithIva: false }, 'user-1');

    expect(prismaMock.systemConfig.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ displayPricesWithIva: false }),
      }),
    );
  });

  it('update() does NOT include displayPricesWithIva when not in dto', async () => {
    prismaMock.systemConfig.findFirst
      .mockResolvedValueOnce(MOCK_CONFIG)
      .mockResolvedValueOnce(MOCK_CONFIG);

    await service.update({ name: 'Hotel Nuevo' }, 'user-1');

    const call = prismaMock.systemConfig.updateMany.mock.calls[0][0];
    expect(call.data).not.toHaveProperty('displayPricesWithIva');
  });
});
