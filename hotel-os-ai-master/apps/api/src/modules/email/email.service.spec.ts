import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  EmailService,
  BookingConfirmationParams,
  ReviewInviteParams,
} from './email.service';

// ─── Mock Resend ──────────────────────────────────────────────────────────────

const sendMock = vi.fn();

vi.mock('resend', () => {
  class Resend {
    emails = {
      send: sendMock,
    };

    constructor(_apiKey: string) {}
  }

  return { Resend };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeParams = (
  overrides: Partial<BookingConfirmationParams> = {},
): BookingConfirmationParams => ({
  to: 'guest@example.com',
  guestName: 'Juan García',
  reservationId: 'res-abc-123',
  checkIn: '2026-06-01',
  checkOut: '2026-06-03',
  roomTypeName: 'Suite Doble',
  totalNights: 2,
  total: 450000,
  ...overrides,
});

// ─── Helpers: Review Invite ──────────────────────────────────────────────────

const makeReviewInviteParams = (
  overrides: Partial<ReviewInviteParams> = {},
): ReviewInviteParams => ({
  to: 'guest@example.com',
  guestName: 'Ana García',
  hotelName: 'Hotel Sumapaz',
  stayDate: '2026-05-10',
  reviewLink:
    'https://hotel.co/review/submit?token=abc.def.ghi',
  ...overrides,
});

// ─── EmailService Tests ──────────────────────────────────────────────────────

describe('EmailService', () => {
  let service: EmailService;

  /**
   * Crea el módulo de pruebas con ConfigService completo.
   *
   * IMPORTANTE:
   * EmailService usa config.get(), por eso el mock
   * debe implementar get().
   */
  const buildModule = async (
    resendApiKey = 're_test_key',
    fromEmail = 'onboarding@resend.dev',
  ) => {
    const module = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'RESEND_API_KEY') return resendApiKey;
              if (key === 'RESEND_FROM_EMAIL') return fromEmail;
              return undefined;
           },
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

    sendMock.mockResolvedValue({
      id: 'email-123',
    });
  });

  // ── Test 1: envío exitoso ─────────────────────────────────────────────────

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

  // ── Test 2: error de Resend no debe romper la reserva ─────────────────────

  it('resolves normally when resend.emails.send rejects', async () => {
    service = await buildModule();

    sendMock.mockRejectedValueOnce(
      new Error('Resend network error'),
    );

    await expect(
      service.sendBookingConfirmation(makeParams()),
    ).resolves.toBeUndefined();

    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  // ── Test 3: variable de entorno faltante ─────────────────────────────────

  it('throws at construction when RESEND_API_KEY env var is missing', async () => {
    await expect(
      Test.createTestingModule({
        providers: [
          EmailService,
          {
            provide: ConfigService,
            useValue: {
              get: (key: string) => {
                if (key === 'RESEND_API_KEY') {
                  return undefined;
                }

                if (key === 'RESEND_FROM_EMAIL') {
                  return 'noreply@hotel.co';
                }

                return undefined;
              },

              getOrThrow: (key: string) => {
                throw new Error(
                  `Config key "${key}" is missing`,
                );
              },
            },
          },
        ],
      }).compile(),
    ).rejects.toThrow();
  });

  // ── P15-E1 ────────────────────────────────────────────────────────────────

  it(
    'P15-E1: omits preferences section when all preferences are null',
    async () => {
      service = await buildModule();

      await service.sendBookingConfirmation(
        makeParams({
          guestWhatsApp: null,
          guestContactPreference: null,
          guestDietaryRestrictions: null,
          guestSpecialRequests: null,
        }),
      );

      const html = sendMock.mock.calls[0][0].html as string;

      expect(html).not.toContain('Sus preferencias');
    },
  );

  // ── P15-E2 ────────────────────────────────────────────────────────────────

  it(
    'P15-E2: includes preferences section when guestWhatsApp is set',
    async () => {
      service = await buildModule();

      await service.sendBookingConfirmation(
        makeParams({
          guestWhatsApp: '+573001234567',
        }),
      );

      const html = sendMock.mock.calls[0][0].html as string;

      expect(html).toContain('Sus preferencias');

      expect(html).toContain(
        'WhatsApp: <strong>+573001234567</strong>',
      );
    },
  );

  // ── P15-E3 ────────────────────────────────────────────────────────────────

  it(
    'P15-E3: contains 4 preference lines when all fields are set',
    async () => {
      service = await buildModule();

      await service.sendBookingConfirmation(
        makeParams({
          guestWhatsApp: '+573001234567',
          guestContactPreference: 'WHATSAPP',
          guestDietaryRestrictions: 'sin gluten',
          guestSpecialRequests: 'cuna para bebé',
        }),
      );

      const html = sendMock.mock.calls[0][0].html as string;

      expect(html).toContain('Sus preferencias');

      const prefSection = html.substring(
        html.indexOf('Sus preferencias'),
      );

      const pCount =
        (prefSection.match(/<p /g) ?? []).length;

      expect(pCount).toBeGreaterThanOrEqual(4);
    },
  );

  // ── P15-E4 ────────────────────────────────────────────────────────────────

  it(
    'P15-E4: escapes script in guestDietaryRestrictions',
    async () => {
      service = await buildModule();

      await service.sendBookingConfirmation(
        makeParams({
          guestDietaryRestrictions:
            '<script>alert(1)</script>',
        }),
      );

      const html = sendMock.mock.calls[0][0].html as string;

      expect(html).toContain(
        '&lt;script&gt;alert(1)&lt;/script&gt;',
      );

      expect(html).not.toContain(
        '<script>alert(1)</script>',
      );
    },
  );

  // ── P15-E5 ────────────────────────────────────────────────────────────────

  it(
    'P15-E5: escapes script in guestSpecialRequests',
    async () => {
      service = await buildModule();

      await service.sendBookingConfirmation(
        makeParams({
          guestSpecialRequests:
            '<script>alert(1)</script>',
        }),
      );

      const html = sendMock.mock.calls[0][0].html as string;

      expect(html).toContain(
        '&lt;script&gt;alert(1)&lt;/script&gt;',
      );

      expect(html).not.toContain(
        '<script>alert(1)</script>',
      );
    },
  );

  // ── P15-E6 ────────────────────────────────────────────────────────────────

  it(
    'P15-E6: maps contact preference values to Spanish labels',
    async () => {
      service = await buildModule();

      // EMAIL
      await service.sendBookingConfirmation(
        makeParams({
          guestContactPreference: 'EMAIL',
        }),
      );

      const html1 =
        sendMock.mock.calls[0][0].html as string;

      expect(html1).toContain(
        'Correo electrónico',
      );

      // PHONE
      vi.clearAllMocks();

      sendMock.mockResolvedValue({
        id: 'email-123',
      });

      await service.sendBookingConfirmation(
        makeParams({
          guestContactPreference: 'PHONE',
        }),
      );

      const html2 =
        sendMock.mock.calls[0][0].html as string;

      expect(html2).toContain('Teléfono');

      // WHATSAPP
      vi.clearAllMocks();

      sendMock.mockResolvedValue({
        id: 'email-123',
      });

      await service.sendBookingConfirmation(
        makeParams({
          guestContactPreference: 'WHATSAPP',
        }),
      );

      const html3 =
        sendMock.mock.calls[0][0].html as string;

      expect(html3).toContain('WhatsApp');
    },
  );

  // ── P15-E7 ────────────────────────────────────────────────────────────────

  it(
    'P15-E7: empty WhatsApp does not render preferences section',
    async () => {
      service = await buildModule();

      await service.sendBookingConfirmation(
        makeParams({
          guestWhatsApp: '',
        }),
      );

      const html = sendMock.mock.calls[0][0].html as string;

      expect(html).not.toContain('Sus preferencias');
    },
  );
});

// ─── sendReviewInvite Tests ──────────────────────────────────────────────────

describe('EmailService.sendReviewInvite', () => {
  let service: EmailService;

  /**
   * IMPORTANTE:
   * También necesitamos get() aquí porque EmailService
   * lo utiliza en el constructor.
   */
  const buildModule = async (
    resendApiKey = 're_test_key',
    fromEmail = 'noreply@hotel.co',
  ) => {
    const module = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'RESEND_API_KEY') {
                return resendApiKey;
              }

              if (key === 'RESEND_FROM_EMAIL') {
                return fromEmail;
              }

              return undefined;
            },

            getOrThrow: (key: string) => {
              if (key === 'RESEND_API_KEY') {
                return resendApiKey;
              }

              if (key === 'RESEND_FROM_EMAIL') {
                return fromEmail;
              }

              throw new Error(
                `Unknown config key: ${key}`,
              );
            },
          },
        },
      ],
    }).compile();

    return module.get(EmailService);
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    sendMock.mockResolvedValue({
      id: 'email-invite-123',
    });

    service = await buildModule();
  });

  // ── Test 1 ────────────────────────────────────────────────────────────────

  it(
    'Test 1: resolves when Resend.emails.send resolves',
    async () => {
      await expect(
        service.sendReviewInvite(
          makeReviewInviteParams(),
        ),
      ).resolves.toBeUndefined();

      expect(sendMock).toHaveBeenCalledTimes(1);
    },
  );

  // ── Test 2 ────────────────────────────────────────────────────────────────

  it(
    'Test 2: RE-THROWS when Resend.emails.send rejects',
    async () => {
      sendMock.mockRejectedValueOnce(
        new Error('Resend network error'),
      );

      await expect(
        service.sendReviewInvite(
          makeReviewInviteParams(),
        ),
      ).rejects.toThrow('Resend network error');

      expect(sendMock).toHaveBeenCalledTimes(1);
    },
  );

  // ── Test 3 ────────────────────────────────────────────────────────────────

  it(
    'Test 3: email subject is exactly correct',
    async () => {
      const params = makeReviewInviteParams();

      await service.sendReviewInvite(params);

      const callArg = sendMock.mock.calls[0][0];

      expect(callArg.subject).toBe(
        `Cuéntanos sobre tu estadía en ${params.hotelName}`,
      );
    },
  );

  // ── Test 4 ────────────────────────────────────────────────────────────────

  it(
    'Test 4: HTML contains reviewLink as href',
    async () => {
      const params = makeReviewInviteParams();

      await service.sendReviewInvite(params);

      const html =
        sendMock.mock.calls[0][0].html as string;

      expect(html).toContain(
        `href="${params.reviewLink}"`,
      );
    },
  );

  // ── Test 5 ────────────────────────────────────────────────────────────────

  it(
    'Test 5: HTML contains guestName, hotelName and stayDate',
    async () => {
      const params = makeReviewInviteParams();

      await service.sendReviewInvite(params);

      const html =
        sendMock.mock.calls[0][0].html as string;

      expect(html).toContain(params.guestName);
      expect(html).toContain(params.hotelName);

      expect(html.length).toBeGreaterThan(200);
    },
  );

  // ── Test 6 ────────────────────────────────────────────────────────────────

  it(
    'Test 6: HTML uses warm palette',
    async () => {
      const params = makeReviewInviteParams();

      await service.sendReviewInvite(params);

      const html =
        sendMock.mock.calls[0][0].html as string;

      expect(html).toContain('#c4623f');

      expect(html).toContain(
        'Instrument Serif',
      );
    },
  );
});


