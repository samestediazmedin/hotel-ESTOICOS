import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * HousekeepingRepository — thin wrapper around Prisma for housekeeping queries.
 *
 * Keeps raw Prisma queries out of the service layer (Hexagonal pattern).
 * PrismaModule is @Global — no explicit import needed.
 */
@Injectable()
export class HousekeepingRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * findUserActiveTaskForRoom — returns an OPEN or IN_PROGRESS task
   * assigned to `userId` for `roomId`.
   *
   * Used by the service layer to enforce HOUSEKEEPING role ownership check.
   */
  async findUserActiveTaskForRoom(userId: string, roomId: string) {
    return this.prisma.housekeepingTask.findFirst({
      where: {
        roomId,
        assignedToId: userId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
    });
  }
}
