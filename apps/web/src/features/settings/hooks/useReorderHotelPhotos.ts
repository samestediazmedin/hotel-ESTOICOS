import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reorderHotelPhotos, type AdminHotelPhoto } from '../hotel-settings.api';

/**
 * useReorderHotelPhotos — PATCH /admin/hotel-photos/reorder with optimistic update
 *
 * onMutate: applies new order immediately to the cache (zero-latency UI feedback)
 * onError: rolls back to snapshot if the PATCH fails
 * onSettled: invalidates BOTH query keys regardless of outcome
 */
export function useReorderHotelPhotos() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, AdminHotelPhoto[], { snapshot: AdminHotelPhoto[] | undefined }>({
    mutationFn: async (newOrder) => {
      await reorderHotelPhotos(newOrder.map((p) => p.id));
    },
    onMutate: async (newOrder) => {
      // Cancel any in-flight admin query to avoid overwriting the optimistic update
      await queryClient.cancelQueries({ queryKey: ['admin', 'hotel-photos'] });
      const snapshot = queryClient.getQueryData<AdminHotelPhoto[]>(['admin', 'hotel-photos']);
      // Apply new displayOrder values to match what the backend will write
      const optimistic = newOrder.map((p, i) => ({ ...p, displayOrder: i }));
      queryClient.setQueryData(['admin', 'hotel-photos'], optimistic);
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      // Roll back to pre-drag snapshot
      if (ctx?.snapshot) {
        queryClient.setQueryData(['admin', 'hotel-photos'], ctx.snapshot);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'hotel-photos'] });
      queryClient.invalidateQueries({ queryKey: ['public', 'hotel-photos'] });
    },
  });
}
