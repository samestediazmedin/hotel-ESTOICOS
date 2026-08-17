import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { GuestsService } from './guests.service';
import { GuestsRepository } from './guests.repository';
import { GuestEncryptionService } from './encryption/guest-encryption.service';
import { CreateGuestPipe } from './dto/create-guest.dto';

// ─── Constants ────────────────────────────────────────────────────────────────

/** 64 hex chars = 32 bytes — valid AES-256 key */
const VALID_KEY = 'a'.repeat(64);
const PLAINTEXT_DOC = 'CC-1020304050';

// ─── Contact event fixture helper ────────────────────────────────────────────

function makeContactEvent(overrides: {
  method?: 'CALL' | 'WHATSAPP' | 'EMAIL';
  createdAt?: Date;
  staffUserName?: string | null;
} = {}) {
  return {
    method: overrides.method ?? 'CALL',
    createdAt: overrides.createdAt ?? new Date('2026-05-19T10:00:00.000Z'),
    // Use 'staffUserName' in overrides key check — null must be propagated (not replaced by default)
    staffUser: {
      name: 'staffUserName' in overrides ? overrides.staffUserName! : 'María Pérez',
    },
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

interface RawGuestStub {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  documentType: string;
  documentNumber: string;
  nationality: string;
  dateOfBirth: Date;
  anonymizedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  reservations: any[];
  // Phase 15 additions
  preferredLanguage: string;
  contactPreference: 'EMAIL' | 'PHONE' | 'WHATSAPP' | null;
  whatsappNumber: string | null;
  marketingConsent: boolean;
  dietaryRestrictions: string | null;
  specialRequests: string | null;
  // Phase 16 — optional contact events (from findAll include)
  contactEvents?: Array<{
    method: 'CALL' | 'WHATSAPP' | 'EMAIL';
    createdAt: Date;
    staffUser: { name: string | null };
  }>;
}

function makeRawGuest(overrides: Partial<RawGuestStub> = {}): RawGuestStub {
  return {
    id: 'guest-1',
    fullName: 'Juan Pérez',
    email: 'juan@example.com',
    phone: '+57 300 123 4567',
    documentType: 'CC',
    documentNumber: '__CIPHERTEXT__', // will be replaced in specific tests
    nationality: 'CO',
    dateOfBirth: new Date('1990-06-15T00:00:00.000Z'),
    anonymizedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    reservations: [],
    // Phase 15 defaults
    preferredLanguage: 'es',
    contactPreference: null,
    whatsappNumber: null,
    marketingConsent: false,
    dietaryRestrictions: null,
    specialRequests: null,
    ...overrides,
  };
}

// ─── Mock repository ──────────────────────────────────────────────────────────

const repoMock = {
  createGuest: vi.fn(),
  findById: vi.fn(),
  findAll: vi.fn(),
  update: vi.fn(),
  findReservationsByGuestId: vi.fn(),
  countReservationsByGuestId: vi.fn(),
  deleteGuest: vi.fn(),
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('GuestsService', () => {
  let service: GuestsService;
  let encryption: GuestEncryptionService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuestsService,
        { provide: GuestsRepository, useValue: repoMock },
        GuestEncryptionService,
        {
          provide: ConfigService,
          useValue: { getOrThrow: vi.fn().mockReturnValue(VALID_KEY) },
        },
      ],
    }).compile();

    service = module.get(GuestsService);
    encryption = module.get(GuestEncryptionService);
  });

  // ── Test 1: create encrypts documentNumber before persistence ─────────────

  it('Test 1 — create() encrypts documentNumber; repository receives ciphertext, not plaintext', async () => {
    repoMock.createGuest.mockImplementation(async (data: any) => ({
      ...makeRawGuest(),
      documentNumber: data.documentNumber,
    }));

    await service.create({
      fullName: 'Juan Pérez',
      documentType: 'CC',
      documentNumber: PLAINTEXT_DOC,
      nationality: 'CO',
      dateOfBirth: '1990-06-15',
      email: 'juan@example.com',
      phone: null,
      preferredLanguage: 'es',
      marketingConsent: false,
    });

    expect(repoMock.createGuest).toHaveBeenCalledWith(
      expect.objectContaining({
        documentNumber: expect.not.stringContaining(PLAINTEXT_DOC),
      }),
    );
  });

  // ── Test 2: findById returns decrypted documentNumber ─────────────────────

  it('Test 2 — findById() returns guest with documentNumber decrypted to original plaintext', async () => {
    const ciphertext = encryption.encrypt(PLAINTEXT_DOC);
    repoMock.findById.mockResolvedValue(
      makeRawGuest({ documentNumber: ciphertext }),
    );

    const result = await service.findById('guest-1');
    // findById returns the raw row — caller transforms. Verify the raw row has ciphertext.
    // toResponseDto decrypts it.
    const responseDto = service.toResponseDto(result);
    expect(responseDto.documentNumber).toBe(PLAINTEXT_DOC);
  });

  // ── Test 3: toPublicDto strips documentNumber ─────────────────────────────

  it('Test 3 — toPublicDto() returns object WITHOUT documentNumber key', () => {
    const raw = makeRawGuest({ documentNumber: encryption.encrypt(PLAINTEXT_DOC) });
    const result = service.toPublicDto(raw);
    expect(result).not.toHaveProperty('documentNumber');
  });

  // ── Test 4: toResponseDto includes decrypted documentNumber ──────────────

  it('Test 4 — toResponseDto() returns object WITH documentNumber decrypted', () => {
    const raw = makeRawGuest({ documentNumber: encryption.encrypt(PLAINTEXT_DOC) });
    const result = service.toResponseDto(raw);
    expect(result).toHaveProperty('documentNumber');
    expect(result.documentNumber).toBe(PLAINTEXT_DOC);
  });

  // ── Test 5: anonymize sets sentinel + PII fields + idempotent ────────────

  it('Test 5 — anonymize() calls update with sentinel values; second call is idempotent (no-op)', async () => {
    const existing = makeRawGuest();
    repoMock.findById.mockResolvedValue(existing);
    repoMock.update.mockResolvedValue({ ...existing, anonymizedAt: new Date() });

    await service.anonymize('guest-1');

    expect(repoMock.update).toHaveBeenCalledWith(
      'guest-1',
      expect.objectContaining({
        documentNumber: '[ANONYMIZED]',
        fullName: '[ANONYMIZED]',
        email: null,
        phone: null,
        anonymizedAt: expect.any(Date),
      }),
    );

    // Second call — already anonymized
    vi.clearAllMocks();
    repoMock.findById.mockResolvedValue(
      makeRawGuest({ anonymizedAt: new Date() }),
    );

    await service.anonymize('guest-1');

    // Repository update must NOT be called — idempotent
    expect(repoMock.update).not.toHaveBeenCalled();
  });

  // ── Phase 15 Tests ────────────────────────────────────────────────────────

  // ── Test P15-1: create with all 6 new fields passes them to repo ──────────

  it('Test P15-1 — create() passes all 6 new Phase 15 fields explicitly to repo.createGuest', async () => {
    repoMock.createGuest.mockImplementation(async (data: any) => ({
      ...makeRawGuest(),
      ...data,
    }));

    await service.create({
      fullName: 'María López',
      documentType: 'CC',
      documentNumber: PLAINTEXT_DOC,
      nationality: 'CO',
      dateOfBirth: '1985-03-20',
      email: 'maria@example.com',
      phone: null,
      preferredLanguage: 'en',
      contactPreference: 'WHATSAPP',
      whatsappNumber: '+573001234567',
      marketingConsent: true,
      dietaryRestrictions: 'sin gluten',
      specialRequests: 'cama extra',
    });

    expect(repoMock.createGuest).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredLanguage: 'en',
        contactPreference: 'WHATSAPP',
        whatsappNumber: '+573001234567',
        marketingConsent: true,
        dietaryRestrictions: 'sin gluten',
        specialRequests: 'cama extra',
      }),
    );
  });

  // ── Test P15-2: create without new fields applies defaults ────────────────

  it('Test P15-2 — create() without new fields sends defaults (preferredLanguage: es, marketingConsent: false, nulls)', async () => {
    repoMock.createGuest.mockImplementation(async (data: any) => ({
      ...makeRawGuest(),
      ...data,
    }));

    await service.create({
      fullName: 'Pedro Gómez',
      documentType: 'CC',
      documentNumber: PLAINTEXT_DOC,
      nationality: 'CO',
      dateOfBirth: '1992-07-10',
      preferredLanguage: 'es',
      marketingConsent: false,
    });

    expect(repoMock.createGuest).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredLanguage: 'es',
        contactPreference: null,
        whatsappNumber: null,
        marketingConsent: false,
        dietaryRestrictions: null,
        specialRequests: null,
      }),
    );
  });

  // ── Test P15-3: update with whatsappNumber passes it through ─────────────

  it('Test P15-3 — update() with whatsappNumber passes it to repo.update', async () => {
    const ciphertext = encryption.encrypt(PLAINTEXT_DOC);
    repoMock.findById.mockResolvedValue(makeRawGuest({ documentNumber: ciphertext }));
    repoMock.update.mockResolvedValue(
      makeRawGuest({ documentNumber: ciphertext, whatsappNumber: '+573009876543' }),
    );

    await service.update('guest-1', {
      whatsappNumber: '+573009876543',
    });

    expect(repoMock.update).toHaveBeenCalledWith(
      'guest-1',
      expect.objectContaining({
        whatsappNumber: '+573009876543',
      }),
    );
  });

  // ── Test P15-4: update with empty body does not override new fields ───────

  it('Test P15-4 — update() with empty body sends undefined for all new fields (no override)', async () => {
    const ciphertext = encryption.encrypt(PLAINTEXT_DOC);
    repoMock.findById.mockResolvedValue(makeRawGuest({ documentNumber: ciphertext }));
    repoMock.update.mockResolvedValue(makeRawGuest({ documentNumber: ciphertext }));

    await service.update('guest-1', {});

    expect(repoMock.update).toHaveBeenCalledWith(
      'guest-1',
      expect.objectContaining({
        whatsappNumber: undefined,
        contactPreference: undefined,
        preferredLanguage: undefined,
        marketingConsent: undefined,
        dietaryRestrictions: undefined,
        specialRequests: undefined,
      }),
    );
  });

  // ── Test P15-5: CreateGuestPipe rejects invalid E.164 whatsappNumber ──────

  it('Test P15-5 — CreateGuestPipe rejects whatsappNumber not in E.164 format with BadRequestException', () => {
    const pipe = new CreateGuestPipe();

    const validBase = {
      fullName: 'Test User',
      documentType: 'CC',
      documentNumber: '123456789',
      nationality: 'CO',
      dateOfBirth: '1990-01-01',
    };

    expect(() =>
      pipe.transform({ ...validBase, whatsappNumber: 'abc' }),
    ).toThrow();

    expect(() =>
      pipe.transform({ ...validBase, whatsappNumber: '300 1234567' }),
    ).toThrow();

    expect(() =>
      pipe.transform({ ...validBase, whatsappNumber: '+0123456789' }),
    ).toThrow();

    // Valid E.164 should NOT throw
    expect(() =>
      pipe.transform({ ...validBase, whatsappNumber: '+573001234567' }),
    ).not.toThrow();
  });

  // ── Phase 16 Tests — lastContactEvent on DTO transformers ────────────────

  // ── Test P16-1: toResponseDto with empty contactEvents returns null ────────

  it('Test P16-1 — toResponseDto() with contactEvents=[] returns lastContactEvent: null', () => {
    const raw = makeRawGuest({ documentNumber: encryption.encrypt(PLAINTEXT_DOC) });
    const rawWithEvents = { ...raw, contactEvents: [] };
    const result = service.toResponseDto(rawWithEvents);
    expect(result.lastContactEvent).toBeNull();
  });

  // ── Test P16-2: toResponseDto with one event returns populated object ──────

  it('Test P16-2 — toResponseDto() with contactEvents=[event] returns lastContactEvent populated', () => {
    const raw = makeRawGuest({ documentNumber: encryption.encrypt(PLAINTEXT_DOC) });
    const event = makeContactEvent({ method: 'CALL', staffUserName: 'María' });
    const rawWithEvents = { ...raw, contactEvents: [event] };
    const result = service.toResponseDto(rawWithEvents);
    expect(result.lastContactEvent).not.toBeNull();
    expect(result.lastContactEvent!.method).toBe('CALL');
    expect(result.lastContactEvent!.staffUserName).toBe('María');
    expect(typeof result.lastContactEvent!.createdAt).toBe('string'); // ISO string
  });

  // ── Test P16-3: toResponseDto with undefined contactEvents returns null ─────

  it('Test P16-3 — toResponseDto() without contactEvents field (undefined) returns lastContactEvent: null (defensive default)', () => {
    const raw = makeRawGuest({ documentNumber: encryption.encrypt(PLAINTEXT_DOC) });
    // contactEvents field is absent (from findById which doesn't include it)
    const result = service.toResponseDto(raw);
    expect(result.lastContactEvent).toBeNull();
  });

  // ── Test P16-4: toPublicDto follows identical lastContactEvent logic ────────

  it('Test P16-4 — toPublicDto() exposes lastContactEvent (operational field for HOUSEKEEPING)', () => {
    const raw = makeRawGuest({ documentNumber: encryption.encrypt(PLAINTEXT_DOC) });
    const event = makeContactEvent({ method: 'WHATSAPP', staffUserName: 'Carlos' });
    const rawWithEvents = { ...raw, contactEvents: [event] };
    const result = service.toPublicDto(rawWithEvents);
    expect(result.lastContactEvent).not.toBeNull();
    expect(result.lastContactEvent!.method).toBe('WHATSAPP');
    expect(result.lastContactEvent!.staffUserName).toBe('Carlos');
  });

  // ── Test P16-5: staffUser.name null propagates as null in DTO ────────────

  it('Test P16-5 — toResponseDto() when staffUser.name is null, staffUserName is null in DTO', () => {
    const raw = makeRawGuest({ documentNumber: encryption.encrypt(PLAINTEXT_DOC) });
    const event = makeContactEvent({ staffUserName: null });
    const rawWithEvents = { ...raw, contactEvents: [event] };
    const result = service.toResponseDto(rawWithEvents);
    expect(result.lastContactEvent).not.toBeNull();
    expect(result.lastContactEvent!.staffUserName).toBeNull();
  });

  // ── Tests for remove() ────────────────────────────────────────────────────

  it('Test R-1 — remove() throws 404 when guest does not exist', async () => {
    repoMock.findById.mockResolvedValue(null);

    await expect(service.remove('nonexistent-id')).rejects.toThrow(NotFoundException);
    expect(repoMock.deleteGuest).not.toHaveBeenCalled();
  });

  it('Test R-2 — remove() throws 409 ConflictException when guest has reservations', async () => {
    repoMock.findById.mockResolvedValue(makeRawGuest());
    repoMock.countReservationsByGuestId.mockResolvedValue(3);

    await expect(service.remove('guest-1')).rejects.toThrow(ConflictException);
    await expect(service.remove('guest-1')).rejects.toThrow(
      /No se puede eliminar/,
    );
    expect(repoMock.deleteGuest).not.toHaveBeenCalled();
  });

  it('Test R-3 — remove() calls deleteGuest when guest has 0 reservations', async () => {
    repoMock.findById.mockResolvedValue(makeRawGuest());
    repoMock.countReservationsByGuestId.mockResolvedValue(0);
    repoMock.deleteGuest.mockResolvedValue(undefined);

    await service.remove('guest-1');

    expect(repoMock.deleteGuest).toHaveBeenCalledWith('guest-1');
  });

  // ── Test 6: getHistory aggregates totals ──────────────────────────────────

  it('Test 6 — getHistory() sums totalNights and totalSpent; empty list returns zeros', async () => {
    const guest = makeRawGuest({ documentNumber: encryption.encrypt(PLAINTEXT_DOC) });
    repoMock.findById.mockResolvedValue(guest);
    repoMock.findReservationsByGuestId.mockResolvedValue([]);

    const result = await service.getHistory('guest-1');

    expect(result.totalNights).toBe(0);
    expect(result.totalSpent).toBe(0);
    expect(result.reservations).toHaveLength(0);

    // With reservations
    vi.clearAllMocks();
    repoMock.findById.mockResolvedValue(guest);
    repoMock.findReservationsByGuestId.mockResolvedValue([
      { id: 'r1', totalNights: 3, totalPrice: 600000 },
      { id: 'r2', totalNights: 2, totalPrice: 400000 },
    ]);

    const result2 = await service.getHistory('guest-1');
    expect(result2.totalNights).toBe(5);
    expect(result2.totalSpent).toBe(1000000);
  });
});
