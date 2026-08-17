import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteHotelPhoto } from '../hotel-settings.api';

/**
 * useDeleteHotelPhoto — DELETE /admin/hotel-photos/:id
 *
 * onSuccess invalidates both ['admin', 'hotel-photos'] AND ['public', 'hotel-photos']
 * so the portal stops showing the deleted photo within the cache window.
 */
export function useDeleteHotelPhoto() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteHotelPhoto(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'hotel-photos'] });
      queryClient.invalidateQueries({ queryKey: ['public', 'hotel-photos'] });
    },
  });
}
