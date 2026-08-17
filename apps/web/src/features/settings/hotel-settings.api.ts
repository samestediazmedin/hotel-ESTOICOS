import { api } from '@/lib/api';
import type { AdminSystemConfig, HotelInfoFormData } from './types';

// ─── Photo types ──────────────────────────────────────────────────────────────

export interface AdminHotelPhoto {
  id: string;
  url: string;
  alt: string;
  displayOrder: number;
}

/**
 * fetchAdminSystemConfig — GET /api/system-config
 */
export async function fetchAdminSystemConfig(): Promise<AdminSystemConfig> {
  const res = await api.get<AdminSystemConfig>('/system-config');
  return res.data;
}

/**
 * updateSystemConfig — PATCH /api/system-config
 */
export async function updateSystemConfig(
  payload: Partial<HotelInfoFormData>,
): Promise<AdminSystemConfig> {
  const cleaned: Record<string, unknown> = { ...payload };
  for (const key of ['tagline', 'description', 'phone'] as const) {
    if (cleaned[key] === '') {
      delete cleaned[key];
    }
  }
  const res = await api.patch<AdminSystemConfig>('/system-config', cleaned);
  return res.data;
}

// ─── Photo API functions (2026-05-28 — multipart, no more presign) ────────────

export async function fetchAdminHotelPhotos(): Promise<AdminHotelPhoto[]> {
  const res = await api.get<AdminHotelPhoto[]>('/admin/hotel-photos');
  return res.data;
}

/**
 * uploadHotelPhoto — single multipart POST. The API runs the file through
 * StorageService (Sharp pipeline) and persists to /app/storage.
 */
export async function uploadHotelPhoto(params: {
  file: File;
  alt?: string;
}): Promise<AdminHotelPhoto> {
  const form = new FormData();
  form.append('image', params.file);
  if (params.alt !== undefined) form.append('alt', params.alt);
  const res = await api.post<AdminHotelPhoto>('/admin/hotel-photos', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function reorderHotelPhotos(photoIds: string[]): Promise<void> {
  await api.patch('/admin/hotel-photos/reorder', { photoIds });
}

export async function deleteHotelPhoto(id: string): Promise<void> {
  await api.delete(`/admin/hotel-photos/${id}`);
}
