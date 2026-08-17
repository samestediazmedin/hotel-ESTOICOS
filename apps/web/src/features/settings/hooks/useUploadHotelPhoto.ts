import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadHotelPhoto, type AdminHotelPhoto } from '../hotel-settings.api';

interface UploadVars {
  file: File;
  alt?: string;
}

/**
 * useUploadHotelPhoto — single multipart POST (2026-05-28).
 *
 * Replaces the previous presign → R2 PUT → confirm 3-step flow. The API
 * receives the file via @nestjs/platform-express FileInterceptor and
 * persists through StorageService (Sharp + sidecar + thumbnail).
 *
 * onSuccess invalidates both admin and public caches so the portal hero
 * gallery reflects the new photo on next render.
 */
export function useUploadHotelPhoto() {
  const queryClient = useQueryClient();

  return useMutation<AdminHotelPhoto, Error, UploadVars>({
    mutationFn: ({ file, alt }) => uploadHotelPhoto({ file, alt }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'hotel-photos'] });
      queryClient.invalidateQueries({ queryKey: ['public', 'hotel-photos'] });
    },
  });
}
