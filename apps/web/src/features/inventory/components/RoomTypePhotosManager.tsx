import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, Upload, X } from 'lucide-react';
import { api } from '@/lib/api';

interface RoomTypePhoto {
  id: string;
  url: string;
  order: number;
}

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

interface FileUploadStatus {
  name: string;
  state: UploadState;
  error?: string;
}

interface RoomTypePhotosManagerProps {
  roomTypeId: string;
  roomTypeName: string;
  onClose: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * RoomTypePhotosManager — slide-over drawer for managing the marketing
 * gallery of a single RoomType (Doble Deluxe, Suite Sumapaz, ...).
 *
 * Photos uploaded here drive the public homepage room cards. This replaces
 * the previous per-Room photo concept — see PublicPortalService.
 *
 * MOUNTING CONTRACT: parent mounts conditionally so a fresh state instance
 * exists per (re)open. Single multipart POST per file, no presigned URLs.
 */
export function RoomTypePhotosManager({
  roomTypeId,
  roomTypeName,
  onClose,
}: RoomTypePhotosManagerProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatuses, setUploadStatuses] = useState<FileUploadStatus[]>([]);

  const queryKey = ['room-type-photos', roomTypeId] as const;
  const publicKeys = [
    ['public', 'room-types'] as const,
    ['public', 'hotel-photos'] as const,
  ];

  const { data: photos = [], isLoading } = useQuery<RoomTypePhoto[]>({
    queryKey: [...queryKey],
    queryFn: () =>
      api
        .get<RoomTypePhoto[]>(`/inventory/room-types/${roomTypeId}/photos`)
        .then((r) => r.data),
    enabled: Boolean(roomTypeId),
  });

  const deleteMutation = useMutation({
    mutationFn: (photoId: string) =>
      api.delete(`/inventory/room-types/${roomTypeId}/photos/${photoId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKey] });
      for (const k of publicKeys)
        void queryClient.invalidateQueries({ queryKey: [...k] });
    },
  });

  async function uploadFile(file: File): Promise<void> {
    if (file.size > MAX_FILE_SIZE) {
      setUploadStatuses((prev) => [
        ...prev,
        { name: file.name, state: 'error', error: 'El archivo supera 5 MB' },
      ]);
      return;
    }
    setUploadStatuses((prev) => [
      ...prev,
      { name: file.name, state: 'uploading' },
    ]);
    try {
      const form = new FormData();
      form.append('image', file);
      await api.post(`/inventory/room-types/${roomTypeId}/photos`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadStatuses((prev) =>
        prev.map((s) =>
          s.name === file.name ? { ...s, state: 'done' as const } : s,
        ),
      );
      void queryClient.invalidateQueries({ queryKey: [...queryKey] });
      for (const k of publicKeys)
        void queryClient.invalidateQueries({ queryKey: [...k] });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      const apiMsg = (
        err as { response?: { data?: { message?: string } } }
      )?.response?.data?.message;
      const message =
        status === 400
          ? `Datos inválidos${apiMsg ? ` — ${apiMsg}` : ''}`
          : status === 401
            ? 'Sesión expirada'
            : status === 403
              ? 'Sin permisos para subir fotos'
              : status === 404
                ? 'Tipo de habitación no encontrado'
                : status === 413
                  ? 'Archivo demasiado grande'
                  : err instanceof Error
                    ? err.message
                    : 'Error desconocido';
      setUploadStatuses((prev) =>
        prev.map((s) =>
          s.name === file.name
            ? { ...s, state: 'error' as const, error: message }
            : s,
        ),
      );
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploadStatuses([]);
    void Promise.all(files.map((f) => uploadFile(f)));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleDelete(photoId: string) {
    if (window.confirm('¿Eliminar esta foto?')) {
      deleteMutation.mutate(photoId);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <button type="button"
        aria-label="Cerrar"
        className="fixed inset-0 z-40 bg-ink-1/30 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Drawer */}
      <aside className="fixed right-0 top-0 z-50 h-full w-full sm:w-[480px] bg-warm-white border-l border-warm-line shadow-xl flex flex-col">
        <header className="flex items-center justify-between px-5 py-4 border-b border-warm-line">
          <div>
            <h2 className="font-display text-xl text-ink-1">Fotos</h2>
            <p className="text-xs text-ink-3">{roomTypeName}</p>
          </div>
          <button type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="text-ink-3 hover:text-ink-1"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {/* Existing photos */}
          {isLoading ? (
            <p className="text-sm text-ink-3">Cargando fotos…</p>
          ) : photos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {photos.map((p) => (
                <div
                  key={p.id}
                  className="relative aspect-square rounded-md overflow-hidden border border-warm-line group"
                >
                  <img
                    src={p.url}
                    alt={`${roomTypeName} ${p.order + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <button type="button"
                    onClick={() => handleDelete(p.id)}
                    disabled={deleteMutation.isPending}
                    className="absolute inset-0 flex items-center justify-center bg-ink-1/40 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Eliminar foto"
                  >
                    <Trash2 className="w-5 h-5 text-warm-white" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-3">
              Aún no hay fotos. Sube al menos una para que aparezca en el homepage.
            </p>
          )}

          {/* Upload area */}
          <label
            htmlFor={`roomtype-photo-upload-${roomTypeId}`}
            className="flex flex-col items-center justify-center gap-2 cursor-pointer border-2 border-dashed border-warm-line rounded-lg p-6 text-center text-ink-3 hover:border-terracotta hover:text-terracotta transition-colors"
          >
            <Upload className="w-5 h-5" />
            <span className="text-sm">Agregar fotos</span>
            <span className="text-xs">JPG, PNG, WebP — máx. 5 MB por archivo</span>
          </label>
          <input
            ref={fileInputRef}
            id={`roomtype-photo-upload-${roomTypeId}`}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="sr-only"
          />

          {/* Status list */}
          {uploadStatuses.length > 0 && (
            <ul className="flex flex-col gap-1">
              {uploadStatuses.map((s, i) => (
                <li key={i} className="flex items-center gap-2 text-xs">
                  <span
                    className={
                      s.state === 'uploading'
                        ? 'text-ink-3'
                        : s.state === 'done'
                          ? 'text-emerald-700'
                          : 'text-terracotta'
                    }
                  >
                    {s.state === 'uploading' && '↑ Subiendo…'}
                    {s.state === 'done' && '✓ Subido'}
                    {s.state === 'error' && `✕ ${s.error ?? 'Error'}`}
                  </span>
                  <span className="text-ink-3 truncate">{s.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
