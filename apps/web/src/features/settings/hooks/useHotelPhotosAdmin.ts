import { useQuery } from '@tanstack/react-query';
import { fetchAdminHotelPhotos } from '../hotel-settings.api';

/**
 * useHotelPhotosAdmin — TanStack Query GET /api/admin/hotel-photos
 *
 * Admin-only list of hotel photos including IDs (needed for reorder/delete).
 * queryKey: ['admin', 'hotel-photos']
 */
export function useHotelPhotosAdmin() {
  return useQuery({
    queryKey: ['admin', 'hotel-photos'],
    queryFn: fetchAdminHotelPhotos,
    staleTime: 30_000,
  });
}
