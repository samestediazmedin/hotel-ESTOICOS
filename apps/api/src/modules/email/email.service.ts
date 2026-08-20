import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface BookingConfirmationParams {
  to: string;
  guestName: string;
  reservationId: string;
  checkIn: string;    // "YYYY-MM-DD"
  checkOut: string;   // "YYYY-MM-DD"
  roomTypeName: string;
  totalNights: number;
  total: number;
  // Phase 15 — guest preferences (all optional, all nullable — GCC-05)
  guestWhatsApp?: string | null;
  guestContactPreference?: 'EMAIL' | 'PHONE' | 'WHATSAPP' | null;
  guestDietaryRestrictions?: string | null;
  guestSpecialRequests?: string | null;
}

export interface PreArrivalReminderParams {
  to: string;
  guestName: string;
  hotelName: string;
  hotelAddress?: string | null;
  hotelPhone?: string | null;
  checkInDate: string;    // "YYYY-MM-DD"
  checkOutDate: string;   // "YYYY-MM-DD"
  roomTypeName: string;
  totalNights: number;
  specialRequests?: string | null;
}

export interface ReviewInviteParams {
  to: string;
  guestName: string;
  hotelName: string;
  stayDate: string;    // "YYYY-MM-DD"
  reviewLink: string;  // full URL: https://hotel.co/review/submit?token=...
}

/**
 * EmailService — Resend transactional email integration (PUB-05).
 *
 * CRITICAL (Pitfall P4): sendBookingConfirmation NEVER throws.
 * Email failure must NOT roll back the reservation transaction.
 * All errors are caught internally and logged.
 *
 * The caller uses fire-and-forget: `void this.emailService.sendBookingConfirmation(...)`.
 */
@Injectable()
export class EmailService {
  private readonly resend: Resend;
  private readonly fromEmail: string;
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {
    this.resend = new Resend(this.config.getOrThrow<string>('RESEND_API_KEY'));
    this.fromEmail = this.config.getOrThrow<string>('RESEND_FROM_EMAIL');
  }

  /**
   * Send booking confirmation email.
   *
   * Fire-and-forget safe: catches all errors internally and never throws.
   * Use with `void` at the call site:
   *   void this.emailService.sendBookingConfirmation(params);
   */
  async sendBookingConfirmation(params: BookingConfirmationParams): Promise<void> {
    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: params.to,
        subject: `Confirmación de reserva — ${params.reservationId}`,
        html: this.buildConfirmationHtml(params),
      });
    } catch (err) {
      // Pitfall P4: log but do NOT re-throw — email failure must not affect the reservation
      this.logger.error(
        `Failed to send booking confirmation to ${params.to} for reservation ${params.reservationId}`,
        err,
      );
    }
  }

  /**
   * Send pre-arrival reminder email (1 day before check-in).
   *
   * Fire-and-forget safe: catches all errors internally and never throws.
   * The cron loop handles failures by not marking the reminder as sent.
   */
  async sendPreArrivalReminder(params: PreArrivalReminderParams): Promise<void> {
    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: params.to,
        subject: `Recordatorio: Tu estadía en ${this.escapeHtml(params.hotelName)} comienza mañana`,
        html: this.buildPreArrivalReminderHtml(params),
      });
    } catch (err) {
      this.logger.error(
        `Failed to send pre-arrival reminder to ${params.to} for check-in ${params.checkInDate}`,
        err,
      );
      throw err; // Re-throw so cron can handle failure and retry next run
    }
  }

  private buildPreArrivalReminderHtml(params: PreArrivalReminderParams): string {
    const formatDate = (iso: string) => {
      const d = new Date(iso + 'T12:00:00.000Z');
      return d.toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
    };

    const specialRequestsHtml = params.specialRequests
      ? `<p style="font-size:14px;color:#5a4d3f;margin:6px 0;"><strong>Solicitudes especiales:</strong> ${this.escapeHtml(params.specialRequests)}</p>`
      : '';

    const addressHtml = params.hotelAddress
      ? `<p style="font-size:14px;color:#5a4d3f;margin:6px 0;"><strong>Dirección:</strong> ${this.escapeHtml(params.hotelAddress)}</p>`
      : '';

    const phoneHtml = params.hotelPhone
      ? `<p style="font-size:14px;color:#5a4d3f;margin:6px 0;"><strong>Teléfono:</strong> ${this.escapeHtml(params.hotelPhone)}</p>`
      : '';

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recordatorio de llegada</title>
</head>
<body style="font-family: Geist, Arial, sans-serif; background: #f9f5f0; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: #2a221a; color: #faf7f2; padding: 32px; text-align: center;">
      <h1 style="margin: 0; font-size: 26px; font-weight: normal; font-family: 'Instrument Serif', Georgia, serif; color: #faf7f2;">¡Nos vemos mañana!</h1>
    </div>
    <div style="padding: 32px;">
      <p style="font-size: 16px; color: #333; margin-top: 0;">
        Hola, <strong>${this.escapeHtml(params.guestName)}</strong>. Te recordamos que tu estadía en <strong>${this.escapeHtml(params.hotelName)}</strong> comienza mañana.
      </p>
      <div style="margin: 24px 0; padding: 20px; background: #f4efe6; border-radius: 8px;">
        <h2 style="font-family: 'Instrument Serif', Georgia, serif; font-size: 18px; color: #2a221a; margin: 0 0 16px; font-weight: normal;">Detalles de tu reserva</h2>
        <p style="font-size:14px;color:#5a4d3f;margin:6px 0;"><strong>Check-in:</strong> ${formatDate(params.checkInDate)}</p>
        <p style="font-size:14px;color:#5a4d3f;margin:6px 0;"><strong>Check-out:</strong> ${formatDate(params.checkOutDate)}</p>
        <p style="font-size:14px;color:#5a4d3f;margin:6px 0;"><strong>Habitación:</strong> ${this.escapeHtml(params.roomTypeName)}</p>
        <p style="font-size:14px;color:#5a4d3f;margin:6px 0;"><strong>Noches:</strong> ${params.totalNights}</p>
        ${addressHtml}
        ${phoneHtml}
        ${specialRequestsHtml}
      </div>
      <p style="font-size: 14px; color: #666;">
        Si tienes alguna pregunta o necesitas modificar tu reserva, no dudes en contactarnos.
      </p>
      <p style="font-size: 14px; color: #999; margin-bottom: 0;">
        ¡Te esperamos!
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Send review invite email.
   *
   * CRITICAL: Unlike sendBookingConfirmation, this method RE-THROWS on Resend error.
   * The cron loop catches the error per-reservation and skips updating reviewInviteSentAt.
   * This ensures the stamp is only written on confirmed delivery.
   */
  async sendReviewInvite(params: ReviewInviteParams): Promise<void> {
    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: params.to,
        subject: `Cuéntanos sobre tu estadía en ${params.hotelName}`,
        html: this.buildReviewInviteHtml(params),
      });
    } catch (err) {
      this.logger.error(
        `Failed to send review invite to ${params.to}`,
        err,
      );
      throw err; // CRITICAL: re-throw so cron skips marking reviewInviteSentAt
    }
  }

  private buildReviewInviteHtml(params: ReviewInviteParams): string {
    const formatDate = (iso: string) => {
      const d = new Date(iso + 'T12:00:00.000Z');
      return d.toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
    };

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cuéntanos sobre tu estadía</title>
</head>
<body style="font-family: Geist, Arial, sans-serif; background: #f9f5f0; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: #2a221a; color: #faf7f2; padding: 32px; text-align: center;">
      <h1 style="margin: 0; font-size: 26px; font-weight: normal; font-family: 'Instrument Serif', Georgia, serif; color: #faf7f2;">¡Gracias por tu visita!</h1>
    </div>
    <div style="padding: 32px;">
      <p style="font-size: 16px; color: #333; margin-top: 0;">
        Hola, <strong>${this.escapeHtml(params.guestName)}</strong>. Esperamos que hayas disfrutado tu estadía en ${this.escapeHtml(params.hotelName)} (${formatDate(params.stayDate)}).
      </p>
      <p style="font-size: 15px; color: #555;">
        Nos encantaría conocer tu opinión — toma 2 minutos:
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${params.reviewLink}" style="display:inline-block; background:#c4623f; color:#faf7f2; padding:12px 28px; border-radius:8px; text-decoration:none; font-family:Geist,Arial,sans-serif; font-size:16px; font-weight:600;">Dejar mi reseña</a>
      </div>
      <p style="font-size: 12px; color: #8a7d6e; text-align: center; margin-bottom: 0;">
        Este enlace expira en 90 días.
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Escape HTML special characters to prevent XSS in user-provided text.
   * Applied to ALL user-supplied string fields: guestName, hotelName, roomTypeName,
   * dietaryRestrictions, specialRequests.
   * NOT applied to whatsappNumber (E.164 regex-validated, only digits + leading +)
   * or contactPreference (enum, server-controlled).
   */
  private escapeHtml(str: string): string {
    return str
      .replaceAll(/&/g, '&amp;')
      .replaceAll(/</g, '&lt;')
      .replaceAll(/>/g, '&gt;')
      .replaceAll(/"/g, '&quot;')
      .replaceAll(/'/g, '&#039;');
  }

  /**
   * Map ContactPreference enum value to human-readable Spanish label.
   */
  private formatContactPreference(pref: 'EMAIL' | 'PHONE' | 'WHATSAPP'): string {
    const labels: Record<'EMAIL' | 'PHONE' | 'WHATSAPP', string> = {
      EMAIL: 'Correo electrónico',
      PHONE: 'Teléfono',
      WHATSAPP: 'WhatsApp',
    };
    return labels[pref];
  }

  /**
   * Build the "Sus preferencias" conditional section.
   * Returns empty string if none of the 4 optional fields are truthy.
   * Escapes user-provided text (dietaryRestrictions, specialRequests).
   * whatsappNumber is E.164-validated (only digits + leading +) — no escaping needed.
   * contactPreference is an enum — server-controlled, no escaping needed.
   */
  private buildPreferencesSection(params: BookingConfirmationParams): string {
    const parts: string[] = [];

    if (params.guestWhatsApp) {
      parts.push(
        `<p style="font-size:14px;color:#5a4d3f;margin:6px 0;">WhatsApp: <strong>${params.guestWhatsApp}</strong></p>`,
      );
    }
    if (params.guestContactPreference) {
      parts.push(
        `<p style="font-size:14px;color:#5a4d3f;margin:6px 0;">Prefiere contacto por: <strong>${this.formatContactPreference(params.guestContactPreference)}</strong></p>`,
      );
    }
    if (params.guestDietaryRestrictions) {
      parts.push(
        `<p style="font-size:14px;color:#5a4d3f;margin:6px 0;">Restricciones dietarias: <em>${this.escapeHtml(params.guestDietaryRestrictions)}</em></p>`,
      );
    }
    if (params.guestSpecialRequests) {
      parts.push(
        `<p style="font-size:14px;color:#5a4d3f;margin:6px 0;">Solicitudes especiales: <em>${this.escapeHtml(params.guestSpecialRequests)}</em></p>`,
      );
    }

    if (parts.length === 0) return '';

    return `<div style="margin-top:24px;padding:16px;background:#f4efe6;border-radius:8px;">
  <h2 style="font-family:'Instrument Serif',Georgia,serif;font-size:18px;color:#2a221a;margin:0 0 12px;font-weight:normal;">Sus preferencias</h2>
  ${parts.join('\n  ')}
</div>`;
  }

  private buildConfirmationHtml(params: BookingConfirmationParams): string {
    const formatDate = (iso: string) => {
      const d = new Date(iso + 'T12:00:00.000Z');
      return d.toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
    };

    const formatCOP = (amount: number) =>
      new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
      }).format(amount);

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmación de reserva</title>
</head>
<body style="font-family: Georgia, serif; background: #f9f5f0; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: #c45a3a; color: #fff; padding: 32px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px; font-weight: normal;">¡Reserva confirmada!</h1>
    </div>
    <div style="padding: 32px;">
      <p style="font-size: 16px; color: #333; margin-top: 0;">
        Hola, <strong>${this.escapeHtml(params.guestName)}</strong>. Tu reserva ha sido confirmada. Aquí están los detalles:
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f0ebe4; color: #666; font-size: 14px;">Número de reserva</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #f0ebe4; color: #333; font-size: 14px; font-weight: bold;">${params.reservationId}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f0ebe4; color: #666; font-size: 14px;">Tipo de habitación</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #f0ebe4; color: #333; font-size: 14px;">${this.escapeHtml(params.roomTypeName)}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f0ebe4; color: #666; font-size: 14px;">Fecha de entrada</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #f0ebe4; color: #333; font-size: 14px;">${formatDate(params.checkIn)}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f0ebe4; color: #666; font-size: 14px;">Fecha de salida</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #f0ebe4; color: #333; font-size: 14px;">${formatDate(params.checkOut)}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f0ebe4; color: #666; font-size: 14px;">Número de noches</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #f0ebe4; color: #333; font-size: 14px;">${params.totalNights}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; color: #666; font-size: 14px;"><strong>Total</strong></td>
          <td style="padding: 12px 0; color: #c45a3a; font-size: 16px; font-weight: bold;">${formatCOP(params.total)}</td>
        </tr>
      </table>
      ${this.buildPreferencesSection(params)}
      <p style="font-size: 14px; color: #666;">
        Si no recibes este correo en 5 minutos, revisa tu carpeta de spam.
      </p>
      <p style="font-size: 14px; color: #999; margin-bottom: 0;">
        Gracias por elegir nuestro hotel. ¡Te esperamos!
      </p>
    </div>
  </div>
</body>
</html>`;
  }
}
