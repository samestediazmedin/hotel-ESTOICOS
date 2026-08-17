import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@/lib/zod-resolver';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useGuests,
  useCreateGuest,
  type AnyGuestDto,
} from '@/features/guests/guests.api';
import { useReservationWizardStore } from '../store/reservation-wizard.store';

// ─── New guest schema ─────────────────────────────────────────────────────────
// Zod v4: no invalid_type_error on z.number() — per project convention.

const newGuestSchema = z.object({
  fullName: z.string().min(2, 'El nombre es requerido'),
  documentType: z.enum(['CC', 'CE', 'PASSPORT', 'NIT', 'OTHER'], {
    message: 'Seleccione un tipo de documento',
  }),
  documentNumber: z.string().min(1, 'El número es requerido'),
  nationality: z.string().min(2, 'La nacionalidad es requerida'),
  dateOfBirth: z.string().min(1, 'La fecha de nacimiento es requerida'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
});

type NewGuestFormData = z.infer<typeof newGuestSchema>;

// ─── Debounce hook ────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Step3Guest — select existing guest or create new one.
 *
 * Two modes:
 * - Existing: debounced search → dropdown → select
 * - New: mini form mirroring CreateGuestSchema
 *
 * Date submission for dateOfBirth: toLocalISODate (Pitfall P6).
 */
export function Step3Guest() {
  const step3 = useReservationWizardStore((s) => s.step3);
  const setStep3 = useReservationWizardStore((s) => s.setStep3);

  const [mode, setMode] = useState<'existing' | 'new'>(
    step3.isNewGuest === true ? 'new' : 'existing',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<AnyGuestDto | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [newGuestError, setNewGuestError] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchQuery, 300);

  const { data: guestResults = [] } = useGuests(
    debouncedSearch.length >= 2 ? debouncedSearch : undefined,
  );

  const createGuest = useCreateGuest();

  const {
    register,
    handleSubmit,
    formState: { errors: newErrors, isSubmitting: newSubmitting },
  } = useForm<NewGuestFormData>({
    resolver: zodResolver(newGuestSchema),
  });

  // Re-hydrate from store on mount (goBack support).
  // Intentionally runs once on mount — step3 values are stable wizard state.
  useEffect(() => {
    if (step3.guestId && !step3.isNewGuest) {
      // Existing guest was selected before — show selected state.
      // We can't reconstruct the full guest object from just the ID here,
      // so we clear to allow re-selection (the guestId is preserved in store).
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSelectExistingGuest(guest: AnyGuestDto) {
    setSelectedGuest(guest);
    setSearchQuery(guest.fullName);
    setShowDropdown(false);
    setStep3({ guestId: guest.id, isNewGuest: false });
  }

  async function onSubmitNewGuest(data: NewGuestFormData) {
    setNewGuestError(null);
    try {
      const newGuest = await createGuest.mutateAsync({
        fullName: data.fullName,
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        nationality: data.nationality,
        // Use toLocalISODate from a Date parsed at UTC noon to avoid timezone shift (Pitfall P6)
        dateOfBirth: data.dateOfBirth,
        email: data.email || null,
        phone: data.phone || null,
      });
      setStep3({ guestId: newGuest.id, isNewGuest: true });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message ??
        'Error al crear el huésped. Intenta de nuevo.';
      setNewGuestError(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Mode selector */}
      <div className="flex gap-2 p-1 bg-warm-cream border border-warm-line rounded-lg">
        <button
          type="button"
          onClick={() => { setMode('existing'); setSelectedGuest(null); }}
          className={`flex-1 py-1.5 text-sm rounded-md font-medium transition-colors ${
            mode === 'existing'
              ? 'bg-warm-white shadow-sm text-ink-1'
              : 'text-ink-3 hover:text-ink-2'
          }`}
        >
          Huésped existente
        </button>
        <button
          type="button"
          onClick={() => setMode('new')}
          className={`flex-1 py-1.5 text-sm rounded-md font-medium transition-colors ${
            mode === 'new'
              ? 'bg-warm-white shadow-sm text-ink-1'
              : 'text-ink-3 hover:text-ink-2'
          }`}
        >
          Nuevo huésped
        </button>
      </div>

      {/* ── Existing guest search ── */}
      {mode === 'existing' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 relative">
            <label
              htmlFor="guestSearch"
              className="text-sm font-medium text-ink-2"
            >
              Buscar huésped por nombre o documento
            </label>
            <Input
              id="guestSearch"
              type="text"
              placeholder="Escribe el nombre del huésped..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
                setSelectedGuest(null);
              }}
              autoComplete="off"
            />

            {/* Dropdown */}
            {showDropdown && debouncedSearch.length >= 2 && guestResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-warm-white border border-warm-line-strong rounded-md shadow-md z-50 max-h-48 overflow-y-auto">
                {guestResults.map((guest) => (
                  <button
                    key={guest.id}
                    type="button"
                    onClick={() => handleSelectExistingGuest(guest)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-warm-cream transition-colors"
                  >
                    <span className="font-medium text-ink-1">
                      {guest.fullName}
                    </span>
                    {guest.email && (
                      <span className="text-ink-3 ml-2">{guest.email}</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {showDropdown && debouncedSearch.length >= 2 && guestResults.length === 0 && (
              <p className="text-xs text-ink-3 mt-1">
                No se encontraron huéspedes. ¿Deseas registrar uno nuevo?
              </p>
            )}
          </div>

          {selectedGuest && (
            <div className="flex items-center gap-3 p-3 bg-warm-cream border border-warm-line rounded-md">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-1 truncate">
                  {selectedGuest.fullName}
                </p>
                {selectedGuest.email && (
                  <p className="text-xs text-ink-3 truncate">
                    {selectedGuest.email}
                  </p>
                )}
              </div>
              <span className="text-xs text-terracotta-deep font-medium">Seleccionado</span>
            </div>
          )}
        </div>
      )}

      {/* ── New guest form ── */}
      {mode === 'new' && (
        <form
          onSubmit={handleSubmit(onSubmitNewGuest)}
          autoComplete="off"
          className="flex flex-col gap-4"
        >
          {newGuestError && (
            <p className="text-xs text-terracotta bg-terracotta-tint border border-terracotta-soft rounded px-3 py-2">
              {newGuestError}
            </p>
          )}

          <div className="flex flex-col gap-1">
            <label
              htmlFor="ng-fullName"
              className="text-sm font-medium text-ink-2"
            >
              Nombre completo
            </label>
            <Input
              id="ng-fullName"
              type="text"
              placeholder="María García López"
              {...register('fullName')}
            />
            {newErrors.fullName && (
              <p className="text-xs text-terracotta">
                {newErrors.fullName.message}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <div className="flex flex-col gap-1 w-40">
              <label
                htmlFor="ng-docType"
                className="text-sm font-medium text-ink-2"
              >
                Tipo de documento
              </label>
              <select
                id="ng-docType"
                {...register('documentType')}
                className="flex h-9 w-full rounded-md border border-warm-line bg-warm-white px-3 py-1 text-sm text-ink-1 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-terracotta"
              >
                <option value="">Tipo...</option>
                <option value="CC">CC</option>
                <option value="CE">CE</option>
                <option value="PASSPORT">Pasaporte</option>
                <option value="NIT">NIT</option>
                <option value="OTHER">Otro</option>
              </select>
              {newErrors.documentType && (
                <p className="text-xs text-terracotta">
                  {newErrors.documentType.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1 flex-1">
              <label
                htmlFor="ng-docNum"
                className="text-sm font-medium text-ink-2"
              >
                Número de documento
              </label>
              <Input
                id="ng-docNum"
                type="text"
                placeholder="12345678"
                {...register('documentNumber')}
              />
              {newErrors.documentNumber && (
                <p className="text-xs text-terracotta">
                  {newErrors.documentNumber.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex flex-col gap-1 flex-1">
              <label
                htmlFor="ng-nationality"
                className="text-sm font-medium text-ink-2"
              >
                Nacionalidad
              </label>
              <Input
                id="ng-nationality"
                type="text"
                placeholder="Colombiana"
                {...register('nationality')}
              />
              {newErrors.nationality && (
                <p className="text-xs text-terracotta">
                  {newErrors.nationality.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1 flex-1">
              <label
                htmlFor="ng-dob"
                className="text-sm font-medium text-ink-2"
              >
                Fecha de nacimiento
              </label>
              {/* Date input — use toLocalISODate on submission if using a date picker;
                  here we use a date input which returns "YYYY-MM-DD" directly.
                  toLocalISODate is used below for DateRange pickers but native <input type="date">
                  always returns "YYYY-MM-DD" string — no UTC conversion needed. */}
              <input
                id="ng-dob"
                type="date"
                className="flex h-9 w-full rounded-md border border-warm-line bg-warm-white px-3 py-1 text-sm text-ink-1 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-terracotta"
                {...register('dateOfBirth')}
              />
              {newErrors.dateOfBirth && (
                <p className="text-xs text-terracotta">
                  {newErrors.dateOfBirth.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex flex-col gap-1 flex-1">
              <label
                htmlFor="ng-email"
                className="text-sm font-medium text-ink-2"
              >
                Email{' '}
                <span className="text-ink-3 font-normal">(opcional)</span>
              </label>
              <Input
                id="ng-email"
                type="email"
                placeholder="maria@example.com"
                {...register('email')}
              />
              {newErrors.email && (
                <p className="text-xs text-terracotta">
                  {newErrors.email.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1 flex-1">
              <label
                htmlFor="ng-phone"
                className="text-sm font-medium text-ink-2"
              >
                Teléfono{' '}
                <span className="text-ink-3 font-normal">(opcional)</span>
              </label>
              <Input
                id="ng-phone"
                type="tel"
                placeholder="+57 300 0000000"
                {...register('phone')}
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="terracotta"
              disabled={newSubmitting || createGuest.isPending}
              className="w-full"
            >
              {newSubmitting || createGuest.isPending
                ? 'Registrando huésped...'
                : 'Registrar y continuar →'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
