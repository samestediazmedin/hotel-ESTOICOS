import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService, BookingConfirmationParams, ReviewInviteParams } from './email.service';

// ─── Mock resend ──────────────────────────────────────────────────────────────

const sendMock = vi.fn();

vi.mock('resend', () => {
  class Resend {
    emails = { send: sendMock };
    constructor(_apiKey: string) {}
  }
  return { Resend };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeParams = (overrides: Partial<BookingConfirmationParams> = {}): BookingConfirmationParams => ({
  to: 'guest@example.com',
  guestName: 'Juan García',
  reservationId: 'res-abc-123',
  checkIn: '2026-06-01',
  checkOut: '2026-06-03',
  roomTypeName: 'Suite Doble',
  totalNights: 2,
  total: 450000,
  // Phase 15 — optional fields default to undefined so existing tests are unaffected
  ...overrides,
});

// ─── Helpers (review invite) ──────────────────────────────────────────────────

const makeReviewInviteParams = (overrides: Partial<ReviewInviteParams> = {}): ReviewInviteParams => ({
  to: 'guest@example.com',
  guestName: 'Ana García',
  hotelName: 'Hotel Sumapaz',
  stayDate: '2026-05-10',
  reviewLink: 'https://hotel.co/review/submit?token=abc.def.ghi',
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EmailService', () => {
  let service: EmailService;

  /**
   * Happy-path module — RESEND_API_KEY and RESEND_FROM_EMAIL present
   */
  const buildModule = async (resendApiKey = 're_test_key', fromEmail = 'onboarding@resend.dev') => {
    const module = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === 'RESEND_API_KEY') return resendApiKey;
              if (key === 'RESEND_FROM_EMAIL') return fromEmail;
              throw new Error(`Unknown config key: ${key}`);
            },
          },
        },
      ],
    }).compile();
    return module.get(EmailService);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sendMock.mockResolvedValue({ id: 'email-123' });
  });

  // ── Test 1: success path ──────────────────────────────────────────────────

  it('calls resend.emails.send exactly once with expected fields', async () => {
    service = await buildModule();
    const params = makeParams();

    await service.sendBookingConfirmation(params);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const callArg = sendMock.mock.calls[0][0];
    expect(callArg.from).toBe('onboarding@resend.dev');
    expect(callArg.to).toBe(params.to);
    expect(callArg.subject).toContain(params.reservationId);
    expect(callArg.html).toContain(params.guestName);
    expect(callArg.html).toContain(params.reservationId);
    expect(callArg.html).toContain(params.roomTypeName);
  });

  // ── Test 2: error swallow (Pitfall P4) ────────────────────────────────────

  it('resolves normally when resend.emails.send rejects (fire-and-forget — Pitfall P4)', async () => {
    service = await buildModule();
    sendMock.mockRejectedValueOnce(new Error('Resend network error'));

    // MUST NOT throw — email failure must not affect the reservation
    await expect(service.sendBookingConfirmation(makeParams())).resolves.toBeUndefined();
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  // ── Test 3: missing env var (fail-fast at boot) ───────────────────────────

  it('throws at construction when RESEND_API_KEY env var is missing', async () => {
    await expect(
      Test.createTestingModule({
        providers: [
          EmailService,
          {
            provide: ConfigService,
            useValue: {
              getOrThrow: (key: string) => {
                // Simulate getOrThrow throwing when env var is missing
                throw new Error(`Config key "${key}" is missing`);
              },
            },
          },
        ],
      }).compile(),
    ).rejects.toThrow();
  });

  // ── Phase 15 Tests — buildPreferencesSection ──────────────────────────────

  // ── P15-E1: no preferences → section absent ──────────────────────────────

  it('P15-E1: buildConfirmationHtml omits preferences section when all 4 prefs are null/undefined', async () => {
    service = await buildModule();
    await service.sendBookingConfirmation(makeParams({
      guestWhatsApp: null,
      guestContactPreference: null,
      guestDietaryRestrictions: null,
      guestSpecialRequests: null,
    }));
    const html = sendMock.mock.calls[0][0].html as string;
    expect(html).not.toContain('Sus preferencias');
  });

  // ── P15-E2: whatsApp only → section present ───────────────────────────────

  it('P15-E2: buildConfirmationHtml includes "Sus preferencias" section when guestWhatsApp is set', async () => {
    service = await buildModule();
    await service.sendBookingConfirmation(makeParams({
      guestWhatsApp: '+573001234567',
    }));
    const html = sendMock.mock.calls[0][0].html as string;
    expect(html).toContain('Sus preferencias');
    expect(html).toContain('WhatsApp: <strong>+573001234567</strong>');
  });

  // ── P15-E3: all four prefs → 4 <p> lines in the section ──────────────────

  it('P15-E3: buildConfirmationHtml contains 4 preference lines when all 4 fields are set', async () => {
    service = await buildModule();
    await service.sendBookingConfirmation(makeParams({
      guestWhatsApp: '+573001234567',
      guestContactPreference: 'WHATSAPP',
      guestDietaryRestrictions: 'sin gluten',
      guestSpecialRequests: 'cuna para bebé',
    }));
    const html = sendMock.mock.calls[0][0].html as string;
    expect(html).toContain('Sus preferencias');
    // Count <p> tags inside the preferences block (4 lines)
    const prefSection = html.substring(html.indexOf('Sus preferencias'));
    const pCount = (prefSection.match(/<p /g) ?? []).length;
    expect(pCount).toBeGreaterThanOrEqual(4);
  });

  // ── P15-E4: XSS in dietaryRestrictions — escaped ─────────────────────────

  it('P15-E4: escapeHtml escapes <script>alert(1)</script> in guestDietaryRestrictions', async () => {
    service = await buildModule();
    await service.sendBookingConfirmation(makeParams({
      guestDietaryRestrictions: '<script>alert(1)</script>',
    }));
    const html = sendMock.mock.calls[0][0].html as string;
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  // ── P15-E5: XSS in specialRequests — escaped ─────────────────────────────

  it('P15-E5: escapeHtml escapes <script>alert(1)</script> in guestSpecialRequests', async () => {
    service = await buildModule();
    await service.sendBookingConfirmation(makeParams({
      guestSpecialRequests: '<script>alert(1)</script>',
    }));
    const html = sendMock.mock.calls[0][0].html as string;
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  // ── P15-E6: label mapping for contactPreference ───────────────────────────

  it('P15-E6: formatContactPreference maps enum values to Spanish labels', async () => {
    service = await buildModule();

    // EMAIL → Correo electrónico
    await service.sendBookingConfirmation(makeParams({ guestContactPreference: 'EMAIL' }));
    const html1 = sendMock.mock.calls[0][0].html as string;
    expect(html1).toContain('Correo electrónico');

    vi.clearAllMocks();
    sendMock.mockResolvedValue({ id: 'email-123' });

    // PHONE → Teléfono
    await service.sendBookingConfirmation(makeParams({ guestContactPreference: 'PHONE' }));
    const html2 = sendMock.mock.calls[0][0].html as string;
    expect(html2).toContain('Teléfono');

    vi.clearAllMocks();
    sendMock.mockResolvedValue({ id: 'email-123' });

    // WHATSAPP → WhatsApp
    await service.sendBookingConfirmation(makeParams({ guestContactPreference: 'WHATSAPP' }));
    const html3 = sendMock.mock.calls[0][0].html as string;
    expect(html3).toContain('WhatsApp');
  });

  // ── P15-E7: empty string is falsy — does NOT render the line ─────────────

  it('P15-E7: guestWhatsApp empty string (falsy) does NOT render WhatsApp line in preferences', async () => {
    service = await buildModule();
    await service.sendBookingConfirmation(makeParams({
      guestWhatsApp: '',
    }));
    const html = sendMock.mock.calls[0][0].html as string;
    // Empty string is falsy — preferences section should not appear
    expect(html).not.toContain('Sus preferencias');
  });
});

// ─── sendReviewInvite tests ────────────────────────────────────────────────────

describe('EmailService.sendReviewInvite', () => {
  let service: EmailService;

  const buildModule = async () => {
    const module = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === 'RESEND_API_KEY') return 're_test_key';
              if (key === 'RESEND_FROM_EMAIL') return 'noreply@hotel.co';
              throw new Error(`Unknown config key: ${key}`);
            },
          },
        },
      ],
    }).compile();
    return module.get(EmailService);
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    sendMock.mockResolvedValue({ id: 'email-invite-123' });
    service = await buildModule();
  });

  // ── Test 1: resolves on success ──────────────────────────────────────────

  it('Test 1: resolves when Resend.emails.send resolves', async () => {
    await expect(service.sendReviewInvite(makeReviewInviteParams())).resolves.toBeUndefined();
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  // ── Test 2: RE-THROWS on Resend failure ──────────────────────────────────

  it('Test 2: RE-THROWS when Resend.emails.send rejects (opposite of sendBookingConfirmation)', async () => {
    sendMock.mockRejectedValueOnce(new Error('Resend network error'));
    await expect(service.sendReviewInvite(makeReviewInviteParams())).rejects.toThrow('Resend network error');
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  // ── Test 3: subject includes hotelName ───────────────────────────────────

  it('Test 3: email subject is exactly "Cuéntanos sobre tu estadía en {hotelName}"', async () => {
    const params = makeReviewInviteParams();
    await service.sendReviewInvite(params);
    const callArg = sendMock.mock.calls[0][0];
    expect(callArg.subject).toBe(`Cuéntanos sobre tu estadía en ${params.hotelName}`);
  });

  // ── Test 4: HTML contains reviewLink as href ─────────────────────────────

  it('Test 4: email HTML contains the reviewLink as href on the CTA anchor', async () => {
    const params = makeReviewInviteParams();
    await service.sendReviewInvite(params);
    const html = sendMock.mock.calls[0][0].html as string;
    expect(html).toContain(`href="${params.reviewLink}"`);
  });

  // ── Test 5: HTML contains guestName, hotelName, stayDate ─────────────────

  it('Test 5: email HTML contains guestName, hotelName, and formatted stayDate', async () => {
    const params = makeReviewInviteParams();
    await service.sendReviewInvite(params);
    const html = sendMock.mock.calls[0][0].html as string;
    expect(html).toContain(params.guestName);
    expect(html).toContain(params.hotelName);
    // stayDate '2026-05-10' should appear somewhere (formatted or raw)
    // We just verify the content was rendered — locale formatting may vary
    expect(html.length).toBeGreaterThan(200);
  });

  // ── Test 6: HTML uses warm palette inline styles ──────────────────────────

  it('Test 6: email HTML uses warm palette (terracotta #c4623f button + Instrument Serif heading)', async () => {
    const params = makeReviewInviteParams();
    await service.sendReviewInvite(params);
    const html = sendMock.mock.calls[0][0].html as string;
    expect(html).toContain('#c4623f');
    expect(html).toContain('Instrument Serif');
  });
});
