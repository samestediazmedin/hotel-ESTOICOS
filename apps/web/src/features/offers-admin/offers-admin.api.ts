import { api } from '@/lib/api';

/**
 * Admin Offer DTO mirror — shape returned by GET /api/admin/offers (and per-id
 * endpoints). Mirrors the backend OfferResponseDto.
 *
 * 2026-05-28 — Filesystem-first storage: `imageKey` is now the bare filename
 * served at `/images/<imageKey>`. The backend echoes both fields so older
 * callers (and tests) keep working.
 *
 * `roomType` — null when hotel-wide; { id, name } when the offer targets a
 * specific room type.
 */
export interface AdminOffer {
  id: string;
  title: string;
  description: string | null;
  imageKey: string;
  imageUrl: string;
  badge: string | null;
  validFrom: string | null;
  validTo: string | null;
  ctaText: string | null;
  ctaLink: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  roomType: { id: string; name: string } | null;
}

/**
 * Form values used to build the multipart body for create/update. `image` is
 * required on create and optional on update. The other text fields go in the
 * same form, including `isActive` (serialised as the string "true"/"false").
 *
 * `roomTypeId` — CUID string or "" (empty string clears the association).
 */
export interface OfferFormFields {
  title?: string;
  description?: string | null;
  badge?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  ctaText?: string | null;
  ctaLink?: string | null;
  isActive?: boolean;
  roomTypeId?: string | null;
}

// ─── API functions ────────────────────────────────────────────────────────────

export async function fetchAdminOffers(): Promise<AdminOffer[]> {
  const res = await api.get<AdminOffer[]>('/admin/offers');
  return res.data;
}

export async function fetchAdminOffer(id: string): Promise<AdminOffer> {
  const res = await api.get<AdminOffer>(`/admin/offers/${id}`);
  return res.data;
}

/**
 * Builds the multipart FormData body for POST/PATCH.
 * Skips undefined fields so PATCH only sends what changed.
 */
function buildFormData(fields: OfferFormFields, image?: File | null): FormData {
  const fd = new FormData();
  if (image) fd.append('image', image);
  if (fields.title !== undefined) fd.append('title', fields.title);
  if (fields.description !== undefined) fd.append('description', fields.description ?? '');
  if (fields.badge !== undefined) fd.append('badge', fields.badge ?? '');
  if (fields.validFrom !== undefined) fd.append('validFrom', fields.validFrom ?? '');
  if (fields.validTo !== undefined) fd.append('validTo', fields.validTo ?? '');
  if (fields.ctaText !== undefined) fd.append('ctaText', fields.ctaText ?? '');
  if (fields.ctaLink !== undefined) fd.append('ctaLink', fields.ctaLink ?? '');
  if (fields.isActive !== undefined) fd.append('isActive', String(fields.isActive));
  // "" sends an empty string which the backend Zod schema transforms to null (clears association)
  if (fields.roomTypeId !== undefined) fd.append('roomTypeId', fields.roomTypeId ?? '');
  return fd;
}

export async function createOfferWithImage(
  fields: OfferFormFields & { title: string },
  image: File,
): Promise<AdminOffer> {
  const fd = buildFormData(fields, image);
  const res = await api.post<AdminOffer>('/admin/offers', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function updateOfferWithImage(
  id: string,
  fields: OfferFormFields,
  image?: File | null,
): Promise<AdminOffer> {
  const fd = buildFormData(fields, image);
  const res = await api.patch<AdminOffer>(`/admin/offers/${id}`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function deleteOffer(id: string): Promise<void> {
  await api.delete(`/admin/offers/${id}`);
}

export async function reorderOffers(offerIds: string[]): Promise<void> {
  await api.patch('/admin/offers/reorder/all', { offerIds });
}
