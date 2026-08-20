import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GuestEncryptionService } from '../guests/encryption/guest-encryption.service';
import { TRAAuditLogRepository } from './tra-audit-log.repository';

/**
 * TRAExportService — generates TRA Colombia compliance CSV.
 *
 * Format spec (LOW CONFIDENCE — hotel owner must verify with COTELCO / local
 * alcaldía before first production export):
 *  - UTF-8 BOM prefix (Excel-friendly for accented characters)
 *  - Semicolon delimiter (Colombian Excel locale convention)
 *  - Spanish headers
 *  - DD/MM/YYYY dates in body; YYYY-MM-DD in filename
 *  - RFC 4180 cell escaping: wrap each cell in double-quotes,
 *    internal double-quotes escaped as ""
 *
 * Filter scope:
 *  - Stay.arrivedAt >= from AND Stay.departedAt <= to AND departedAt NOT NULL
 *  - Only completed stays (departedAt IS NOT NULL) — never in-house or cancelled
 *
 * Document number handling:
 *  - '[ANONYMIZED]' sentinel → rendered as-is, decrypt() NOT called (P13)
 *  - All other values → decrypted via GuestEncryptionService
 *
 * Audit log:
 *  - One row inserted per export AFTER successful CSV generation
 *  - Reflects actual rowCount (number of Stay rows in the CSV)
 */

const UTF8_BOM = '﻿';
const DELIMITER = ';';
const HEADER = [
  'NombreCompleto',
  'TipoDocumento',
  'NumeroDocumento',
  'Nacionalidad',
  'FechaNacimiento',
  'FechaIngreso',
  'FechaSalida',
].join(DELIMITER);

/**
 * Format a Date as DD/MM/YYYY using UTC parts.
 * Stays are stored with UTC timestamps — use UTC accessors to avoid
 * timezone shifts when converting to display dates.
 */
function fmtDate(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * RFC 4180 cell escaping:
 *  - Wrap every cell in double-quotes
 *  - Escape any internal double-quote as "" (two double-quotes)
 */
function escapeCell(value: string): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}

@Injectable()
export class TRAExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly guestEncryption: GuestEncryptionService,
    private readonly auditLogRepo: TRAAuditLogRepository,
  ) {}

  /**
   * generateCsv — build the full CSV as a Buffer and write the audit log row.
   *
   * @param from  Start of date range (inclusive) — stays arrivedAt >= from
   * @param to    End of date range (inclusive) — stays departedAt <= to
   * @param userId  ID of the requesting user (for audit log)
   * @returns Buffer containing UTF-8 BOM + CSV content
   */
  async generateCsv(from: Date, to: Date, userId: string): Promise<Buffer> {
    const stays = await this.prisma.stay.findMany({
      where: {
        arrivedAt: { gte: from },
        departedAt: { lte: to, not: null },
      },
      include: {
        reservation: {
          include: {
            guest: true,
            room: true,
          },
        },
      },
      orderBy: { arrivedAt: 'asc' },
    });

    const rows = stays.map((stay) => {
      const guest = stay.reservation.guest;

      // P13: '[ANONYMIZED]' sentinel is stored as plaintext — do NOT decrypt
      const docNumber =
        guest.documentNumber === '[ANONYMIZED]'
          ? '[ANONYMIZED]'
          : this.guestEncryption.decrypt(guest.documentNumber);

      return [
        guest.fullName,
        guest.documentType,
        docNumber,
        guest.nationality,
        fmtDate(guest.dateOfBirth),
        fmtDate(stay.arrivedAt),
        fmtDate(stay.departedAt!),
      ]
        .map(escapeCell)
        .join(DELIMITER);
    });

    const csv = UTF8_BOM + [HEADER, ...rows].join('\r\n');

    // Insert audit log row AFTER successful CSV generation
    // rowCount reflects the actual number of Stay rows included
    await this.auditLogRepo.create({
      userId,
      fromDate: from,
      toDate: to,
      rowCount: stays.length,
    });

    return Buffer.from(csv, 'utf-8');
  }
}
