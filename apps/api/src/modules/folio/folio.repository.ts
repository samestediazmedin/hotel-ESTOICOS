import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';

/**
 * FolioRepository — thin Prisma wrapper for folio and folio_items tables.
 *
 * FolioService orchestrates business logic; this class owns the DB calls.
 * Accepts an optional Prisma TransactionClient (tx) so methods can participate
 * in check-in / check-out $transactions without breaking atomicity.
 */
@Injectable()
export class FolioRepository {
  constructor(private readonly prisma: PrismaService) {}

  private client(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  async findById(id: string, tx?: Prisma.TransactionClient) {
    return this.client(tx).folio.findUniqueOrThrow({ where: { id }, include: { items: true } });
  }

  async findByReservation(reservationId: string, tx?: Prisma.TransactionClient) {
    return this.client(tx).folio.findUnique({ where: { reservationId }, include: { items: true } });
  }

  async create(data: { reservationId: string }, tx?: Prisma.TransactionClient) {
    return this.client(tx).folio.create({
      data: { reservationId: data.reservationId, isOpen: true },
    });
  }

  async updateFolio(
    id: string,
    data: {
      isOpen?: boolean;
      closedAt?: Date;
      snapshotHash?: string;
      snapshotTotal?: number;
    },
    tx?: Prisma.TransactionClient,
  ) {
    return this.client(tx).folio.update({ where: { id }, data });
  }

  async createItem(
    data: {
      folioId: string;
      type: string;
      description: string;
      quantity: number;
      unitPrice: number;
      amount: number;
      taxRate: number;
      taxAmount: number;
      businessDate: Date;
      postedByUserId: string;
      voidedByEntryId?: string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    return this.client(tx).folioItem.create({ data } as any);
  }

  async findItemById(id: string, tx?: Prisma.TransactionClient) {
    return this.client(tx).folioItem.findUniqueOrThrow({ where: { id } });
  }

  async findItemsByFolioId(folioId: string, tx?: Prisma.TransactionClient) {
    return this.client(tx).folioItem.findMany({ where: { folioId }, orderBy: { postedAt: 'asc' } });
  }
}
