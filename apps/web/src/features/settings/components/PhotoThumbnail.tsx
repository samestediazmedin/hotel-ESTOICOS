import { GripVertical, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { AdminHotelPhoto } from '../hotel-settings.api';

interface Props {
  photo: AdminHotelPhoto;
  index: number;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (index: number) => void;
  onDelete: (id: string) => void;
  deleting: boolean;
}

/**
 * PhotoThumbnail — single draggable card in the hotel gallery grid.
 *
 * HTML5 native drag-and-drop (RESEARCH Pattern 7) — no @dnd-kit dependency.
 * Pitfall 5 (RESEARCH): onDragOver MUST call preventDefault() to allow onDrop to fire.
 * The drag handle (GripVertical) is decorative — the entire card is draggable.
 *
 * Delete flow: click X → AlertDialog confirmation → onDelete(photo.id)
 * Never uses window.confirm.
 */
export function PhotoThumbnail({
  photo,
  index,
  onDragStart,
  onDragOver,
  onDrop,
  onDelete,
  deleting,
}: Props) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
        onDragStart(index);
      }}
      onDragOver={onDragOver}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(index);
      }}
      className="group relative aspect-video overflow-hidden rounded-md border border-warm-line bg-warm-paper cursor-move select-none"
    >
      <img
        src={photo.url}
        alt={photo.alt || `Foto ${index + 1}`}
        className="h-full w-full object-cover"
        draggable={false}
      />

      {/* Order badge — top-left */}
      <span className="absolute top-1.5 left-1.5 bg-ink-1/70 text-warm-white text-xs px-1.5 py-0.5 rounded font-mono leading-none">
        {index + 1}
      </span>

      {/* Drag handle — bottom-left */}
      <span
        aria-hidden
        className="absolute bottom-1.5 left-1.5 bg-warm-white/85 text-ink-2 rounded p-0.5"
      >
        <GripVertical size={14} />
      </span>

      {/* Delete with confirmation — top-right */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button type="button"
            disabled={deleting}
            aria-label={`Eliminar foto ${index + 1}`}
            className="absolute top-1.5 right-1.5 bg-warm-white/85 hover:bg-terracotta hover:text-warm-white text-ink-2 rounded p-0.5 transition-colors disabled:opacity-50"
          >
            <X size={14} aria-hidden />
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta foto?</AlertDialogTitle>
            <AlertDialogDescription>
              La foto se eliminará del portal público inmediatamente. Esta
              acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete(photo.id)}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
