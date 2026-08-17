import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { publicPortalApi } from '../public-portal.api';
import type { Photo } from '../types';

/**
 * Phase 12 — useHotelPhotos (NEW)
 *
 * Replaces the hardcoded data/photos.ts module (deleted in 12-05).
 * Fetches from GET /api/public/hotel-photos — array sorted by displayOrder ASC (server-side).
 *
 * Fallback constant preserves the 5 Unsplash URLs verbatim from data/photos.ts v1.1,
 * so the hero gallery renders correctly even when the API is unavailable.
 */

const HOTEL_PHOTOS_FALLBACK: Photo[] = [
  {
    url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1600&q=80&auto=format&fit=crop',
    alt: 'Fachada colonial del hotel',
    displayOrder: 0,
  },
  {
    url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1600&q=80&auto=format&fit=crop',
    alt: 'Lobby con decoración colonial restaurada',
    displayOrder: 1,
  },
  {
    url: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1600&q=80&auto=format&fit=crop',
    alt: 'Suite Andina con vista a los cerros',
    displayOrder: 2,
  },
  {
    url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600&q=80&auto=format&fit=crop',
    alt: 'Restaurante de cocina bogotana de autor',
    displayOrder: 3,
  },
  {
    url: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1600&q=80&auto=format&fit=crop',
    alt: 'Terraza con vista a Monserrate',
    displayOrder: 4,
  },
];

export function useHotelPhotos(): UseQueryResult<Photo[], Error> {
  return useQuery({
    queryKey: ['public', 'hotel-photos'],
    queryFn: publicPortalApi.getHotelPhotos,
    staleTime: 60_000,
    placeholderData: HOTEL_PHOTOS_FALLBACK,
    retry: 2,
  });
}
