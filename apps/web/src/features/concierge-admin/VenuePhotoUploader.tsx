import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { uploadVenuePhoto } from './concierge-admin.api';

// ─── Types ────────────────────────────────────────────────────────────────────

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

interface FileUploadStatus {
  name: string;
  state: UploadState;
  error?: string;
}

interface VenuePhotoUploaderProps {
  venueId: string;
  /** Called when a photo is successfully uploaded (storage filename returned) */
  onUploaded?: (key: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB — matches StorageService cap

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * VenuePhotoUploader — single multipart POST (2026-05-28).
 *
 * Replaces the previous 3-step presigned-R2 flow with one upload that
 * streams through StorageService on the API (Sharp pipeline + sidecar +
 * thumbnail) and writes to the Railway Volume at /app/storage.
 */
export function VenuePhotoUploader({ venueId, onUploaded }: VenuePhotoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatuses, setUploadStatuses] = useState<FileUploadStatus[]>([]);

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
      const { key } = await uploadVenuePhoto(venueId, file);
      setUploadStatuses((prev) =>
        prev.map((s) => (s.name === file.name ? { ...s, state: 'done' as const } : s)),
      );
      onUploaded?.(key);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const apiMsg = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      const message =
        status === 400
          ? `Datos del archivo inválidos${apiMsg ? ` — ${apiMsg}` : ''}`
          : status === 401
            ? 'Sesión expirada — vuelva a iniciar sesión'
            : status === 403
              ? 'Sin permisos para subir fotos'
              : status === 404
                ? 'Venue no encontrada'
                : status === 413
                  ? 'Archivo demasiado grande'
                  : err instanceof Error
                    ? err.message
                    : 'Error al subir el archivo';
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

  return (
    <div className="flex flex-col gap-3">
      {/* Upload area */}
      <label
        htmlFor={`venue-photo-upload-${venueId}`}
        className="flex flex-col items-center justify-center gap-2 cursor-pointer border-2 border-dashed border-warm-line rounded-lg p-4 text-center text-ink-3 hover:border-brand-primary hover:text-brand-primary transition-colors"
      >
        <Upload className="w-5 h-5" />
        <span className="text-sm">Subir foto</span>
        <span className="text-xs">JPG, PNG, WebP — máx. 5MB</span>
      </label>
      <input
        ref={fileInputRef}
        id={`venue-photo-upload-${venueId}`}
        type="file"
        accept="image/*"
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
