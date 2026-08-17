import { api } from '@/lib/api';
import type { VenueType } from '@/features/concierge/types';

// ─── Venue DTO ────────────────────────────────────────────────────────────────

export interface Venue {
  id: string;
  name: string;
  type: VenueType;
  description: string | null;
  rating: number | null;
  address: string | null;
  phone: string | null;
  lat: number;
  lng: number;
  mapsUrl: string | null;
  reservationUrl: string | null;
  website: string | null;
  photoUrl: string | null;
  isActive: boolean;
  distanceKm: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVenueDto {
  name: string;
  type: VenueType;
  lat: number;
  lng: number;
  description?: string;
  rating?: number;
  address?: string;
  phone?: string;
  mapsUrl?: string;
  reservationUrl?: string;
  website?: string;
  isActive?: boolean;
}

export type UpdateVenueDto = Partial<CreateVenueDto>;

export interface CsvImportResult {
  inserted: number;
  skipped: number;
  errors: number;
  errorDetails?: string[];
}

// ─── API functions ────────────────────────────────────────────────────────────

/** List all venues. Pass includeInactive=true to also see disabled entries. */
export async function listVenues(includeInactive = false): Promise<Venue[]> {
  const params = includeInactive ? '?includeInactive=true' : '';
  const res = await api.get<Venue[]>(`/admin/concierge/venues${params}`);
  return res.data;
}

/** Create a new venue. */
export async function createVenue(dto: CreateVenueDto): Promise<Venue> {
  const res = await api.post<Venue>('/admin/concierge/venues', dto);
  return res.data;
}

/** Update an existing venue. */
export async function updateVenue(id: string, dto: UpdateVenueDto): Promise<Venue> {
  const res = await api.patch<Venue>(`/admin/concierge/venues/${id}`, dto);
  return res.data;
}

/** Soft-delete a venue (sets isActive=false). */
export async function disableVenue(id: string): Promise<void> {
  await api.delete(`/admin/concierge/venues/${id}`);
}

/** Upload venues from CSV file (multipart/form-data). */
export async function importCsv(file: File): Promise<CsvImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post<CsvImportResult>(
    '/admin/concierge/venues/import',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return res.data;
}

/**
 * uploadVenuePhoto — single multipart POST replaces the old presign + confirm pair (2026-05-28).
 * The API streams the file through StorageService and writes it to the Railway Volume.
 */
export async function uploadVenuePhoto(
  venueId: string,
  file: File,
): Promise<{ key: string; url: string }> {
  const form = new FormData();
  form.append("image", file);
  const res = await api.post<{ key: string; url: string }>(
    `/admin/concierge/venues/${venueId}/photos`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return res.data;
}
