import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateAuditLogInput {
  userId: string;
  fromDate: Date;
  toDate: Date;
  rowCount: number;
}

/**
 * TRAAuditLogRepository — wraps prisma.traExportLog.
 *
 * One row per export. Immutable — no updates, no deletes.
 * Inserted AFTER successful CSV generation so rowCount is accurate.
 */
@Injectable()
export class TRAAuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateAuditLogInput) {
    return this.prisma.traExportLog.create({
      data: {
        userId: input.userId,
        fromDate: input.fromDate,
        toDate: input.toDate,
        rowCount: input.rowCount,
      },
    });
  }
}
