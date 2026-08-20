import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PhotoThumbnail } from './PhotoThumbnail';
import { useHotelPhotosAdmin } from '../hooks/useHotelPhotosAdmin';
import { useUploadHotelPhoto } from '../hooks/useUploadHotelPhoto';
import { useReorderHotelPhotos } from '../hooks/useReorderHotelPhotos';
import { useDeleteHotelPhoto } from '../hooks/useDeleteHotelPhoto';
import type { AdminHotelPhoto } from '../hotel-settings.api';

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const ACCEPTED_ATTR = ACCEPTED_TYPES.join(',');

/**
 * HotelGalleryManager — drag-to-reorder grid of hotel hero gallery photos.
 *
 * Upload flow: file input → validate → useUploadHotelPhoto (presign → R2 PUT → confirm)
 * Reorder flow: HTML5 native drag → useReorderHotelPhotos (optimistic update)
 * Delete flow: X button → AlertDialog → useDeleteHotelPhoto
 *
 * All mutations invalidate ['admin', 'hotel-photos'] AND ['public', 'hotel-photos'].
 *
 * Grid: 2 cols on mobile, 3 on md, 4 on lg.
 */
export function HotelGalleryManager() {
  const {
    data: photos = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useHotelPhotosAdmin();

  const upload = useUploadHotelPhoto();
  const reorder = useReorderHotelPhotos();
  const del = useDeleteHotelPhoto();

  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [clientErr, setClientErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ─── Drag handlers ─────────────────────────────────────────────────────────

  const handleDragStart = (i: number) => setDragFrom(i);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Pitfall 5: must preventDefault to allow onDrop
  };

  const handleDrop = (dropIndex: number) => {
    if (dragFrom === null || dragFrom === dropIndex) {
      setDragFrom(null);
      return;
    }
    const next = [...photos];
    const [moved] = next.splice(dragFrom, 1);
    next.splice(dropIndex, 0, moved);
    setDragFrom(null);
    reorder.mutate(next);
  };

  // ─── Upload handler ────────────────────────────────────────────────────────

  const handleFile = (file: File) => {
    setClientErr(null);
    upload.reset(); // clear previous error banner

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setClientErr('Formato no soportado. Usa JPG, PNG, WebP o AVIF.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setClientErr('La foto excede el tamaño máximo de 5 MB.');
      return;
    }

    upload.mutate({ file });
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <section aria-labelledby="gallery-heading" className="flex flex-col gap-4">
      {/* Header */}
      <header className="flex items-center justify-between gap-3">
        <h2
          id="gallery-heading"
          className="font-display italic text-2xl text-ink-1"
        >
          Galería principal
        </h2>
        <Button
          type="button"
          variant="terracotta"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={upload.isPending}
        >
          <Upload size={14} aria-hidden />
          {upload.isPending ? 'Subiendo...' : 'Subir foto'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_ATTR}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = ''; // allow re-uploading the same file
          }}
        />
      </header>

      {/* Client-side or upload error */}
      {(clientErr || upload.isError) && (
        <div
          role="alert"
          className="rounded-md bg-terracotta/10 border border-terracotta/30 text-terracotta px-3 py-2 text-sm"
        >
          {clientErr ?? upload.error?.message ?? 'No se pudo subir la foto.'}
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="aspect-video rounded-md bg-warm-cream animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div
          role="alert"
          className="rounded-md bg-terracotta/10 border border-terracotta/30 text-terracotta px-3 py-2 text-sm flex items-center justify-between"
        >
          <span>No se pudo cargar la galería. {error?.message}</span>
          <button type="button"
            onClick={() => refetch()}
            className="underline hover:no-underline ml-4 shrink-0"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && photos.length === 0 && (
        <div className="rounded-md border border-dashed border-warm-line bg-warm-paper p-8 text-center text-sm text-ink-3">
          No hay fotos todavía. Sube la primera para que aparezca en el portal.
        </div>
      )}

      {/* Photo grid */}
      {!isLoading && !isError && photos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((photo: AdminHotelPhoto, i: number) => (
            <PhotoThumbnail
              key={photo.id}
              photo={photo}
              index={i}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDelete={(id) => del.mutate(id)}
              deleting={del.isPending}
            />
          ))}
        </div>
      )}
    </section>
  );
}
