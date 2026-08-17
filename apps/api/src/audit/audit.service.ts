import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';

export interface AuditLogEntry {
  action: string;
  actorId: string;
  targetId?: string;
  targetType?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry) {
    return this.prisma.auditLog.create({
      data: {
        action: entry.action,
        actorId: entry.actorId,
        targetId: entry.targetId,
        targetType: entry.targetType ?? 'USER',
        details: (entry.details ?? {}) as Prisma.InputJsonValue,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    });
  }

  async getLogsForTarget(targetId: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { targetId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        actor: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }

  async getLogsByActor(actorId: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { actorId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        target: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }
}
