import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, Upload } from 'lucide-react';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Photo {
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

interface PhotoUploaderProps {
  roomId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB — matches StorageService cap

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * PhotoUploader — single multipart POST per file.
 *
 * 2026-05-28 — Filesystem-first refactor: replaces the previous 3-step
 * presigned-R2 flow with a single POST to `/inventory/rooms/:roomId/photos`
 * carrying multipart/form-data. The API streams the file through Sharp
 * (rotate + JPEG mozjpeg q85 + 400x300 thumbnail) and writes it to the
 * Railway Volume. Public URL: `/images/<filename>`.
 */
export function PhotoUploader({ roomId }: PhotoUploaderProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatuses, setUploadStatuses] = useState<FileUploadStatus[]>([]);

  // ─── Load existing photos ─────────────────────────────────────────────────

  const { data: photos = [], isLoading: photosLoading } = useQuery<Photo[]>({
    queryKey: ['room-photos', roomId],
    queryFn: () =>
      api.get<Photo[]>(`/inventory/rooms/${roomId}/photos`).then((r) => r.data),
    enabled: !!roomId,
  });

  // ─── Delete photo mutation ────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: (photoId: string) =>
      api.delete(`/inventory/rooms/${roomId}/photos/${photoId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['room-photos', roomId] });
    },
  });

  // ─── Upload handler ───────────────────────────────────────────────────────

  function diagnoseError(err: unknown): string {
    const axiosErr = err as {
      response?: { status?: number; data?: { message?: string | string[] } };
      code?: string;
    };
    const status = axiosErr?.response?.status;
    const apiMessage = (() => {
      const m = axiosErr?.response?.data?.message;
      return Array.isArray(m) ? m.join(', ') : m;
    })();

    if (status === 400) return `Datos del archivo inválidos${apiMessage ? ` — ${apiMessage}` : ''}`;
    if (status === 401) return 'Sesión expirada — vuelva a iniciar sesión';
    if (status === 403) return 'Sin permisos para subir fotos (requiere rol Admin/Manager/Recepción)';
    if (status === 404) return 'Habitación no encontrada en la base de datos';
    if (status === 413) return 'Archivo demasiado grande para el servidor';
    if (status === 500) return 'Error interno del servidor — revise logs del API';
    if (status === 503) return 'Servicio no disponible — verifique que el backend esté corriendo';

    if (axiosErr?.code === 'ERR_NETWORK') {
      return 'No se pudo conectar con el backend';
    }

    const fallback = err instanceof Error ? err.message : 'Error desconocido';
    return `Error al subir: ${fallback}`;
  }

  async function uploadFile(file: File): Promise<void> {
    if (file.size > MAX_FILE_SIZE) {
      setUploadStatuses((prev) => [
        ...prev,
        { name: file.name, state: 'error', error: 'El archivo supera el límite de 5MB' },
      ]);
      return;
    }

    setUploadStatuses((prev) => [...prev, { name: file.name, state: 'uploading' }]);

    try {
      const form = new FormData();
      form.append('image', file);
      await api.post(`/inventory/rooms/${roomId}/photos`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setUploadStatuses((prev) =>
        prev.map((s) => (s.name === file.name ? { ...s, state: 'done' as const } : s)),
      );
      void queryClient.invalidateQueries({ queryKey: ['room-photos', roomId] });
    } catch (err: unknown) {
      const message = diagnoseError(err);
      console.error('[PhotoUploader] Upload failed:', err);
      setUploadStatuses((prev) =>
        prev.map((s) =>
          s.name === file.name ? { ...s, state: 'error' as const, error: message } : s,
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

  function handleDeletePhoto(photoId: string) {
    if (window.confirm('¿Eliminar esta foto?')) {
      deleteMutation.mutate(photoId);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* Photo grid */}
      {photosLoading ? (
        <p className="text-sm text-ink-3">Cargando fotos...</p>
      ) : photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="relative aspect-square rounded-md overflow-hidden border border-warm-line group"
            >
              <img
                src={photo.url}
                alt={`Foto ${photo.order + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <button type="button"
                onClick={() => handleDeletePhoto(photo.id)}
                disabled={deleteMutation.isPending}
                className="absolute inset-0 flex items-center justify-center bg-warm-white-strong/60 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Eliminar foto"
              >
                <Trash2 className="w-5 h-5 text-white" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-3">No hay fotos aún.</p>
      )}

      {/* Upload area */}
      <label
        htmlFor={`photo-upload-${roomId}`}
        className="flex flex-col items-center justify-center gap-2 cursor-pointer border-2 border-dashed border-warm-line rounded-lg p-4 text-center text-ink-3 hover:border-brand-primary hover:text-brand-primary transition-colors"
      >
        <Upload className="w-5 h-5" />
        <span className="text-sm">Agregar fotos</span>
        <span className="text-xs">JPG, PNG, WebP — máx. 5MB por archivo</span>
      </label>
      <input
        ref={fileInputRef}
        id={`photo-upload-${roomId}`}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="sr-only"
      />

      {/* Per-file upload status */}
      {uploadStatuses.length > 0 && (
        <ul className="flex flex-col gap-1">
          {uploadStatuses.map((s, i) => (
            <li key={i} className="flex items-center gap-2 text-xs">
              <span
                className={
                  s.state === 'uploading'
                    ? 'text-ink-3'
                    : s.state === 'done'
                    ? 'text-status-ready'
                    : 'text-status-in-progress'
                }
              >
                {s.state === 'uploading' && '↑ Subiendo...'}
                {s.state === 'done' && '✓ Subido'}
                {s.state === 'error' && `✕ ${s.error ?? 'Error'}`}
              </span>
              <span className="text-ink-3 truncate">{s.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
