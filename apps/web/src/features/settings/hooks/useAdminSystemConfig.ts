import { useQuery } from '@tanstack/react-query';
import { fetchAdminSystemConfig } from '../hotel-settings.api';

/**
 * useAdminSystemConfig — TanStack Query hook for GET /api/system-config.
 *
 * Query key: ['admin', 'system-config']
 * staleTime: 30s — admin actively editing; refetch on window focus is acceptable.
 *
 * Invalidated by useUpdateSystemConfig.onSuccess after a successful PATCH.
 */
export function useAdminSystemConfig() {
  return useQuery({
    queryKey: ['admin', 'system-config'],
    queryFn: fetchAdminSystemConfig,
    staleTime: 30_000,
  });
}
