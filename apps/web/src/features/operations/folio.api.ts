import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FolioItemDto {
  id: string;
  folioId: string;
  type: 'ROOM_CHARGE' | 'MANUAL_CHARGE' | 'VOID' | 'ADJUSTMENT' | 'TAX';
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate: number;
  taxAmount: number;
  businessDate: string;
  postedAt: string;
  postedByUserId: string;
  voidedByEntryId: string | null;
}

export interface FolioWithBalanceDto {
  id: string;
  reservationId: string;
  isOpen: boolean;
  closedAt: string | null;
  snapshotHash: string | null;
  snapshotTotal: number | null;
  createdAt: string;
  updatedAt: string;
  items: FolioItemDto[];
  balance: number;
}

export interface PostChargePayload {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
}

// ─── API functions ─────────────────────────────────────────────────────────────

/**
 * getFolio — GET /api/folios/:id
 * Returns the folio with all items and computed running balance.
 */
export async function getFolio(id: string): Promise<FolioWithBalanceDto> {
  const { data } = await api.get<FolioWithBalanceDto>(`/folios/${id}`);
  return data;
}

/**
 * postCharge — POST /api/folios/:id/charges
 * Appends a MANUAL_CHARGE item to an OPEN folio.
 * Returns 409 if folio is already SETTLED.
 */
export async function postCharge(
  folioId: string,
  payload: PostChargePayload,
): Promise<FolioItemDto> {
  const { data } = await api.post<FolioItemDto>(
    `/folios/${folioId}/charges`,
    payload,
  );
  return data;
}

/**
 * voidCharge — POST /api/folios/:id/items/:itemId/void
 * Appends a VOID item (append-only, never mutates original).
 */
export async function voidCharge(
  folioId: string,
  itemId: string,
): Promise<FolioItemDto> {
  const { data } = await api.post<FolioItemDto>(
    `/folios/${folioId}/items/${itemId}/void`,
  );
  return data;
}

/**
 * downloadFolioPdf — GET /api/folios/:id/pdf
 *
 * Fetches the PDF as a Blob using the axios instance (Authorization header
 * is injected automatically by the auth interceptor — no token in URL).
 * Creates a temporary <a> element to trigger browser download, then revokes
 * the object URL to free memory.
 *
 * Only call when folio.isOpen === false (SETTLED). The backend also enforces
 * this — belt-and-suspenders pattern.
 */
export async function downloadFolioPdf(folioId: string): Promise<void> {
  const res = await api.get<Blob>(`/folios/${folioId}/pdf`, {
    responseType: 'blob',
  });

  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `estado-de-cuenta-${folioId.slice(0, 8)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
