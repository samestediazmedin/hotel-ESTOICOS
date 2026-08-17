import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { FolioPdfService } from './folio-pdf.service';
import { FolioService } from './folio.service';
import { GuestEncryptionService } from '../guests/encryption/guest-encryption.service';

// ─── Mock @react-pdf/renderer ─────────────────────────────────────────────────
// Pattern from Phase 02-02 S3Client class-mock — renderToBuffer must return a
// Buffer starting with '%PDF-' magic bytes.

vi.mock('@react-pdf/renderer', () => ({
  renderToBuffer: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.7\nfake content for test', 'utf8')),
  Document: 'Document',
  Page: 'Page',
  View: 'View',
  Text: 'Text',
  StyleSheet: {
    create: (s: Record<string, unknown>) => s,
  },
}));

// ─── Mock FolioPdfDocument ────────────────────────────────────────────────────

vi.mock('./pdf/FolioPdfDocument', () => ({
  FolioPdfDocument: vi.fn(() => null),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeGuest(overrides: Partial<{
  fullName: string;
  documentType: string;
  documentNumber: string;
}> = {}) {
  return {
    id: 'guest-001',
    fullName: 'María García',
    documentType: 'CC',
    documentNumber: 'ENCRYPTED:iv:tag:cipher', // encrypted value
    ...overrides,
  };
}

function makeReservation(guest = makeGuest()) {
  return {
    id: 'res-001',
    checkInDate: new Date('2026-05-10'),
    checkOutDate: new Date('2026-05-13'),
    room: { id: 'room-001', number: '101' },
    guest,
  };
}

function makeFolioItem(overrides: Partial<{
  id: string;
  type: string;
  description: string;
  voidedByEntryId: string | null;
}> = {}) {
  return {
    id: 'item-001',
    folioId: 'folio-001',
    type: 'ROOM_CHARGE',
    description: 'Habitación 101 — 2026-05-10',
    quantity: 1,
    unitPrice: 150000,
    amount: 150000,
    taxRate: 0,
    taxAmount: 0,
    businessDate: new Date('2026-05-10'),
    postedAt: new Date('2026-05-10'),
    postedByUserId: 'user-001',
    voidedByEntryId: null,
    ...overrides,
  };
}

function makeOpenFolio(items: ReturnType<typeof makeFolioItem>[], reservation = makeReservation()) {
  return {
    id: 'folio-001',
    reservationId: 'res-001',
    isOpen: true,
    snapshotHash: null, // OPEN folio has no snapshot
    snapshotTotal: null,
    closedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items,
    balance: 150000,
    reservation,
  };
}

function makeSettledFolio(items: ReturnType<typeof makeFolioItem>[], reservation = makeReservation()) {
  return {
    id: 'folio-001',
    reservationId: 'res-001',
    isOpen: false,
    snapshotHash: 'abc123def456789012345678901234567890123456789012345678901234abcd',
    snapshotTotal: 178500,
    closedAt: new Date('2026-05-13'),
    createdAt: new Date(),
    updatedAt: new Date(),
    items,
    balance: 178500,
    reservation,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FolioPdfService', () => {
  let service: FolioPdfService;
  let folioService: { getFolioForPdf: ReturnType<typeof vi.fn> };
  let guestEncryption: { decrypt: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    folioService = {
      getFolioForPdf: vi.fn(),
    };
    guestEncryption = {
      decrypt: vi.fn().mockReturnValue('123456789'),
    };

    const module = await Test.createTestingModule({
      providers: [
        FolioPdfService,
        { provide: FolioService, useValue: folioService },
        { provide: GuestEncryptionService, useValue: guestEncryption },
      ],
    }).compile();

    service = module.get(FolioPdfService);
  });

  // ── Test 1: returns Buffer with %PDF- magic bytes ──────────────────────────

  it('Test 1 — generateFolioPdf returns Buffer with %PDF- magic bytes for SETTLED folio', async () => {
    const items = [
      makeFolioItem({ id: 'item-001', type: 'ROOM_CHARGE', description: 'Habitación 101 — 2026-05-10' }),
      makeFolioItem({ id: 'item-002', type: 'TAX', description: 'IVA 19% — 2026-05-10' }),
      makeFolioItem({ id: 'item-003', type: 'MANUAL_CHARGE', description: 'Minibar' }),
    ];
    const folio = makeSettledFolio(items);
    folioService.getFolioForPdf.mockResolvedValue(folio);

    const result = await service.generateFolioPdf('folio-001');

    expect(Buffer.isBuffer(result)).toBe(true);
    // %PDF- magic bytes: 0x25 0x50 0x44 0x46 0x2D
    expect(result[0]).toBe(0x25); // %
    expect(result[1]).toBe(0x50); // P
    expect(result[2]).toBe(0x44); // D
    expect(result[3]).toBe(0x46); // F
  });

  // ── Test 2: throws BadRequestException for OPEN folio (snapshotHash null) ──

  it('Test 2 — generateFolioPdf throws BadRequestException when folio snapshotHash is null (OPEN)', async () => {
    const items = [makeFolioItem()];
    const folio = makeOpenFolio(items);
    folioService.getFolioForPdf.mockResolvedValue(folio);

    await expect(service.generateFolioPdf('folio-001')).rejects.toThrow(BadRequestException);
    await expect(service.generateFolioPdf('folio-001')).rejects.toThrow('must be SETTLED');
  });

  // ── Test 3: renders even when voided items are present ────────────────────

  it('Test 3 — generateFolioPdf renders Buffer when folio contains a VOIDED item', async () => {
    const items = [
      makeFolioItem({ id: 'item-001', type: 'ROOM_CHARGE' }),
      makeFolioItem({
        id: 'item-002',
        type: 'VOID',
        description: 'VOID: Cargo cancelado',
        voidedByEntryId: 'item-001',
      }),
    ];
    const folio = makeSettledFolio(items);
    folioService.getFolioForPdf.mockResolvedValue(folio);

    const result = await service.generateFolioPdf('folio-001');

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  // ── Test 4: decrypts documentNumber before passing to FolioPdfDocument ────

  it('Test 4 — generateFolioPdf calls guestEncryption.decrypt with the encrypted documentNumber', async () => {
    const encryptedDocNumber = 'ENCRYPTED:iv:tag:cipher';
    const guest = makeGuest({ documentNumber: encryptedDocNumber });
    const reservation = makeReservation(guest);
    const items = [makeFolioItem()];
    const folio = makeSettledFolio(items, reservation);
    folioService.getFolioForPdf.mockResolvedValue(folio);

    await service.generateFolioPdf('folio-001');

    expect(guestEncryption.decrypt).toHaveBeenCalledWith(encryptedDocNumber);
  });
});
