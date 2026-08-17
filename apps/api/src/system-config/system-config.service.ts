import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, SystemConfig } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateSystemConfigDto } from './dto/update-system-config.dto';

@Injectable()
export class SystemConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig() {
    return this.prisma.systemConfig.findFirst();
  }

  async getHotelBusinessDate(): Promise<Date | null> {
    const config = await this.getConfig();
    return config?.hotelBusinessDate ?? null;
  }

  async getHotelTimezone(): Promise<string> {
    const config = await this.getConfig();
    return config?.hotelTimezone ?? 'America/Bogota';
  }

  async getIvaRate(): Promise<number> {
    const config = await this.getConfig();
    return config ? Number(config.ivaRate) : 0.19;
  }

  async getHotelName(): Promise<string> {
    const config = await this.getConfig();
    return config?.hotelName ?? 'HotelOS AI';
  }

  /**
   * advanceBusinessDate — increments hotel_business_date by exactly 1 calendar day.
   *
   * Uses raw SQL INTERVAL '1 day' (NOT JavaScript Date arithmetic) to avoid
   * UTC vs. America/Bogota timezone edge cases (Pitfall P6 from RESEARCH.md).
   * Postgres handles calendar date semantics natively — no DST issues.
   *
   * BACKWARD COMPAT — kept for direct callers outside a $transaction.
   * Night audit MUST use advanceBusinessDateTx(tx) instead (W1 fix).
   */
  async advanceBusinessDate(): Promise<Date | null> {
    await this.prisma.$executeRaw`
      UPDATE system_config SET "hotelBusinessDate" = "hotelBusinessDate" + INTERVAL '1 day'
    `;
    return this.getHotelBusinessDate();
  }

  /**
   * advanceBusinessDateTx — transactional variant of advanceBusinessDate.
   *
   * W1 fix: the night audit MUST advance the business date INSIDE its
   * $transaction callback so that a rollback leaves hotel_business_date
   * unchanged. This method accepts the Prisma transaction client and
   * calls tx.$executeRaw instead of this.prisma.$executeRaw.
   *
   * Type: Prisma.TransactionClient — the standard generated type for the
   * callback argument of PrismaClient.$transaction(async (tx) => {...}).
   */
  async advanceBusinessDateTx(tx: Prisma.TransactionClient): Promise<void> {
    await tx.$executeRaw`
      UPDATE system_config SET "hotelBusinessDate" = "hotelBusinessDate" + INTERVAL '1 day'
    `;
  }

  /**
   * update — admin-driven partial update of the single system_config row.
   *
   * Pattern (RESEARCH Pattern 1):
   *  1. capture current row for audit diff
   *  2. compute fieldsChanged via shallow diff against Prisma column names
   *  3. apply updateMany({where: {}, data}) — single-row table convention
   *  4. fetch updated row via findFirst()
   *  5. write audit log AFTER update with try/catch (never throws — informational)
   *
   * DTO field `name` maps to column `hotelName`. All other DTO fields share names with columns.
   */
  async update(dto: UpdateSystemConfigDto, userId: string): Promise<SystemConfig> {
    const current = await this.prisma.systemConfig.findFirst();
    if (!current) {
      throw new NotFoundException('SystemConfig not initialized');
    }

    // Map DTO → Prisma update payload (name → hotelName)
    const updatePayload: Record<string, unknown> = {};
    if (dto.name !== undefined) updatePayload.hotelName = dto.name;
    if (dto.address !== undefined) updatePayload.address = dto.address;
    if (dto.tagline !== undefined) updatePayload.tagline = dto.tagline;
    if (dto.description !== undefined) updatePayload.description = dto.description;
    if (dto.phone !== undefined) updatePayload.phone = dto.phone;
    if (dto.tags !== undefined) updatePayload.tags = dto.tags;
    if (dto.displayPricesWithIva !== undefined) updatePayload.displayPricesWithIva = dto.displayPricesWithIva;

    // Diff against current (compare by Prisma column names)
    const fieldsChanged = Object.keys(updatePayload).filter((k) => {
      const newVal = updatePayload[k];
      const oldVal = (current as unknown as Record<string, unknown>)[k];
      // JSON.stringify handles tags array equality
      return JSON.stringify(newVal) !== JSON.stringify(oldVal);
    });

    // Apply update (updateMany is the correct pattern for single-row config tables)
    await this.prisma.systemConfig.updateMany({ where: {}, data: updatePayload });

    // Fetch updated row (updateMany returns count, not records)
    const updated = await this.prisma.systemConfig.findFirst();
    if (!updated) {
      throw new NotFoundException('SystemConfig disappeared during update');
    }

    // Write audit log AFTER update — never throws (informational; non-blocking by design)
    if (fieldsChanged.length > 0) {
      try {
        await this.prisma.systemConfigChangeLog.create({
          data: {
            userId,
            fieldsChanged,
            before: this.serializeForAudit(current, fieldsChanged) as Prisma.InputJsonValue,
            after: this.serializeForAudit(updated, fieldsChanged) as Prisma.InputJsonValue,
          },
        });
      } catch (err) {
        // Audit log failure must NOT block the user-facing update.
        // Logged via console.error; a future Sentry integration will surface this.
        console.error('[SystemConfig] audit log write failed:', err);
      }
    }

    return updated;
  }

  /** Pick only the changed fields for audit `before`/`after` JSON blobs. */
  private serializeForAudit(
    row: SystemConfig,
    fields: string[],
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      out[f] = (row as unknown as Record<string, unknown>)[f];
    }
    return out;
  }
}
