import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { PublicBookingService } from './public-booking.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GuestEncryptionService } from '../guests/encryption/guest-encryption.service';
import { EmailService } from '../email/email.service';
import { PricingService } from '../pricing/pricing.service';
import { CreatePublicBookingSchema } from './dto/create-public-booking.dto';
import type { CreatePublicBookingDto } from './dto/create-public-booking.dto';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const txMock = {
  guest: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  reservation: {
    create: vi.fn(),
  },
  $executeRaw: vi.fn(),
};

const prismaMock = {
  $transaction: vi.fn(),
  offer: {
    findUnique: vi.fn().mockResolvedValue(null),
  },
  ratePlan: {
    findUnique: vi.fn().mockResolvedValue(null),
  },
};

const encryptionMock = {
  encrypt: vi.fn().mockReturnValue('encrypted-doc'),
};

const emailMock = {
  sendBookingConfirmation: vi.fn().mockResolvedValue(undefined),
};

const pricingMock = {
  calculateBreakdown: vi.fn(),
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseDto: CreatePublicBookingDto = {
  fullName: 'Ana Ríos',
  email: 'ana@example.com',
  phone: '+57 300 123 4567',
  documentType: 'CC',
  documentNumber: '1234567890',
  nationality: 'CO',
  dateOfBirth: '1990-06-15',
  roomId: 'cmtroomtest00010000roomid',
  roomTypeId: 'cmtroomtest00020000roomid',
  checkIn: '2026-07-01',
  checkOut: '2026-07-03',
  adults: 2,
  // Phase 15 defaults (Zod applies these automatically)
  preferredLanguage: 'es',
  marketingConsent: false,
};

// Phase 15 — guest record includes 4 fields the email path needs
const guestRecord = {
  id: 'guest-id-001',
  fullName: 'Ana Ríos',
  email: 'ana@example.com',
  whatsappNumber: null,
  contactPreference: null,
  dietaryRestrictions: null,
  specialRequests: null,
};

const reservationRecord = { id: 'res-id-001', status: 'CONFIRMED', totalNights: 2 };

const pricingBreakdown = {
  roomTypeId: 'roomtype-uuid-001',
  ratePlanId: null,
  nights: 2,
  items: [],
  subtotal: 400000,
  totalIva: 76000,
  roomTotal: 476000,
  extras: [],
  extrasSubtotal: 0,
  extrasIva: 0,
  extrasTotal: 0,
  total: 476000,
  currency: 'COP' as const,
  appliedRatePlan: 'Base Rate',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PublicBookingService', () => {
  let service: PublicBookingService;

  beforeEach(async () => {
    vi.clearAllMocks();
    pricingMock.calculateBreakdown.mockResolvedValue(pricingBreakdown);
    txMock.guest.findFirst.mockResolvedValue(null); // no existing guest by default
    txMock.guest.create.mockResolvedValue(guestRecord);
    txMock.reservation.create.mockResolvedValue(reservationRecord);
    txMock.$executeRaw.mockResolvedValue(1);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock));

    const module = await Test.createTestingModule({
      providers: [
        PublicBookingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: GuestEncryptionService, useValue: encryptionMock },
        { provide: EmailService, useValue: emailMock },
        { provide: PricingService, useValue: pricingMock },
      ],
    }).compile();

    service = module.get(PublicBookingService);
  });

  // ── Test 1: $transaction called once, creates Guest + PENDING Reservation ──
  //
  // 2026-05-27 — public bookings are now 'request to book' so the reservation
  // lands as PENDING (admin reviews + confirms). roomId is null until the admin
  // assigns one at check-in.

  it('calls prisma.$transaction once and creates a PENDING reservation', async () => {
    await service.createBooking(baseDto);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.reservation.create).toHaveBeenCalledTimes(1);

    const createArgs = txMock.reservation.create.mock.calls[0][0];
    expect(createArgs.data.status).toBe('PENDING');
    expect(createArgs.data.roomId).toBeNull();
    expect(txMock.guest.create).toHaveBeenCalledTimes(1);
  });

  // ── Test 2: existing guest by email → re-use, no new guest created ──────────

  it('re-uses existing guest when same email exists (Q3 deduplication)', async () => {
    txMock.guest.findFirst.mockResolvedValue(guestRecord);

    await service.createBooking(baseDto);

    expect(txMock.guest.findFirst).toHaveBeenCalledWith({
      where: { email: baseDto.email },
    });
    expect(txMock.guest.create).not.toHaveBeenCalled();
    const createArgs = txMock.reservation.create.mock.calls[0][0];
    expect(createArgs.data.guestId).toBe(guestRecord.id);
  });

  // ── Test 3: 23P01 exclusion violation → ConflictException ────────────────────

  it('throws ConflictException when reservation.create fails with 23P01 exclusion violation', async () => {
    const exclusionError = new PrismaClientKnownRequestError('exclusion violation', {
      code: 'P2010',
      clientVersion: '7.0.0',
      meta: { code: '23P01' },
    });
    txMock.reservation.create.mockRejectedValueOnce(exclusionError);

    await expect(service.createBooking(baseDto)).rejects.toThrow(ConflictException);
  });

  // ── Test 4: email is called AFTER $transaction ────────────────────────────────

  it('calls emailService.sendBookingConfirmation after the transaction resolves', async () => {
    const callOrder: string[] = [];
    prismaMock.$transaction.mockImplementationOnce(async (fn: (tx: typeof txMock) => Promise<unknown>) => {
      callOrder.push('transaction');
      return fn(txMock);
    });
    emailMock.sendBookingConfirmation.mockImplementationOnce(async () => {
      callOrder.push('email');
    });

    await service.createBooking(baseDto);

    const txIndex = callOrder.indexOf('transaction');
    const emailIndex = callOrder.indexOf('email');
    expect(txIndex).toBeGreaterThanOrEqual(0);
    expect(emailIndex).toBeGreaterThan(txIndex);
  });

  // ── Test 5: email rejection does NOT affect return value ─────────────────────

  it('still returns reservationId when sendBookingConfirmation rejects (fire-and-forget P4)', async () => {
    emailMock.sendBookingConfirmation.mockRejectedValueOnce(new Error('Resend down'));

    const result = await service.createBooking(baseDto);
    expect(result.reservationId).toBe(reservationRecord.id);
  });

  // ── Test 6: CreatePublicBookingDto Zod validation ─────────────────────────────

  it('Zod CreatePublicBookingSchema rejects missing required fields', () => {
    // Missing email → should fail
    const result = CreatePublicBookingSchema.safeParse({ ...baseDto, email: undefined });
    expect(result.success).toBe(false);

    // Invalid email format → should fail
    const result2 = CreatePublicBookingSchema.safeParse({ ...baseDto, email: 'not-an-email' });
    expect(result2.success).toBe(false);

    // Valid → should pass
    const result3 = CreatePublicBookingSchema.safeParse(baseDto);
    expect(result3.success).toBe(true);
  });

  // ── Phase 15 Tests ────────────────────────────────────────────────────────────

  // ── P15-1: Schema accepts new optional fields ─────────────────────────────────

  it('P15-1: CreatePublicBookingSchema accepts valid whatsappNumber (E.164) and contactPreference', () => {
    const result = CreatePublicBookingSchema.safeParse({
      ...baseDto,
      whatsappNumber: '+573001234567',
      contactPreference: 'WHATSAPP',
    });
    expect(result.success).toBe(true);
  });

  // ── P15-2: Schema rejects invalid E.164 ──────────────────────────────────────

  it('P15-2: CreatePublicBookingSchema rejects invalid E.164 whatsappNumber', () => {
    const result = CreatePublicBookingSchema.safeParse({
      ...baseDto,
      whatsappNumber: 'abc',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.issues;
      expect(issues.some((i) => i.path.includes('whatsappNumber'))).toBe(true);
    }
  });

  // ── P15-3: tx.guest.create receives all 6 new fields ─────────────────────────

  it('P15-3: creates guest with all 6 new fields when provided in DTO', async () => {
    const dtoWithAllFields: CreatePublicBookingDto = {
      ...baseDto,
      whatsappNumber: '+573001234567',
      contactPreference: 'WHATSAPP',
      dietaryRestrictions: 'sin gluten',
      specialRequests: 'vista al norte',
      marketingConsent: true,
      preferredLanguage: 'en',
    };

    await service.createBooking(dtoWithAllFields);

    expect(txMock.guest.create).toHaveBeenCalledTimes(1);
    const createCall = txMock.guest.create.mock.calls[0][0];
    expect(createCall.data.whatsappNumber).toBe('+573001234567');
    expect(createCall.data.contactPreference).toBe('WHATSAPP');
    expect(createCall.data.dietaryRestrictions).toBe('sin gluten');
    expect(createCall.data.specialRequests).toBe('vista al norte');
    expect(createCall.data.marketingConsent).toBe(true);
    expect(createCall.data.preferredLanguage).toBe('en');
  });

  // ── P15-4: applies Zod defaults when new fields absent ───────────────────────

  it('P15-4: applies Zod defaults + auto-derives whatsappNumber from phone', async () => {
    // baseDto does NOT include whatsappNumber, contactPreference, dietaryRestrictions, specialRequests.
    // 2026-05-27 — whatsappNumber is now auto-derived from phone (Colombian mobile → +57XXXXXXXXXX)
    // when the guest did not provide a separate WhatsApp number.
    const minimalDto = CreatePublicBookingSchema.parse({
      fullName: 'Test User',
      email: 'test@example.com',
      phone: '3001234567',
      documentType: 'CC',
      documentNumber: '9876543210',
      nationality: 'CO',
      dateOfBirth: '1985-03-20',
      roomId: 'cmtroomtest00010000roomid',
      roomTypeId: 'cmtroomtest00020000roomid',
      checkIn: '2026-08-01',
      checkOut: '2026-08-03',
      adults: 1,
    });

    await service.createBooking(minimalDto);

    const createCall = txMock.guest.create.mock.calls[0][0];
    expect(createCall.data.preferredLanguage).toBe('es');
    expect(createCall.data.marketingConsent).toBe(false);
    expect(createCall.data.contactPreference).toBeNull();
    // Phone '3001234567' is a 10-digit Colombian mobile → '+573001234567'
    expect(createCall.data.whatsappNumber).toBe('+573001234567');
    expect(createCall.data.dietaryRestrictions).toBeNull();
    expect(createCall.data.specialRequests).toBeNull();
  });

  // ── P15-5: dedup path — existing guest returned, new fields NOT written ───────

  it('P15-5: dedup path — existing guest returned unchanged, new DTO fields NOT written to DB', async () => {
    const existingGuest = {
      id: 'guest-id-existing',
      fullName: 'Ana Ríos',
      email: 'ana@example.com',
      whatsappNumber: '+57OLD0000001',
      contactPreference: 'EMAIL' as const,
      dietaryRestrictions: null,
      specialRequests: null,
    };

    txMock.guest.findFirst.mockResolvedValue(existingGuest);
    txMock.guest.create.mockResolvedValue(existingGuest); // not called but define anyway

    const dtoWithNewNumber: CreatePublicBookingDto = {
      ...baseDto,
      whatsappNumber: '+57NEW0000002',
    };

    await service.createBooking(dtoWithNewNumber);

    // create NOT called — dedup branch preserves existing values
    expect(txMock.guest.create).not.toHaveBeenCalled();

    // Email receives the OLD whatsappNumber from the existing guest
    expect(emailMock.sendBookingConfirmation).toHaveBeenCalledTimes(1);
    const emailCall = emailMock.sendBookingConfirmation.mock.calls[0][0];
    expect(emailCall.guestWhatsApp).toBe('+57OLD0000001');
    expect(emailCall.guestContactPreference).toBe('EMAIL');
  });

  // ── P15-6: sendBookingConfirmation receives 4 preference scalars ──────────────

  it('P15-6: sendBookingConfirmation is called with guestWhatsApp, guestContactPreference, guestDietaryRestrictions, guestSpecialRequests', async () => {
    const guestWithPrefs = {
      id: 'guest-id-002',
      fullName: 'Test Guest',
      email: 'test@example.com',
      whatsappNumber: '+573009876543',
      contactPreference: 'WHATSAPP' as const,
      dietaryRestrictions: 'vegetariano',
      specialRequests: 'cuna para bebé',
    };

    txMock.guest.create.mockResolvedValue(guestWithPrefs);

    const dtoFull: CreatePublicBookingDto = {
      ...baseDto,
      email: 'test@example.com',
      fullName: 'Test Guest',
      whatsappNumber: '+573009876543',
      contactPreference: 'WHATSAPP',
      dietaryRestrictions: 'vegetariano',
      specialRequests: 'cuna para bebé',
    };

    await service.createBooking(dtoFull);

    expect(emailMock.sendBookingConfirmation).toHaveBeenCalledTimes(1);
    const emailCall = emailMock.sendBookingConfirmation.mock.calls[0][0];
    expect(emailCall.guestWhatsApp).toBe('+573009876543');
    expect(emailCall.guestContactPreference).toBe('WHATSAPP');
    expect(emailCall.guestDietaryRestrictions).toBe('vegetariano');
    expect(emailCall.guestSpecialRequests).toBe('cuna para bebé');

    // marketingConsent is NOT in the email payload (hotel-internal flag only)
    expect(emailCall).not.toHaveProperty('marketingConsent');
  });

  // ── RP-1: valid ratePlanId → persisted on reservation ────────────────────────

  it('RP-1: valid ratePlanId is validated and persisted on the reservation', async () => {
    const { BadRequestException: _BadRequestException } = await import('@nestjs/common');
    const PLAN_ID = 'cmvalidplanid000000000001';
    const ROOM_TYPE_ID = baseDto.roomTypeId;

    prismaMock.ratePlan.findUnique.mockResolvedValueOnce({
      id: PLAN_ID,
      roomTypeId: ROOM_TYPE_ID,
      isActive: true,
      type: 'PACKAGE',
    });

    const dto: CreatePublicBookingDto = { ...baseDto, ratePlanId: PLAN_ID };
    await service.createBooking(dto);

    // reservation.create should have ratePlanId set
    const createArgs = txMock.reservation.create.mock.calls[0][0];
    expect(createArgs.data.ratePlanId).toBe(PLAN_ID);

    // pricingService should have been called with ratePlanType='PACKAGE'
    expect(pricingMock.calculateBreakdown).toHaveBeenCalledWith(
      expect.objectContaining({ ratePlanType: 'PACKAGE' }),
    );
  });

  // ── RP-2: ratePlanId belonging to wrong roomTypeId → BadRequest ─────────────

  it('RP-2: throws BadRequestException when ratePlanId belongs to a different roomTypeId', async () => {
    const { BadRequestException } = await import('@nestjs/common');
    const PLAN_ID = 'cmvalidplanid000000000002';
    const WRONG_ROOM_TYPE = 'cmother000000000000000001';

    prismaMock.ratePlan.findUnique.mockResolvedValueOnce({
      id: PLAN_ID,
      roomTypeId: WRONG_ROOM_TYPE,  // does NOT match baseDto.roomTypeId
      isActive: true,
      type: 'BAR',
    });

    const dto: CreatePublicBookingDto = { ...baseDto, ratePlanId: PLAN_ID };
    await expect(service.createBooking(dto)).rejects.toThrow(BadRequestException);
  });

  // ── RP-3: inactive ratePlanId → BadRequest ────────────────────────────────────

  it('RP-3: throws BadRequestException when ratePlanId is inactive', async () => {
    const { BadRequestException } = await import('@nestjs/common');
    const PLAN_ID = 'cmvalidplanid000000000003';

    prismaMock.ratePlan.findUnique.mockResolvedValueOnce({
      id: PLAN_ID,
      roomTypeId: baseDto.roomTypeId,
      isActive: false,  // inactive
      type: 'PROMO',
    });

    const dto: CreatePublicBookingDto = { ...baseDto, ratePlanId: PLAN_ID };
    await expect(service.createBooking(dto)).rejects.toThrow(BadRequestException);
  });

  // ── RP-4: no ratePlanId → BAR, ratePlanId=null on reservation (backward compat) ─

  it('RP-4: no ratePlanId → defaults to BAR, ratePlanId is null on reservation', async () => {
    // baseDto has no ratePlanId
    await service.createBooking(baseDto);

    const createArgs = txMock.reservation.create.mock.calls[0][0];
    expect(createArgs.data.ratePlanId).toBeNull();
    expect(pricingMock.calculateBreakdown).toHaveBeenCalledWith(
      expect.objectContaining({ ratePlanType: 'BAR' }),
    );
    // ratePlan.findUnique should NOT have been called
    expect(prismaMock.ratePlan.findUnique).not.toHaveBeenCalled();
  });

  // ── RP-5: ratePlanId not found in DB → BadRequest ──────────────────────────

  it('RP-5: throws BadRequestException when ratePlanId is not found in DB', async () => {
    const { BadRequestException } = await import('@nestjs/common');
    prismaMock.ratePlan.findUnique.mockResolvedValueOnce(null);

    const dto: CreatePublicBookingDto = {
      ...baseDto,
      ratePlanId: 'cmvalidplanid000000000009',
    };
    await expect(service.createBooking(dto)).rejects.toThrow(BadRequestException);
  });

  // ── RT-1: offer with roomTypeId — mismatched roomTypeId in booking → BadRequest ─

  it('RT-1: throws BadRequestException when offer.roomType does not match dto.roomTypeId', async () => {
    const { BadRequestException } = await import('@nestjs/common');
    const OFFER_ROOM_TYPE_ID = 'cuid0000000000000000000010';
    const OTHER_ROOM_TYPE_ID = 'cuid0000000000000000000011';

    prismaMock.offer.findUnique.mockResolvedValueOnce({
      id: 'cmoffer0000000000000000001',
      isActive: true,
      validFrom: null,
      validTo: null,
      roomType: { id: OFFER_ROOM_TYPE_ID, name: 'Suite Sumapaz' },
    });

    const dtoWithWrongType: CreatePublicBookingDto = {
      ...baseDto,
      roomTypeId: OTHER_ROOM_TYPE_ID,
      sourceOfferId: 'cmoffer0000000000000000001',
    };

    await expect(service.createBooking(dtoWithWrongType)).rejects.toThrow(
      BadRequestException,
    );
  });
});
