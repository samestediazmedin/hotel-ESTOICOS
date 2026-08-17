import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SystemConfigService } from '../../system-config/system-config.service';
import { computeFolioChecksum } from './checksum';
import type { PostChargeDto } from './dto/post-charge.dto';
import type { FolioWithBalanceDto } from './dto/folio-response.dto';
import type { Prisma } from '../../generated/prisma/client';

/**
 * resolveFolioIdInternal — shared resolution logic used by resolveFolioId and
 * resolveFolioIdWithTx. Kept separate so both paths share the same algorithm.
 */
async function resolveById(
  client: { folio: { findUnique: (args: any) => Promise<{ id: string } | null> } },
  id: string,
): Promise<string | null> {
  // Try by folio.id first
  const byFolioId = await client.folio.findUnique({ where: { id }, select: { id: true } });
  if (byFolioId) return byFolioId.id;

  // Fallback: treat the id as a reservationId (1:1 relationship, UNIQUE constraint)
  const byReservationId = await client.folio.findUnique({
    where: { reservationId: id },
    select: { id: true },
  });
  return byReservationId?.id ?? null;
}

/**
 * FolioService — append-only folio lifecycle management.
 *
 * Core invariant (FOL-02 + P2): guardOpen() is called at the start of EVERY
 * write path. A SETTLED folio (isOpen=false) MUST NOT accept new items.
 *
 * Methods that accept a `tx` parameter are designed to participate in the
 * check-in / check-out $transaction without breaking atomicity.
 */
@Injectable()
export class FolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  // ─── Open (called inside check-in $transaction) ───────────────────────────

  /**
   * openFolio — creates a new OPEN folio for the reservation.
   *
   * MUST be called with the same Prisma tx client used by checkIn() so that
   * folio creation is part of the same atomic transaction.
   *
   * Throws ConflictException if a folio already exists for this reservation
   * (UNIQUE constraint on reservationId).
   */
  async openFolio(
    tx: Prisma.TransactionClient,
    reservationId: string,
  ) {
    // Check for existing folio (FOL-01 UNIQUE guard at service level)
    const existing = await tx.folio.findUnique({ where: { reservationId } });
    if (existing) {
      throw new ConflictException(
        `A folio already exists for reservation ${reservationId}`,
      );
    }

    return tx.folio.create({
      data: { reservationId, isOpen: true },
    });
  }

  // ─── Private resolution helper ───────────────────────────────────────────

  /**
   * resolveFolioId — resolves a real folio.id from either a folioId or a
   * reservationId. The frontend consistently navigates to /folios/:reservationId
   * (1:1 relationship), so the controller `:id` param can be either.
   *
   * Resolution order:
   *  1. Try findUnique({ where: { id } })         → direct folio match
   *  2. Try findUnique({ where: { reservationId: id } }) → match via reservation
   *  3. If still null → throw NotFoundException (controlled 404, not P2025 500)
   *
   * Both folio.id and reservation.id are cuid2s — no collision risk.
   *
   * @param id — value that came from the controller :id route param
   * @param tx — optional Prisma transaction client (write paths pass their tx)
   */
  private async resolveFolioId(id: string, tx?: Prisma.TransactionClient): Promise<string> {
    const client = tx ?? this.prisma;
    const resolvedId = await resolveById(client as any, id);
    if (!resolvedId) {
      throw new NotFoundException('Folio no encontrado');
    }
    return resolvedId;
  }

  // ─── Immutability guard ───────────────────────────────────────────────────

  /**
   * guardOpen — throws ConflictException if the folio is closed (SETTLED).
   *
   * Called at the start of EVERY write path (P2 compliance).
   * Accepts folioId OR reservationId (dual resolution via resolveFolioId).
   * Returns the folio object for chaining.
   */
  async guardOpen(
    folioIdOrReservationId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const resolvedId = await this.resolveFolioId(folioIdOrReservationId, tx);
    const folio = await (client as any).folio.findUnique({ where: { id: resolvedId } });

    // resolveFolioId already guarantees resolvedId exists; findUnique here
    // cannot return null for the same id in the same transaction. Belt-and-suspenders.
    if (!folio) {
      throw new NotFoundException('Folio no encontrado');
    }

    if (!folio.isOpen) {
      throw new ConflictException(
        `Folio ${resolvedId} is closed (SETTLED). No charges can be added after settlement.`,
      );
    }

    return folio;
  }

  // ─── Post charge ──────────────────────────────────────────────────────────

  /**
   * postCharge — appends a MANUAL_CHARGE item to an OPEN folio.
   *
   * Guards: folio must be OPEN (P2).
   * Amounts are rounded via Math.round() for COP integer precision (P02-03 pattern).
   * businessDate is read from SystemConfigService at posting time.
   */
  async postCharge(
    folioIdOrReservationId: string,
    dto: PostChargeDto,
    userId: string,
    tx?: Prisma.TransactionClient,
  ) {
    // guardOpen resolves folioId-or-reservationId and returns the real folio record
    const folio = await this.guardOpen(folioIdOrReservationId, tx);
    const resolvedFolioId = folio.id;

    const businessDate = await this.systemConfig.getHotelBusinessDate();
    const client = tx ?? this.prisma;

    const amount = Math.round(dto.quantity * dto.unitPrice);
    const taxRate = dto.taxRate ?? 0.19;
    const taxAmount = Math.round(amount * taxRate);

    return (client as any).folioItem.create({
      data: {
        folioId: resolvedFolioId,
        type: 'MANUAL_CHARGE',
        description: dto.description,
        quantity: dto.quantity,
        unitPrice: dto.unitPrice,
        amount,
        taxRate,
        taxAmount,
        businessDate: businessDate ?? new Date(),
        postedByUserId: userId,
        voidedByEntryId: null,
      },
    });
  }

  // ─── Void charge ──────────────────────────────────────────────────────────

  /**
   * voidCharge — appends a VOID item referencing the original.
   *
   * Append-only: never UPDATE or DELETE the original FolioItem (FOL-02).
   * The VOID item carries a negative amount equal to the original amount.
   * Guards: folio must be OPEN.
   */
  async voidCharge(
    folioIdOrReservationId: string,
    originalItemId: string,
    userId: string,
    tx?: Prisma.TransactionClient,
  ) {
    // guardOpen resolves folioId-or-reservationId and returns the real folio record
    const folio = await this.guardOpen(folioIdOrReservationId, tx);
    const resolvedFolioId = folio.id;

    const client = tx ?? this.prisma;
    const original = await (client as any).folioItem.findUniqueOrThrow({
      where: { id: originalItemId },
    });

    const businessDate = await this.systemConfig.getHotelBusinessDate();

    const originalAmount = typeof original.amount === 'number'
      ? original.amount
      : Number(original.amount.toString());

    return (client as any).folioItem.create({
      data: {
        folioId: resolvedFolioId,
        type: 'VOID',
        description: `VOID: ${original.description}`,
        quantity: original.quantity,
        unitPrice: originalAmount,
        amount: -originalAmount,
        taxRate: 0,
        taxAmount: 0,
        businessDate: businessDate ?? new Date(),
        postedByUserId: userId,
        voidedByEntryId: originalItemId,
      },
    });
  }

  // ─── Close folio (called inside check-out $transaction) ──────────────────

  /**
   * closeFolio — SETTLES the folio.
   *
   * Computes SHA-256 checksum over all items, writes snapshotHash + snapshotTotal,
   * sets isOpen=false + closedAt.
   *
   * MUST be called with the same Prisma tx as checkOut() for atomicity.
   * Guards: folio must be OPEN (calling twice throws ConflictException).
   */
  async closeFolio(
    tx: Prisma.TransactionClient,
    folioId: string,
  ) {
    // guardOpen resolves the real folio id and asserts isOpen=true
    const folio = await this.guardOpen(folioId, tx);
    const resolvedFolioId = folio.id;

    const items = await (tx as any).folioItem.findMany({
      where: { folioId: resolvedFolioId },
      orderBy: { postedAt: 'asc' },
    });

    const snapshotHash = computeFolioChecksum(items);

    // Compute total: sum of (amount + taxAmount) for all items
    const snapshotTotal = items.reduce((acc: number, item: any) => {
      const amount = typeof item.amount === 'number' ? item.amount : Number(item.amount.toString());
      const taxAmount = typeof item.taxAmount === 'number' ? item.taxAmount : Number(item.taxAmount.toString());
      return acc + amount + taxAmount;
    }, 0);

    return (tx as any).folio.update({
      where: { id: resolvedFolioId },
      data: {
        isOpen: false,
        closedAt: new Date(),
        snapshotHash,
        snapshotTotal: Math.round(snapshotTotal),
      },
    });
  }

  // ─── Get folio with balance ───────────────────────────────────────────────

  /**
   * getFolioWithBalance — returns the folio with all items and computed balance.
   *
   * Accepts folioId OR reservationId (frontend keys folios by reservationId).
   * Unknown id → controlled NotFoundException (404), not a P2025 Prisma 500.
   *
   * Balance = sum of (amount + taxAmount) across all items.
   * VOID items carry negative amounts, so they naturally reduce the balance.
   */
  async getFolioWithBalance(folioIdOrReservationId: string): Promise<FolioWithBalanceDto> {
    const resolvedId = await this.resolveFolioId(folioIdOrReservationId);
    const folio = await this.prisma.folio.findUnique({
      where: { id: resolvedId },
      include: { items: { orderBy: { postedAt: 'asc' } } },
    });

    // resolveFolioId already verified existence; this guard is for type-narrowing only.
    if (!folio) {
      throw new NotFoundException('Folio no encontrado');
    }

    const balance = (folio.items as any[]).reduce((acc, item) => {
      const amount = typeof item.amount === 'number' ? item.amount : Number(item.amount.toString());
      const taxAmount = typeof item.taxAmount === 'number' ? item.taxAmount : Number(item.taxAmount.toString());
      return acc + amount + taxAmount;
    }, 0);

    return {
      id: folio.id,
      reservationId: folio.reservationId,
      isOpen: folio.isOpen,
      closedAt: folio.closedAt,
      snapshotHash: folio.snapshotHash,
      snapshotTotal: folio.snapshotTotal ? Number(folio.snapshotTotal.toString()) : null,
      createdAt: folio.createdAt,
      updatedAt: folio.updatedAt,
      items: (folio.items as any[]).map((i) => ({
        id: i.id,
        folioId: i.folioId,
        type: i.type,
        description: i.description,
        quantity: i.quantity,
        unitPrice: typeof i.unitPrice === 'number' ? i.unitPrice : Number(i.unitPrice.toString()),
        amount: typeof i.amount === 'number' ? i.amount : Number(i.amount.toString()),
        taxRate: typeof i.taxRate === 'number' ? i.taxRate : Number(i.taxRate.toString()),
        taxAmount: typeof i.taxAmount === 'number' ? i.taxAmount : Number(i.taxAmount.toString()),
        businessDate: i.businessDate,
        postedAt: i.postedAt,
        postedByUserId: i.postedByUserId,
        voidedByEntryId: i.voidedByEntryId,
      })),
      balance: Math.round(balance),
    };
  }

  /**
   * getFolioByReservation — lookup folio by reservationId (convenience method for check-out).
   */
  async getFolioByReservation(reservationId: string) {
    return this.prisma.folio.findUnique({ where: { reservationId } });
  }

  // ─── AI-only methods (Phase 07) ──────────────────────────────────────────

  /**
   * getFolioSummaryForAI — returns aggregate folio summary for the AI get_folio_summary tool.
   *
   * Returns aggregate totals ONLY — no individual charge descriptions (AI-06 output sanitization).
   * Individual line items may contain PII or sensitive descriptions that should not enter
   * the LLM context.
   *
   * @param reservationId - UUID of the reservation whose folio to summarize
   */
  async getFolioSummaryForAI(reservationId: string): Promise<{
    folioId: string;
    isOpen: boolean;
    totalCharged: number;
    lineItemCount: number;
    lastChargeAt: string | null;
    snapshotTotal: number | null;
  }> {
    const folio = await this.prisma.folio.findUnique({
      where: { reservationId },
      include: { items: { orderBy: { postedAt: 'asc' } } },
    });

    if (!folio) {
      throw new NotFoundException(`Folio not found for reservation ${reservationId}`);
    }

    const items = folio.items as any[];
    const totalCharged = Math.round(
      items.reduce((sum, item) => {
        const amount = typeof item.amount === 'number' ? item.amount : Number(item.amount.toString());
        return sum + amount;
      }, 0),
    );

    const lastChargeAt =
      items.length > 0
        ? (items[items.length - 1].postedAt as Date).toISOString()
        : null;

    return {
      folioId: folio.id,
      isOpen: folio.isOpen,
      totalCharged,
      lineItemCount: items.length,
      lastChargeAt,
      snapshotTotal: folio.snapshotTotal
        ? Math.round(Number(folio.snapshotTotal.toString()))
        : null,
    };
  }

  // ─── Get folio with reservation for PDF generation ────────────────────────

  /**
   * getFolioForPdf — returns the folio + items + reservation + room + guest.
   *
   * Accepts folioId OR reservationId (dual resolution — same policy as getFolioWithBalance).
   * Used exclusively by FolioPdfService.generateFolioPdf().
   * Includes reservation.guest so the PDF service can decrypt documentNumber.
   * Does NOT decrypt — decryption responsibility belongs to FolioPdfService.
   */
  async getFolioForPdf(folioIdOrReservationId: string) {
    const resolvedId = await this.resolveFolioId(folioIdOrReservationId);
    const folio = await this.prisma.folio.findUnique({
      where: { id: resolvedId },
      include: {
        items: { orderBy: { postedAt: 'asc' } },
        reservation: {
          include: {
            room: true,
            guest: true,
          },
        },
      },
    });

    // resolveFolioId already verified existence; type-narrowing guard only.
    if (!folio) {
      throw new NotFoundException('Folio no encontrado');
    }

    return folio;
  }
}
