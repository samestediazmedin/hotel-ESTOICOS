import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { checkInReservation } from './operations.api';
import type { ReservationResponseDto } from '@/features/reservations/reservations.api';
import { housekeepingApi } from '@/features/housekeeping/housekeeping.api';
import { useAuthStore } from '@/features/auth/auth.store';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CheckInDrawerProps {
  reservation: ReservationResponseDto | null;
  open: boolean;
  onClose: () => void;
}

// ─── 5-step checklist state ───────────────────────────────────────────────────

interface ChecklistState {
  identity: boolean;    // Step 1: Verificar identidad
  register: boolean;    // Step 2: Firmar registro
  key: boolean;         // Step 3: Entregar llave
  transfer: boolean;    // Step 4: Confirmar transfer/extras
  statusChange: boolean; // Step 5: Cambiar estado de habitación
}

const CHECKLIST_STEPS: { key: keyof ChecklistState; label: string }[] = [
  { key: 'identity', label: 'Verificar identidad del huésped' },
  { key: 'register', label: 'Firmar registro de alojamiento' },
  { key: 'key', label: 'Entregar llave de la habitación' },
  { key: 'transfer', label: 'Confirmar transfer/extras solicitados' },
  { key: 'statusChange', label: 'Cambiar estado de habitación a Ocupada' },
];

// ─── RBAC helpers ────────────────────────────────────────────────────────────

const ROLES_ALLOWED_TO_TRANSITION = new Set(['ADMIN', 'MANAGER', 'HOUSEKEEPING'] as const);

function isDirtyError(error: unknown): boolean {
  const msg =
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '';
  return msg.includes('DIRTY');
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CheckInDrawer({ reservation, open, onClose }: CheckInDrawerProps) {
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);

  const [checks, setChecks] = useState<ChecklistState>({
    identity: false,
    register: false,
    key: false,
    transfer: false,
    statusChange: false,
  });

  const allChecked = Object.values(checks).every(Boolean);

  const mutation = useMutation({
    mutationFn: () => checkInReservation(reservation!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff', 'reservations'] });
      void queryClient.invalidateQueries({ queryKey: ['staff', 'folios'] });
      onClose();
      // Reset checklist for next use
      setChecks({ identity: false, register: false, key: false, transfer: false, statusChange: false });
    },
  });

  // ── Shortcut: transition DIRTY → INSPECTION then auto-retry check-in ──────
  const roomTransitionMutation = useMutation({
    mutationFn: () => {
      if (!reservation?.roomId) return Promise.reject(new Error('Sin roomId'));
      return housekeepingApi.transitionRoom(reservation.roomId, 'INSPECTION');
    },
    onSuccess: () => {
      mutation.reset();
      mutation.mutate();
    },
  });

  function toggleCheck(key: keyof ChecklistState) {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleClose() {
    setChecks({ identity: false, register: false, key: false, transfer: false, statusChange: false });
    mutation.reset();
    onClose();
  }

  if (!open || !reservation) return null;

  type ApiError = { response?: { status?: number; data?: { message?: string } } };
  const errorMessage =
    (mutation.error as ApiError)?.response?.status === 412
      ? (mutation.error as ApiError)?.response?.data?.message
      : mutation.error
      ? 'Error al realizar el check-in. Por favor intente de nuevo.'
      : null;

  const isDirtyBlocked = !!mutation.error && isDirtyError(mutation.error);
  const canTransition = role != null && ROLES_ALLOWED_TO_TRANSITION.has(role as 'ADMIN' | 'MANAGER' | 'HOUSEKEEPING');

  const transitionErrorMessage = roomTransitionMutation.isError
    ? ((roomTransitionMutation.error as ApiError)?.response?.data?.message ??
       'No se pudo cambiar el estado de la habitación. Intente de nuevo.')
    : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink-1/20 z-40"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Drawer panel — inline fixed pattern (same as RoomDrawer) */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Check-in: ${reservation.guest?.fullName ?? '—'}`}
        className="fixed right-0 top-0 h-full w-full max-w-[480px] bg-warm-white border-l border-warm-line shadow-lg z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-warm-line">
          <div>
            <h2 className="text-ink-1 text-lg font-semibold">Check-in</h2>
            <p className="text-ink-3 text-sm mt-0.5">
              {reservation.guest?.fullName ?? '—'} — Hab. {reservation.room?.number ?? '—'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-ink-3 hover:text-ink-1 transition-colors"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Main — scrollable checklist */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Reservation summary */}
          <div className="bg-warm-cream rounded-lg border border-warm-line p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-ink-3">Reserva</span>
              <span className="text-ink-1 font-medium">#{reservation.id.slice(-8).toUpperCase()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-3">Entrada</span>
              <span className="text-ink-1">{reservation.checkInDate}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-3">Salida</span>
              <span className="text-ink-1">{reservation.checkOutDate}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-3">Habitación</span>
              <span className="text-ink-1">{reservation.room?.number ?? '—'}</span>
            </div>
          </div>

          {/* 5-step checklist (OPS-05) */}
          <div className="space-y-3">
            <h3 className="text-ink-1 text-sm font-semibold">
              Lista de verificación de check-in
            </h3>
            {CHECKLIST_STEPS.map((step, idx) => (
              <label
                key={step.key}
                className="flex items-start gap-3 p-3 rounded-lg border border-warm-line bg-warm-cream cursor-pointer hover:bg-warm-white transition-colors"
              >
                <input
                  type="checkbox"
                  checked={checks[step.key]}
                  onChange={() => toggleCheck(step.key)}
                  className="mt-0.5 h-4 w-4 rounded border-warm-line-strong accent-brand-primary"
                />
                <div className="flex-1">
                  <span className="text-ink-3 text-xs mr-2">{idx + 1}.</span>
                  <span className={`text-sm ${checks[step.key] ? 'text-ink-3 line-through' : 'text-ink-1'}`}>
                    {step.label}
                  </span>
                </div>
              </label>
            ))}
          </div>

          {/* Progress indicator */}
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-border-subtle rounded-full h-1.5">
              <div
                className="bg-terracotta rounded-full h-1.5 transition-all"
                style={{ width: `${(Object.values(checks).filter(Boolean).length / 5) * 100}%` }}
              />
            </div>
            <span className="text-ink-3 text-xs">
              {Object.values(checks).filter(Boolean).length}/5
            </span>
          </div>

          {/* Error display */}
          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-3">
              <p className="text-red-600 text-sm">{errorMessage}</p>

              {/* ── Dirty-room shortcut ──────────────────────────────────── */}
              {isDirtyBlocked && canTransition && (
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full text-sm"
                    disabled={roomTransitionMutation.isPending || mutation.isPending}
                    onClick={() => roomTransitionMutation.mutate()}
                    data-testid="mark-room-ready-btn"
                  >
                    {roomTransitionMutation.isPending
                      ? 'Marcando habitación...'
                      : 'Marcar habitación como lista'}
                  </Button>
                  {transitionErrorMessage && (
                    <p className="text-red-600 text-xs">{transitionErrorMessage}</p>
                  )}
                </div>
              )}

              {isDirtyBlocked && !canTransition && (
                <p className="text-ink-3 text-xs" data-testid="dirty-reception-hint">
                  Pida a housekeeping marcar la habitación como lista antes del check-in.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer — CTA */}
        <div className="p-6 border-t border-warm-line flex gap-3">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={handleClose}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={!allChecked || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Procesando...' : 'Confirmar Check-In'}
          </Button>
        </div>
      </div>
    </>
  );
}
