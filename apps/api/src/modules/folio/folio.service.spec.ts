import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { FolioService } from './folio.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SystemConfigService } from '../../system-config/system-config.service';
import { computeFolioChecksum } from './checksum';

// ─── Test helpers ─────────────────────────────────────────────────────────────

const FIXED_BUSINESS_DATE = new Date('2026-05-15T00:00:00.000Z');
const SYSTEM_USER_ID = 'user-system-001';

function makeFolioItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'item-001',
    folioId: 'folio-001',
    type: 'MANUAL_CHARGE',
    description: 'Minibar consumo',
    quantity: 1,
    unitPrice: { toFixed: (d: number) => (50000).toFixed(d) } as any,
    amount: { toFixed: (d: number) => (50000).toFixed(d) } as any,
    taxRate: { toFixed: (d: number) => (0.19).toFixed(d) } as any,
    taxAmount: { toFixed: (d: number) => (9500).toFixed(d) } as any,
    businessDate: FIXED_BUSINESS_DATE,
    postedAt: new Date('2026-05-15T10:00:00.000Z'),
    postedByUserId: SYSTEM_USER_ID,
    voidedByEntryId: null,
    ...overrides,
  };
}

/**
 * setupGuardOpenMocks — sets up the two findUnique calls that resolveFolioId
 * makes internally.  Call pattern:
 *   1st call: findUnique({ where: { id } })  → returns null or the folio
 *   2nd call: findUnique({ where: { reservationId: id } }) → only reached if 1st is null
 *
 * For tests that pass a real folioId, only the first call matters (it resolves).
 * For tests that pass a reservationId, we make the first call return null and
 * the second call return the folio stub.
 */
function setupResolveMocks(
  folio: { id: string; isOpen: boolean } | null,
  mock: any,
  opts: { viaReservationId?: boolean } = {},
) {
  if (!folio) {
    // Both lookups return null → NotFoundException
    mock.folio.findUnique.mockResolvedValue(null);
    return;
  }

  if (opts.viaReservationId) {
    // 1st call (by folio id) → null, 2nd call (by reservationId) → folio
    mock.folio.findUnique
      .mockResolvedValueOnce(null)   // resolveById: by { id }
      .mockResolvedValueOnce({ id: folio.id })  // resolveById: by { reservationId }
      .mockResolvedValueOnce(folio); // guardOpen second findUnique (by resolved id)
  } else {
    // 1st call → folio (resolveById resolves immediately)
    mock.folio.findUnique
      .mockResolvedValueOnce({ id: folio.id })  // resolveById: by { id }
      .mockResolvedValueOnce(folio);             // guardOpen second findUnique (by resolved id)
  }
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('FolioService', () => {
  let service: FolioService;
  let prismaMock: any;
  let systemConfigMock: any;

  beforeEach(async () => {
    // Build a realistic tx mock that mirrors the real Prisma tx client
    const txMock = {
      folio: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      folioItem: {
        create: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        findMany: vi.fn(),
      },
    };

    prismaMock = {
      folio: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      folioItem: {
        create: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        findMany: vi.fn(),
      },
      $transaction: vi.fn(async (cb: any) => cb(txMock)),
      _txMock: txMock,
    };

    systemConfigMock = {
      getIvaRate: vi.fn().mockResolvedValue(0.19),
      getHotelBusinessDate: vi.fn().mockResolvedValue(FIXED_BUSINESS_DATE),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FolioService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SystemConfigService, useValue: systemConfigMock },
      ],
    }).compile();

    service = module.get(FolioService);
  });

  // ── Test 1: openFolio creates OPEN folio ──────────────────────────────────

  it('Test 1 — openFolio creates an OPEN folio row using provided tx', async () => {
    const txMock = prismaMock._txMock;
    const reservationId = 'res-001';
    const expected = { id: 'folio-001', reservationId, isOpen: true };

    txMock.folio.findUnique.mockResolvedValue(null); // no existing folio
    txMock.folio.create.mockResolvedValue(expected);

    const result = await service.openFolio(txMock, reservationId);

    expect(txMock.folio.create).toHaveBeenCalledWith({
      data: { reservationId, isOpen: true },
    });
    expect(result.isOpen).toBe(true);
    expect(result.reservationId).toBe(reservationId);
  });

  // ── Test 2: postCharge on OPEN folio ─────────────────────────────────────

  it('Test 2 — postCharge on OPEN folio inserts FolioItem with correct fields', async () => {
    const folioId = 'folio-001';
    const openFolio = { id: folioId, isOpen: true };
    const createdItem = makeFolioItem();

    // resolveFolioId resolves by folioId (1st findUnique hit)
    setupResolveMocks(openFolio, prismaMock);
    prismaMock.folioItem.create.mockResolvedValue(createdItem);

    const dto = {
      description: 'Minibar consumo',
      quantity: 1,
      unitPrice: 50000,
      taxRate: 0.19,
    };

    const result = await service.postCharge(folioId, dto, SYSTEM_USER_ID);

    expect(prismaMock.folioItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          folioId,
          type: 'MANUAL_CHARGE',
          description: dto.description,
          quantity: dto.quantity,
          postedByUserId: SYSTEM_USER_ID,
          businessDate: FIXED_BUSINESS_DATE,
        }),
      }),
    );
    expect(result).toBeDefined();
  });

  // ── Test 3: postCharge on CLOSED folio throws ConflictException ───────────

  it('Test 3 — postCharge on CLOSED folio throws ConflictException (immutability guard)', async () => {
    const folioId = 'folio-closed';
    const closedFolio = { id: folioId, isOpen: false };

    // Each call to postCharge triggers two findUnique calls internally
    setupResolveMocks(closedFolio, prismaMock);
    setupResolveMocks(closedFolio, prismaMock); // second call for the second assertion

    const dto = { description: 'Late charge', quantity: 1, unitPrice: 10000, taxRate: 0.19 };

    await expect(service.postCharge(folioId, dto, SYSTEM_USER_ID)).rejects.toThrow(
      ConflictException,
    );
    await expect(service.postCharge(folioId, dto, SYSTEM_USER_ID)).rejects.toThrow(
      /is closed/i,
    );
  });

  // ── Test 4: voidCharge appends VOID row (append-only) ───────────────────

  it('Test 4 — voidCharge appends VOID FolioItem with voidedByEntryId, never mutates original', async () => {
    const folioId = 'folio-001';
    const itemId = 'item-001';
    const openFolio = { id: folioId, isOpen: true };
    const originalItem = makeFolioItem({
      id: itemId,
      amount: { toFixed: (d: number) => (50000).toFixed(d) } as any,
      taxRate: { toFixed: (d: number) => (0.19).toFixed(d) } as any,
      taxAmount: { toFixed: (d: number) => (9500).toFixed(d) } as any,
    });
    const voidItem = { ...makeFolioItem({ id: 'item-void', type: 'VOID', voidedByEntryId: itemId }) };

    setupResolveMocks(openFolio, prismaMock);
    prismaMock.folioItem.findUniqueOrThrow.mockResolvedValue(originalItem);
    prismaMock.folioItem.create.mockResolvedValue(voidItem);

    const result = await service.voidCharge(folioId, itemId, SYSTEM_USER_ID);

    // Must create a new VOID row, NOT update/delete original
    expect(prismaMock.folioItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'VOID',
          voidedByEntryId: itemId,
          folioId,
        }),
      }),
    );
    // Original item must NOT be mutated
    expect(prismaMock.folioItem.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: itemId } }),
    );
    expect(result.type).toBe('VOID');
  });

  // ── Test 5: closeFolio sets snapshot + isOpen=false ─────────────────────

  it('Test 5 — closeFolio sets snapshotHash + snapshotTotal + closedAt + isOpen=false', async () => {
    const txMock = prismaMock._txMock;
    const folioId = 'folio-001';
    const openFolio = { id: folioId, isOpen: true };
    const items = [makeFolioItem()];

    // closeFolio passes a tx — resolveFolioId uses txMock.folio.findUnique
    txMock.folio.findUnique
      .mockResolvedValueOnce({ id: folioId }) // resolveById: by { id }
      .mockResolvedValueOnce(openFolio);       // guardOpen second findUnique
    txMock.folioItem.findMany.mockResolvedValue(items);
    txMock.folio.update.mockResolvedValue({
      ...openFolio,
      isOpen: false,
      snapshotHash: 'abc123',
      snapshotTotal: 59500,
      closedAt: new Date(),
    });

    const result = await service.closeFolio(txMock, folioId);

    expect(txMock.folio.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: folioId },
        data: expect.objectContaining({
          isOpen: false,
          snapshotHash: expect.any(String),
          snapshotTotal: expect.any(Number),
          closedAt: expect.any(Date),
        }),
      }),
    );
    expect(result.isOpen).toBe(false);
  });

  it('Test 5b — closeFolio twice throws ConflictException', async () => {
    const txMock = prismaMock._txMock;
    const folioId = 'folio-already-closed';
    const closedFolio = { id: folioId, isOpen: false };

    txMock.folio.findUnique
      .mockResolvedValueOnce({ id: folioId })
      .mockResolvedValueOnce(closedFolio);

    await expect(service.closeFolio(txMock, folioId)).rejects.toThrow(ConflictException);
  });

  // ── Test 6: computeFolioChecksum is deterministic ────────────────────────

  it('Test 6 — computeFolioChecksum is deterministic regardless of array order', () => {
    const item1 = makeFolioItem({
      id: 'i1',
      postedAt: new Date('2026-05-15T10:00:00.000Z'),
    });
    const item2 = makeFolioItem({
      id: 'i2',
      postedAt: new Date('2026-05-15T11:00:00.000Z'),
    });

    const hashAB = computeFolioChecksum([item1, item2] as any);
    const hashBA = computeFolioChecksum([item2, item1] as any);

    // Same items in different order → same hash (sorted by postedAt)
    expect(hashAB).toBe(hashBA);
    expect(hashAB).toHaveLength(64); // SHA-256 hex = 64 chars
  });

  // ── Test 7: getFolioWithBalance — resolves by folioId (existing path) ─────

  it('Test 7 — getFolioWithBalance resolves by folioId, returns items + computed balance', async () => {
    const folioId = 'folio-001';
    const fullFolio = {
      id: folioId, isOpen: true, reservationId: 'res-001', closedAt: null,
      snapshotHash: null, snapshotTotal: null, createdAt: new Date(), updatedAt: new Date(),
      items: [
        {
          id: 'i1', folioId, type: 'MANUAL_CHARGE', description: 'Minibar',
          quantity: 1, unitPrice: 50000, amount: 50000, taxRate: 0.19, taxAmount: 9500,
          businessDate: FIXED_BUSINESS_DATE, postedAt: new Date(), postedByUserId: SYSTEM_USER_ID,
          voidedByEntryId: null,
        },
        {
          id: 'i2', folioId, type: 'VOID', description: 'VOID: Minibar',
          quantity: 1, unitPrice: -50000, amount: -50000, taxRate: 0, taxAmount: 0,
          businessDate: FIXED_BUSINESS_DATE, postedAt: new Date(), postedByUserId: SYSTEM_USER_ID,
          voidedByEntryId: 'i1',
        },
      ],
    };

    // resolveFolioId: 1st findUnique returns {id} → resolved immediately
    // getFolioWithBalance: next findUnique returns full folio with items
    prismaMock.folio.findUnique
      .mockResolvedValueOnce({ id: folioId })  // resolveById hit
      .mockResolvedValueOnce(fullFolio);        // the real fetch with include

    const result = await service.getFolioWithBalance(folioId);

    expect(result.items).toHaveLength(2);
    // Balance = (50000 + 9500) from charge + (-50000 + 0) from void = 9500
    expect(result.balance).toBe(9500);
  });

  // ── Test 8 (NEW): getFolioWithBalance resolves by reservationId ───────────

  it('Test 8 — getFolioWithBalance resolves by reservationId when no folio matches folioId', async () => {
    const reservationId = 'res-abc-001';
    const realFolioId = 'folio-xyz-001';
    const fullFolio = {
      id: realFolioId, isOpen: true, reservationId, closedAt: null,
      snapshotHash: null, snapshotTotal: null, createdAt: new Date(), updatedAt: new Date(),
      items: [],
    };

    // resolveById: 1st by {id: reservationId} → null (no folio with that id)
    //              2nd by {reservationId} → {id: realFolioId}
    // getFolioWithBalance: 3rd findUnique with include → fullFolio
    prismaMock.folio.findUnique
      .mockResolvedValueOnce(null)                 // by { id: reservationId } → miss
      .mockResolvedValueOnce({ id: realFolioId })  // by { reservationId } → hit
      .mockResolvedValueOnce(fullFolio);            // the real fetch with include

    const result = await service.getFolioWithBalance(reservationId);

    expect(result.id).toBe(realFolioId);
    expect(result.reservationId).toBe(reservationId);
    expect(result.balance).toBe(0);
  });

  // ── Test 9 (NEW): getFolioWithBalance throws NotFoundException for unknown id

  it('Test 9 — getFolioWithBalance throws NotFoundException (404) for unknown id', async () => {
    const unknownId = 'cuid-does-not-exist-001';

    // Both resolution lookups return null
    prismaMock.folio.findUnique.mockResolvedValue(null);

    await expect(service.getFolioWithBalance(unknownId)).rejects.toThrow(NotFoundException);
    await expect(service.getFolioWithBalance(unknownId)).rejects.toThrow('Folio no encontrado');
  });
});
