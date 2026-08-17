import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface EmailTemplateDto {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEmailTemplateDto {
  name: string;
  subject: string;
  bodyHtml: string;
  variables?: string[];
}

export interface UpdateEmailTemplateDto {
  subject?: string;
  bodyHtml?: string;
  variables?: string[];
  isActive?: boolean;
}

/**
 * EmailTemplatesService — CRUD for reusable email templates.
 *
 * Templates support variable substitution via {{variableName}} syntax.
 * Base templates are seeded on first run.
 */
@Injectable()
export class EmailTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<EmailTemplateDto[]> {
    return this.prisma.emailTemplate.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findByName(name: string): Promise<EmailTemplateDto | null> {
    return this.prisma.emailTemplate.findUnique({
      where: { name },
    });
  }

  async findById(id: string): Promise<EmailTemplateDto> {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { id },
    });
    if (!template) {
      throw new NotFoundException(`Email template ${id} not found`);
    }
    return template;
  }

  async create(data: CreateEmailTemplateDto): Promise<EmailTemplateDto> {
    return this.prisma.emailTemplate.create({
      data: {
        name: data.name,
        subject: data.subject,
        bodyHtml: data.bodyHtml,
        variables: data.variables || [],
      },
    });
  }

  async update(id: string, data: UpdateEmailTemplateDto): Promise<EmailTemplateDto> {
    return this.prisma.emailTemplate.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.emailTemplate.delete({
      where: { id },
    });
  }

  /**
   * Render a template with variable substitution.
   * Variables: {{hotelName}}, {{guestName}}, etc.
   */
  renderTemplate(template: { subject: string; bodyHtml: string }, variables: Record<string, string>): {
    subject: string;
    bodyHtml: string;
  } {
    let subject = template.subject;
    let bodyHtml = template.bodyHtml;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      subject = subject.replace(placeholder, value);
      bodyHtml = bodyHtml.replace(placeholder, value);
    }

    return { subject, bodyHtml };
  }

  /**
   * Seed base templates if none exist.
   * Called on module init.
   */
  async seedBaseTemplates(): Promise<void> {
    const count = await this.prisma.emailTemplate.count();
    if (count > 0) return;

    const baseTemplates: CreateEmailTemplateDto[] = [
      {
        name: 'welcome',
        subject: '¡Bienvenido a {{hotelName}}!',
        bodyHtml: this.getWelcomeTemplate(),
        variables: ['hotelName', 'guestName', 'checkInDate', 'checkOutDate', 'roomTypeName'],
      },
      {
        name: 'pre-arrival',
        subject: 'Recordatorio: Tu estadía en {{hotelName}} comienza mañana',
        bodyHtml: this.getPreArrivalTemplate(),
        variables: ['hotelName', 'guestName', 'checkInDate', 'checkOutDate', 'roomTypeName', 'hotelAddress', 'hotelPhone'],
      },
      {
        name: 'thank-you',
        subject: 'Gracias por tu visita a {{hotelName}}',
        bodyHtml: this.getThankYouTemplate(),
        variables: ['hotelName', 'guestName', 'checkOutDate', 'reviewLink'],
      },
      {
        name: 'booking-confirmation',
        subject: 'Confirmación de reserva — {{reservationId}}',
        bodyHtml: this.getBookingConfirmationTemplate(),
        variables: ['hotelName', 'guestName', 'reservationId', 'roomTypeName', 'checkInDate', 'checkOutDate', 'totalNights', 'total'],
      },
    ];

    for (const template of baseTemplates) {
      await this.prisma.emailTemplate.create({ data: template });
    }
  }

  private getWelcomeTemplate(): string {
    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Geist, Arial, sans-serif; background: #f9f5f0; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: #2a221a; color: #faf7f2; padding: 32px; text-align: center;">
      <h1 style="margin: 0; font-size: 26px; font-weight: normal; font-family: 'Instrument Serif', Georgia, serif;">¡Bienvenido!</h1>
    </div>
    <div style="padding: 32px;">
      <p style="font-size: 16px; color: #333;">Hola, <strong>{{guestName}}</strong>. Tu reserva en <strong>{{hotelName}}</strong> está confirmada.</p>
      <p>Check-in: {{checkInDate}} | Check-out: {{checkOutDate}} | Habitación: {{roomTypeName}}</p>
      <p style="font-size: 14px; color: #999;">¡Te esperamos!</p>
    </div>
  </div>
</body>
</html>`;
  }

  private getPreArrivalTemplate(): string {
    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Geist, Arial, sans-serif; background: #f9f5f0; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: #2a221a; color: #faf7f2; padding: 32px; text-align: center;">
      <h1 style="margin: 0; font-size: 26px; font-weight: normal; font-family: 'Instrument Serif', Georgia, serif;">¡Nos vemos mañana!</h1>
    </div>
    <div style="padding: 32px;">
      <p>Hola, <strong>{{guestName}}</strong>. Tu estadía en <strong>{{hotelName}}</strong> comienza mañana.</p>
      <p>Check-in: {{checkInDate}} | Check-out: {{checkOutDate}} | Habitación: {{roomTypeName}}</p>
      <p>Dirección: {{hotelAddress}} | Teléfono: {{hotelPhone}}</p>
    </div>
  </div>
</body>
</html>`;
  }

  private getThankYouTemplate(): string {
    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Geist, Arial, sans-serif; background: #f9f5f0; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: #2a221a; color: #faf7f2; padding: 32px; text-align: center;">
      <h1 style="margin: 0; font-size: 26px; font-weight: normal; font-family: 'Instrument Serif', Georgia, serif;">¡Gracias por tu visita!</h1>
    </div>
    <div style="padding: 32px;">
      <p>Hola, <strong>{{guestName}}</strong>. Esperamos que hayas disfrutado tu estadía en {{hotelName}}.</p>
      <p>Nos encantaría conocer tu opinión:</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="{{reviewLink}}" style="display:inline-block; background:#c4623f; color:#faf7f2; padding:12px 28px; border-radius:8px; text-decoration:none;">Dejar mi reseña</a>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  private getBookingConfirmationTemplate(): string {
    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Geist, Arial, sans-serif; background: #f9f5f0; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: #c4623f; color: #faf7f2; padding: 32px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px; font-weight: normal;">¡Reserva confirmada!</h1>
    </div>
    <div style="padding: 32px;">
      <p>Hola, <strong>{{guestName}}</strong>. Tu reserva ha sido confirmada.</p>
      <p>Número: {{reservationId}} | Habitación: {{roomTypeName}}</p>
      <p>Check-in: {{checkInDate}} | Check-out: {{checkOutDate}} | Noches: {{totalNights}}</p>
      <p>Total: {{total}}</p>
    </div>
  </div>
</body>
</html>`;
  }
}
