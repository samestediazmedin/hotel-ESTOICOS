/**
 * FolioWithBalanceDto — response shape for GET /api/folios/:id
 *
 * Contains the folio record + all items + computed running balance.
 * Balance = sum of (amount + taxAmount) across all items
 * (VOID items have negative amounts which cancel out the original charge).
 */
export interface FolioWithBalanceDto {
  id: string;
  reservationId: string;
  isOpen: boolean;
  closedAt: Date | null;
  snapshotHash: string | null;
  snapshotTotal: number | null;
  createdAt: Date;
  updatedAt: Date;
  items: FolioItemDto[];
  balance: number;
}

export interface FolioItemDto {
  id: string;
  folioId: string;
  type: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate: number;
  taxAmount: number;
  businessDate: Date;
  postedAt: Date;
  postedByUserId: string;
  voidedByEntryId: string | null;
}
