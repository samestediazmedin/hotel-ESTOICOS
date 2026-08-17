import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateSystemConfig } from '../hotel-settings.api';
import type { AdminSystemConfig, HotelInfoFormData } from '../types';

/**
 * useUpdateSystemConfig — TanStack Mutation for PATCH /api/system-config.
 *
 * onSuccess:
 *   1. setQueryData(['admin', 'system-config']) — avoids extra GET round-trip.
 *   2. invalidateQueries(['public', 'hotel-info']) — portal reflects changes
 *      within the 60s cache window established by Phase 12.
 */
export function useUpdateSystemConfig() {
  const queryClient = useQueryClient();

  return useMutation<AdminSystemConfig, Error, Partial<HotelInfoFormData>>({
    mutationFn: updateSystemConfig,
    onSuccess: (updated) => {
      // Update admin cache directly with the fresh value from the PATCH response
      queryClient.setQueryData(['admin', 'system-config'], updated);
      // Invalidate public portal so /booking reflects the change
      queryClient.invalidateQueries({ queryKey: ['public', 'hotel-info'] });
    },
  });
}
