import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@/lib/zod-resolver';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/features/auth/auth.store';
import { toLocalISODate } from '@/lib/date';
import {
  useCreateGuest,
  useUpdateGuest,
  useAnonymizeGuest,
  useGuestHistory,
} from './guests.api';
import type { AnyGuestDto, GuestResponseDto } from './guests.api';

// ─── Tab system (minimal button-group — NOT shadcn Tabs, per Phase 02-01 pattern) ─

const TABS = [
  { id: 'detalles', label: 'Detalles' },
  { id: 'historial', label: 'Historial' },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ─── Form schema ──────────────────────────────────────────────────────────────
// Zod v4: NO invalid_type_error on z.string() or any type — use .message or omit
// Date: submitted as "YYYY-MM-DD" via toLocalISODate(new Date(value))

const guestFormSchema = z.object({
  fullName: z.string().min(2, 'Nombre mínimo 2 caracteres').max(120),
  documentType: z.enum(['CC', 'CE', 'PASSPORT', 'TI', 'NIT'], {
    message: 'Seleccione un tipo de documento',
  }),
  documentNumber: z.string().min(3, 'Documento mínimo 3 caracteres').max(40),
  nationality: z
    .string()
    .length(2, 'Ingrese código ISO-2 (ej: CO, US)')
    .transform((v) => v.toUpperCase()),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)'),
  email: z.string().email('Email inválido').nullable().optional().or(z.literal('')),
  phone: z.string().nullable().optional(),
});

type GuestFormData = z.infer<typeof guestFormSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasDocumentNumber(guest: AnyGuestDto): guest is GuestResponseDto {
  return 'documentNumber' in guest;
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface GuestDrawerProps {
  isOpen: boolean;
  guest: AnyGuestDto | null;
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * GuestDrawer — 2-tab guest detail/create drawer.
 *
 * Pattern: inline fixed-panel (same as RoomDrawer, UserFormDrawer — NOT shadcn Sheet)
 * Width: max-w-[600px]
 * Tabs: Detalles | Historial (button-group, not shadcn Tabs)
 *
 * CRITICAL: date handling uses toLocalISODate() from lib/date.ts
 * NOT toISOString().slice(0,10) — prevents Bogotá UTC-5 off-by-one bug.
 *
 * Tokens: ink-* ramp for text, warm-* ramp for backgrounds, warm-line for borders.
 * OBS-007: consolidated from legacy text-text-* / bg-warm-white-* to current token ramp.
 */
export function GuestDrawer({ isOpen, guest, onClose, onSuccess }: GuestDrawerProps) {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';
  const isEdit = guest !== null;
  const guestId = guest?.id ?? '';

  const [activeTab, setActiveTab] = useState<TabId>('detalles');
  const [anonymizeConfirm, setAnonymizeConfirm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createGuest = useCreateGuest();
  const updateGuest = useUpdateGuest(guestId);
  const anonymizeGuest = useAnonymizeGuest(guestId);
  const { data: history, isLoading: historyLoading } = useGuestHistory(
    isEdit && activeTab === 'historial' ? guestId : null,
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GuestFormData>({
    resolver: zodResolver(guestFormSchema),
  });

  useEffect(() => {
    if (guest) {
      const docNum = hasDocumentNumber(guest) ? guest.documentNumber : '';
      reset({
        fullName: guest.fullName,
        documentType: guest.documentType as GuestFormData['documentType'],
        documentNumber: docNum,
        nationality: guest.nationality,
        dateOfBirth: guest.dateOfBirth,
        email: guest.email ?? '',
        phone: guest.phone ?? '',
      });
    } else {
      reset({
        fullName: '',
        documentType: 'CC',
        documentNumber: '',
        nationality: 'CO',
        dateOfBirth: '',
        email: '',
        phone: '',
      });
    }
    // These setState calls reset UI state synchronously when the `guest` prop
    // changes — intentional form-reset behavior, not a side-effect subscription.
    /* eslint-disable react-hooks/set-state-in-effect */
    setActiveTab('detalles');
    setAnonymizeConfirm(false);
    setSubmitError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [guest, reset]);

  const onSubmit = async (data: GuestFormData) => {
    setSubmitError(null);
    try {
      const payload = {
        fullName: data.fullName,
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        nationality: data.nationality,
        // CRITICAL: use toLocalISODate — NOT toISOString().slice(0,10)
        // Prevents UTC-5 Bogotá off-by-one for user-selected dates
        dateOfBirth: toLocalISODate(new Date(data.dateOfBirth + 'T00:00:00.000Z')),
        email: data.email || null,
        phone: data.phone || null,
      };

      if (isEdit) {
        await updateGuest.mutateAsync(payload);
      } else {
        await createGuest.mutateAsync(payload);
      }
      onSuccess();
    } catch (err: unknown) {
      setSubmitError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          (isEdit ? 'Error actualizando huésped' : 'Error creando huésped'),
      );
    }
  };

  const handleAnonymize = async () => {
    try {
      await anonymizeGuest.mutateAsync();
      setAnonymizeConfirm(false);
      onSuccess();
    } catch (err: unknown) {
      setSubmitError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error anonimizando huésped',
      );
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-warm-tan/20 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel — inline fixed-panel, NOT shadcn Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? `Huésped: ${guest?.fullName}` : 'Nuevo huésped'}
        className="fixed right-0 top-0 h-full w-full max-w-[600px] bg-warm-white border-l border-warm-line shadow-lg z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-warm-line">
          <h2 className="text-ink-1 text-lg font-semibold">
            {isEdit ? guest?.fullName : 'Nuevo huésped'}
          </h2>
          <button
            onClick={onClose}
            className="text-ink-3 hover:text-ink-1 transition-colors"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Tab navigation (button-group, NOT shadcn Tabs) */}
        <div className="flex border-b border-warm-line px-6 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-terracotta text-terracotta'
                  : 'border-transparent text-ink-3 hover:text-ink-1'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ── Detalles ── */}
          {activeTab === 'detalles' && (
            <div className="flex flex-col gap-6">
              {submitError && (
                <p className="text-xs text-terracotta-deep bg-red-50 border border-red-200 rounded px-3 py-2">
                  {submitError}
                </p>
              )}

              <form
                onSubmit={handleSubmit(onSubmit)}
                autoComplete="off"
                className="flex flex-col gap-4"
              >
                {/* Nombre completo */}
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="guestFullName"
                    className="text-sm font-medium text-ink-2"
                  >
                    Nombre completo
                  </label>
                  <Input
                    id="guestFullName"
                    type="text"
                    placeholder="Juan García Pérez"
                    {...register('fullName')}
                  />
                  {errors.fullName && (
                    <p className="text-xs text-terracotta-deep">
                      {errors.fullName.message}
                    </p>
                  )}
                </div>

                {/* Tipo y número de documento */}
                <div className="flex gap-4">
                  <div className="flex flex-col gap-1 w-36">
                    <label
                      htmlFor="guestDocType"
                      className="text-sm font-medium text-ink-2"
                    >
                      Tipo
                    </label>
                    <select
                      id="guestDocType"
                      {...register('documentType')}
                      className="flex h-9 w-full rounded-md border border-warm-line-strong bg-warm-cream px-3 py-1 text-sm text-ink-1 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-terracotta"
                    >
                      <option value="CC">CC</option>
                      <option value="CE">CE</option>
                      <option value="PASSPORT">Pasaporte</option>
                      <option value="TI">TI</option>
                      <option value="NIT">NIT</option>
                    </select>
                    {errors.documentType && (
                      <p className="text-xs text-terracotta-deep">
                        {errors.documentType.message}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 flex-1">
                    <label
                      htmlFor="guestDocNumber"
                      className="text-sm font-medium text-ink-2"
                    >
                      Número de documento
                    </label>
                    <Input
                      id="guestDocNumber"
                      type="text"
                      placeholder="1020304050"
                      {...register('documentNumber')}
                    />
                    {errors.documentNumber && (
                      <p className="text-xs text-terracotta-deep">
                        {errors.documentNumber.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Nacionalidad y fecha de nacimiento */}
                <div className="flex gap-4">
                  <div className="flex flex-col gap-1 w-28">
                    <label
                      htmlFor="guestNationality"
                      className="text-sm font-medium text-ink-2"
                    >
                      Nacionalidad
                    </label>
                    <Input
                      id="guestNationality"
                      type="text"
                      placeholder="CO"
                      maxLength={2}
                      {...register('nationality')}
                    />
                    {errors.nationality && (
                      <p className="text-xs text-terracotta-deep">
                        {errors.nationality.message}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 flex-1">
                    <label
                      htmlFor="guestDOB"
                      className="text-sm font-medium text-ink-2"
                    >
                      Fecha de nacimiento
                    </label>
                    <Input
                      id="guestDOB"
                      type="date"
                      {...register('dateOfBirth')}
                    />
                    {errors.dateOfBirth && (
                      <p className="text-xs text-terracotta-deep">
                        {errors.dateOfBirth.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Email */}
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="guestEmail"
                    className="text-sm font-medium text-ink-2"
                  >
                    Email{' '}
                    <span className="text-ink-3 font-normal">(opcional)</span>
                  </label>
                  <Input
                    id="guestEmail"
                    type="email"
                    placeholder="juan@example.com"
                    {...register('email')}
                  />
                  {errors.email && (
                    <p className="text-xs text-terracotta-deep">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                {/* Teléfono */}
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="guestPhone"
                    className="text-sm font-medium text-ink-2"
                  >
                    Teléfono{' '}
                    <span className="text-ink-3 font-normal">(opcional)</span>
                  </label>
                  <Input
                    id="guestPhone"
                    type="tel"
                    placeholder="+57 300 123 4567"
                    {...register('phone')}
                  />
                </div>

                {/* Submit buttons */}
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={onClose}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? 'Guardando...'
                      : isEdit
                      ? 'Guardar cambios'
                      : 'Crear huésped'}
                  </Button>
                </div>
              </form>

              {/* Anonymize section — ADMIN only, edit mode only, not already anonymized */}
              {isEdit && isAdmin && !guest?.anonymizedAt && (
                <>
                  <hr className="border-warm-line" />
                  <div className="flex flex-col gap-3">
                    <h3 className="text-ink-1 text-sm font-semibold">
                      Zona de peligro
                    </h3>
                    {!anonymizeConfirm ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setAnonymizeConfirm(true)}
                        className="border-red-300 text-red-700 hover:bg-red-50 self-start"
                      >
                        Anonimizar huésped
                      </Button>
                    ) : (
                      <div className="flex flex-col gap-2 bg-red-50 border border-red-200 rounded p-4">
                        <p className="text-sm text-red-800 font-medium">
                          Esta acción es irreversible. Se borrarán los datos PII del huésped.
                        </p>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setAnonymizeConfirm(false)}
                          >
                            Cancelar
                          </Button>
                          <Button
                            type="button"
                            onClick={handleAnonymize}
                            disabled={anonymizeGuest.isPending}
                            className="bg-red-700 hover:bg-red-800 text-white border-0"
                          >
                            {anonymizeGuest.isPending ? 'Anonimizando...' : 'Confirmar anonimización'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Historial ── */}
          {activeTab === 'historial' && (
            <div className="flex flex-col gap-4">
              {!isEdit ? (
                <p className="text-sm text-ink-3">
                  Guarda el huésped primero para ver su historial.
                </p>
              ) : historyLoading ? (
                <p className="text-sm text-ink-3">Cargando historial...</p>
              ) : history ? (
                <>
                  {/* Totals */}
                  <div className="flex gap-6 p-4 bg-warm-cream border border-warm-line rounded-lg">
                    <div>
                      <p className="text-xs text-ink-3">Total noches</p>
                      <p className="text-ink-1 font-semibold text-lg">
                        {history.totalNights}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-3">Total gastado</p>
                      <p className="text-ink-1 font-semibold text-lg">
                        {formatCOP(history.totalSpent)}
                      </p>
                    </div>
                  </div>

                  {/* Reservations table */}
                  {history.reservations.length === 0 ? (
                    <p className="text-sm text-ink-3 py-4 text-center">
                      Sin historial de estadías
                    </p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-warm-line">
                          <th className="text-left py-2 text-ink-2 font-medium">
                            Entrada
                          </th>
                          <th className="text-left py-2 text-ink-2 font-medium">
                            Salida
                          </th>
                          <th className="text-left py-2 text-ink-2 font-medium">
                            Estado
                          </th>
                          <th className="text-right py-2 text-ink-2 font-medium">
                            Noches
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.reservations.map((r) => (
                          <tr
                            key={r.id}
                            className="border-b border-warm-line last:border-0"
                          >
                            <td className="py-2 text-ink-1">
                              {r.checkInDate?.slice(0, 10) ?? '—'}
                            </td>
                            <td className="py-2 text-ink-2">
                              {r.checkOutDate?.slice(0, 10) ?? '—'}
                            </td>
                            <td className="py-2 text-ink-2">
                              {r.status}
                            </td>
                            <td className="py-2 text-ink-2 text-right">
                              {r.totalNights}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              ) : (
                <p className="text-sm text-ink-3">
                  Sin historial de estadías
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
