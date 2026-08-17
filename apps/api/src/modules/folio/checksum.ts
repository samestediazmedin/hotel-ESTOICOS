import * as crypto from 'crypto';

/**
 * FolioItemLike — minimal shape needed for checksum computation.
 * Accepts both real Prisma FolioItem objects and plain test objects.
 */
interface FolioItemLike {
  id: string;
  type: string;
  description: string;
  quantity: number;
  unitPrice: { toFixed(d: number): string } | number;
  amount: { toFixed(d: number): string } | number;
  taxRate: { toFixed(d: number): string } | number;
  taxAmount: { toFixed(d: number): string } | number;
  businessDate: Date;
  postedAt: Date;
  postedByUserId: string;
  voidedByEntryId: string | null;
}

/**
 * computeFolioChecksum — deterministic SHA-256 over canonical JSON.
 *
 * Sorting by postedAt ensures the hash is order-independent.
 * All Decimal fields use .toFixed() with fixed precision to avoid
 * non-determinism from Prisma's internal Decimal representation (Pitfall P7).
 *
 * Amounts:    .toFixed(2)  — monetary COP amounts
 * Tax rates:  .toFixed(4)  — e.g. "0.1900"
 */
export function computeFolioChecksum(items: FolioItemLike[]): string {
  const toFixed = (val: { toFixed(d: number): string } | number, decimals: number): string => {
    if (typeof val === 'number') return val.toFixed(decimals);
    return val.toFixed(decimals);
  };

  const sorted = [...items].sort(
    (a, b) => a.postedAt.getTime() - b.postedAt.getTime(),
  );

  const canonical = JSON.stringify(
    sorted.map((i) => ({
      id: i.id,
      type: i.type,
      description: i.description,
      quantity: i.quantity,
      unitPrice: toFixed(i.unitPrice, 2),
      amount: toFixed(i.amount, 2),
      taxRate: toFixed(i.taxRate, 4),
      taxAmount: toFixed(i.taxAmount, 2),
      businessDate: i.businessDate.toISOString().slice(0, 10),
      postedAt: i.postedAt.toISOString(),
      postedByUserId: i.postedByUserId,
      voidedByEntryId: i.voidedByEntryId ?? null,
    })),
  );

  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}
