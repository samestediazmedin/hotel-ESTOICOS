/**
 * GuestDetailPage — Staff-facing guest detail route at /guests/:id (Phase 16-04, GCC-09)
 *
 * 4 sections:
 *  1. Header: fullName + document + nationality + age + ContactButtons + Editar
 *  2. Información de contacto (read mode / edit form toggle)
 *  3. Reservaciones — list from useGuestHistory with per-row ContactButtons
 *  4. Últimos contactos — last 5 events via useGuestContactEvents
 *
 * Zero hex. Token utilities only (bg-bg-base, text-ink-*, bg-warm-*, border-warm-*).
 * Requirements: GCC-09
 */

import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@/lib/zod-resolver';
import { z } from 'zod';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/features/auth/auth.store';
import {
  useGuest,
  useGuestHistory,
  useUpdateGuest,
  useDeleteGuest,
  useAnonymizeGuest,
} from './guests.api';
import { useGuestContactEvents } from './hooks/useGuestContactEvents';
import { ContactButtons } from './components/ContactButtons';
import type { ContactMethod, GuestContactEventDto } from './types';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Extended guest type with Phase 15 fields.
 * AnyGuestDto is a union so we cannot `extend` it — instead we define all
 * fields explicitly. These mirror GuestResponseDto + Phase 15 additions.
 */
interface ExtendedGuestDto {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  documentType: string;
  documentNumber?: string; // absent for HOUSEKEEPING role
  nationality: string;
  dateOfBirth: string;
  anonymizedAt: string | null;
  createdAt: string;
  // Phase 15 additions
  whatsappNumber?: string | null;
  contactPreference?: string | null;
  preferredLanguage?: string | null;
  marketingConsent?: boolean | null;
  dietaryRestrictions?: string | null;
  specialRequests?: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const METHOD_LABEL: Record<ContactMethod, string> = {
  CALL: 'Llamada',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
};

const CONTACT_PREFERENCE_LABEL: Record<string, string> = {
  PHONE: 'Teléfono',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
};

const LANGUAGE_LABEL: Record<string, string> = {
  es: 'Español',
  en: 'Inglés',
  fr: 'Francés',
  pt: 'Portugués',
  de: 'Alemán',
  it: 'Italiano',
  zh: 'Chino',
  ar: 'Árabe',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ageFromDateOfBirth(iso: string): string {
  try {
    const dob = new Date(iso);
    if (Number.isNaN(dob.getTime())) return '—';
    const diff = Date.now() - dob.getTime();
    const age = Math.floor(diff / 31557600000);
    if (Number.isNaN(age) || age < 0) return '—';
    return `${age}`;
  } catch {
    return '—';
  }
}

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { locale: es, addSuffix: true });
  } catch {
    return '—';
  }
}

// ─── Edit form schema ─────────────────────────────────────────────────────────

const editGuestSchema = z.object({
  email: z.string().email('Email inválido').nullable().optional().or(z.literal('')),
  phone: z.string().nullable().optional(),
  whatsappNumber: z.string().nullable().optional(),
  contactPreference: z.enum(['PHONE', 'WHATSAPP', 'EMAIL']).nullable().optional(),
  preferredLanguage: z.string().nullable().optional(),
  marketingConsent: z.boolean().optional(),
  dietaryRestrictions: z.string().nullable().optional(),
  specialRequests: z.string().nullable().optional(),
});

type EditGuestFormData = z.infer<typeof editGuestSchema>;

// ─── Sub-components ───────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-bg-base p-6">
      <p className="text-ink-3 text-sm">Cargando...</p>
    </div>
  );
}

function NotFoundCard() {
  return (
    <div className="min-h-screen bg-bg-base p-6 flex flex-col items-center justify-center gap-4">
      <h1 className="text-ink-1 text-2xl font-semibold">Huésped no encontrado</h1>
      <p className="text-ink-3 text-sm">El huésped solicitado no existe o fue eliminado.</p>
      <Link
        to="/guests"
        className="text-terracotta text-sm underline underline-offset-4 hover:text-terracotta/80"
      >
        Volver a la lista de huéspedes
      </Link>
    </div>
  );
}

// ─── Info section (read mode) ─────────────────────────────────────────────────

function GuestInfoSection({ guest }: { guest: ExtendedGuestDto }) {
  return (
    <div className="bg-warm-white border border-warm-line rounded-lg p-6">
      <h2 className="text-ink-1 text-lg font-semibold mb-4">
        Información de contacto
      </h2>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <InfoRow label="Email" value={guest.email ?? '—'} />
        <InfoRow label="Teléfono" value={guest.phone ?? '—'} />
        <InfoRow label="WhatsApp" value={(guest as ExtendedGuestDto).whatsappNumber ?? '—'} />
        <InfoRow
          label="Preferencia de contacto"
          value={
            (guest as ExtendedGuestDto).contactPreference
              ? (CONTACT_PREFERENCE_LABEL[(guest as ExtendedGuestDto).contactPreference!] ??
                  (guest as ExtendedGuestDto).contactPreference!)
              : '—'
          }
        />
        <InfoRow
          label="Idioma preferido"
          value={
            (guest as ExtendedGuestDto).preferredLanguage
              ? (LANGUAGE_LABEL[(guest as ExtendedGuestDto).preferredLanguage!.toLowerCase()] ??
                  (guest as ExtendedGuestDto).preferredLanguage!)
              : '—'
          }
        />
        <InfoRow
          label="Marketing"
          value={(guest as ExtendedGuestDto).marketingConsent ? 'Aceptado' : 'Rechazado'}
        />
        <InfoRow
          label="Restricciones dietéticas"
          value={(guest as ExtendedGuestDto).dietaryRestrictions ?? '—'}
        />
        <InfoRow
          label="Solicitudes especiales"
          value={(guest as ExtendedGuestDto).specialRequests ?? '—'}
        />
      </dl>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-ink-3 text-xs font-medium">{label}</dt>
      <dd className="text-ink-1 text-sm">{value}</dd>
    </div>
  );
}

// ─── Date formatter ───────────────────────────────────────────────────────────

function formatDisplayDate(iso: string): string {
  try {
    const d = new Date(iso + 'T00:00:00.000Z');
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return '—';
  }
}

// ─── Edit form ────────────────────────────────────────────────────────────────

interface GuestEditFormProps {
  guest: ExtendedGuestDto;
  guestId: string;
  onCancel: () => void;
  onSuccess: () => void;
}

function GuestEditForm({ guest, guestId, onCancel, onSuccess }: GuestEditFormProps) {
  const updateGuest = useUpdateGuest(guestId);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditGuestFormData>({
    resolver: zodResolver(editGuestSchema),
    defaultValues: {
      email: guest.email ?? '',
      phone: guest.phone ?? '',
      whatsappNumber: guest.whatsappNumber ?? '',
      contactPreference:
        (guest.contactPreference as 'PHONE' | 'WHATSAPP' | 'EMAIL' | null) ?? null,
      preferredLanguage: guest.preferredLanguage ?? '',
      marketingConsent: guest.marketingConsent ?? false,
      dietaryRestrictions: guest.dietaryRestrictions ?? '',
      specialRequests: guest.specialRequests ?? '',
    },
  });

  const onSubmit = async (data: EditGuestFormData) => {
    setSubmitError(null);
    try {
      const payload = {
        email: data.email || null,
        phone: data.phone || null,
        whatsappNumber: data.whatsappNumber || null,
        contactPreference: data.contactPreference ?? null,
        preferredLanguage: data.preferredLanguage || null,
        marketingConsent: data.marketingConsent ?? false,
        dietaryRestrictions: data.dietaryRestrictions || null,
        specialRequests: data.specialRequests || null,
      };
      await updateGuest.mutateAsync(payload);
      onSuccess();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Error actualizando huésped';
      setSubmitError(message);
    }
  };

  return (
    <div className="bg-warm-white border border-warm-line rounded-lg p-6">
      <h2 className="text-ink-1 text-lg font-semibold mb-4">
        Editar información de contacto
      </h2>

      {submitError && (
        <p className="mb-4 text-xs text-terracotta-deep bg-warm-cream border border-warm-line-strong rounded px-3 py-2">
          {submitError}
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Email */}
          <div className="flex flex-col gap-1">
            <label className="text-ink-2 text-sm font-medium" htmlFor="edit-email">
              Email
            </label>
            <Input
              id="edit-email"
              type="email"
              placeholder="juan@example.com"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-terracotta-deep">{errors.email.message}</p>
            )}
          </div>

          {/* Teléfono */}
          <div className="flex flex-col gap-1">
            <label className="text-ink-2 text-sm font-medium" htmlFor="edit-phone">
              Teléfono
            </label>
            <Input
              id="edit-phone"
              type="tel"
              placeholder="+57 300 555 1234"
              {...register('phone')}
            />
          </div>

          {/* WhatsApp */}
          <div className="flex flex-col gap-1">
            <label className="text-ink-2 text-sm font-medium" htmlFor="edit-whatsapp">
              WhatsApp
            </label>
            <Input
              id="edit-whatsapp"
              type="tel"
              placeholder="+57 300 555 1234"
              {...register('whatsappNumber')}
            />
          </div>

          {/* Preferencia de contacto */}
          <div className="flex flex-col gap-1">
            <label
              className="text-ink-2 text-sm font-medium"
              htmlFor="edit-contact-pref"
            >
              Preferencia de contacto
            </label>
            <select
              id="edit-contact-pref"
              {...register('contactPreference')}
              className="flex h-9 w-full rounded-md border border-warm-line-strong bg-warm-cream px-3 py-1 text-sm text-ink-1 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-terracotta"
            >
              <option value="">— Sin preferencia —</option>
              <option value="PHONE">Teléfono</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">Email</option>
            </select>
          </div>

          {/* Idioma preferido */}
          <div className="flex flex-col gap-1">
            <label className="text-ink-2 text-sm font-medium" htmlFor="edit-lang">
              Idioma preferido
            </label>
            <Input
              id="edit-lang"
              type="text"
              placeholder="ES"
              maxLength={5}
              {...register('preferredLanguage')}
            />
          </div>

          {/* Marketing consent */}
          <div className="flex items-center gap-2 self-end pb-1">
            <input
              id="edit-marketing"
              type="checkbox"
              className="h-4 w-4 rounded border-warm-line-strong text-terracotta"
              {...register('marketingConsent')}
            />
            <label className="text-ink-2 text-sm" htmlFor="edit-marketing">
              Acepta comunicaciones de marketing
            </label>
          </div>
        </div>

        {/* Restricciones y solicitudes — full width */}
        <div className="flex flex-col gap-1">
          <label
            className="text-ink-2 text-sm font-medium"
            htmlFor="edit-dietary"
          >
            Restricciones dietéticas
          </label>
          <Input
            id="edit-dietary"
            type="text"
            placeholder="vegetariano, sin gluten..."
            {...register('dietaryRestrictions')}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            className="text-ink-2 text-sm font-medium"
            htmlFor="edit-special"
          >
            Solicitudes especiales
          </label>
          <Input
            id="edit-special"
            type="text"
            placeholder="cama extra, vista cerros..."
            {...register('specialRequests')}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ─── Reservaciones section ────────────────────────────────────────────────────

function ReservationsSection({
  guestId,
  guest,
  isLoading,
  reservations,
}: {
  guestId: string;
  guest: ExtendedGuestDto;
  isLoading: boolean;
  reservations?: Array<{
    id: string;
    checkInDate: string;
    checkOutDate: string;
    status: string;
    totalNights: number;
  }>;
}) {
  return (
    <div className="bg-warm-white border border-warm-line rounded-lg p-6">
      <h2 className="text-ink-1 text-lg font-semibold mb-4">
        Reservaciones {reservations ? `(${reservations.length})` : ''}
      </h2>

      {isLoading && (
        <p className="text-ink-3 text-sm">Cargando reservaciones...</p>
      )}

      {!isLoading && (!reservations || reservations.length === 0) && (
        <p className="text-ink-3 text-sm">Sin reservaciones registradas.</p>
      )}

      {!isLoading && reservations && reservations.length > 0 && (
        <div className="flex flex-col gap-4">
          {reservations.map((r) => (
            <div
              key={r.id}
              className="flex flex-col gap-2 border-b border-warm-line pb-4 last:border-0 last:pb-0"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex flex-col">
                  <span className="text-ink-1 text-sm font-medium font-mono">
                    #{r.id.slice(0, 8)}
                  </span>
                  <span className="text-ink-2 text-xs">
                    {r.checkInDate?.slice(0, 10)} → {r.checkOutDate?.slice(0, 10)} ·{' '}
                    {r.status} · {r.totalNights} noche{r.totalNights !== 1 ? 's' : ''}
                  </span>
                </div>
                <ContactButtons
                  guestId={guestId}
                  fullName={guest.fullName}
                  email={guest.email}
                  phone={guest.phone}
                  whatsappNumber={guest.whatsappNumber}
                  size="sm"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Últimos contactos section ────────────────────────────────────────────────

function ContactEventsSection({
  events,
  isLoading,
}: {
  events: GuestContactEventDto[];
  isLoading: boolean;
}) {
  return (
    <div className="bg-warm-white border border-warm-line rounded-lg p-6">
      <h2 className="text-ink-1 text-lg font-semibold mb-4">
        Últimos contactos ({events.length})
      </h2>

      {isLoading && (
        <p className="text-ink-3 text-sm">Cargando contactos...</p>
      )}

      {!isLoading && events.length === 0 && (
        <p className="text-ink-3 text-sm">Aún no hay contactos registrados.</p>
      )}

      {!isLoading && events.length > 0 && (
        <ul className="flex flex-col gap-3">
          {events.slice(0, 5).map((event) => (
            <li key={event.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <span className="text-ink-1 text-sm font-medium">
                  {event.staffUser.name ?? 'Staff'}
                </span>
                <span className="text-ink-3 text-sm mx-1">·</span>
                <span className="text-ink-2 text-sm">
                  {METHOD_LABEL[event.method] ?? event.method}
                </span>
                <span className="text-ink-3 text-sm mx-1">·</span>
                <span className="text-ink-3 text-xs">
                  {relativeTime(event.createdAt)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Delete / Anonymize danger zone (ADMIN only) ──────────────────────────────

type DangerAction = 'none' | 'confirm-delete' | 'confirm-anonymize';

interface DeleteOrAnonymizeSectionProps {
  guestId: string;
  hasReservations: boolean;
  isAnonymized: boolean;
}

function DeleteOrAnonymizeSection({
  guestId,
  hasReservations,
  isAnonymized,
}: DeleteOrAnonymizeSectionProps) {
  const [action, setAction] = useState<DangerAction>('none');
  const [error, setError] = useState<string | null>(null);

  const deleteGuest = useDeleteGuest(guestId);
  const anonymizeGuest = useAnonymizeGuest(guestId);
  const navigate = useNavigate();

  const handleDeleteClick = () => {
    setError(null);
    if (hasReservations) {
      // Tiene reservas — ofrece anonimizar
      setAction('confirm-anonymize');
    } else {
      // Sin reservas — ofrece borrado permanente
      setAction('confirm-delete');
    }
  };

  const handleConfirmDelete = async () => {
    setError(null);
    try {
      await deleteGuest.mutateAsync();
      navigate('/guests');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Error eliminando huésped';
      // Si el backend devuelve 409 (cambio de estado entre render y click)
      if (msg.includes('reservas asociadas')) {
        setAction('confirm-anonymize');
        setError(
          'El huésped adquirió reservas desde que se cargó la página. Se ofrece anonimización en su lugar.',
        );
      } else {
        setError(msg);
      }
    }
  };

  const handleConfirmAnonymize = async () => {
    setError(null);
    try {
      await anonymizeGuest.mutateAsync();
      setAction('none');
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Error anonimizando huésped',
      );
    }
  };

  const isPending = deleteGuest.isPending || anonymizeGuest.isPending;

  return (
    <div className="bg-warm-white border border-warm-line rounded-lg p-6">
      <h2 className="text-ink-1 text-sm font-semibold mb-3">Zona de peligro</h2>

      {error && (
        <p className="mb-3 text-xs text-terracotta-deep bg-warm-cream border border-warm-line-strong rounded px-3 py-2">
          {error}
        </p>
      )}

      {action === 'none' && (
        <Button
          type="button"
          variant="outline"
          onClick={handleDeleteClick}
          disabled={isAnonymized}
          className="border-red-300 text-red-700 hover:bg-red-50"
        >
          {isAnonymized ? 'Huésped anonimizado' : 'Eliminar huésped'}
        </Button>
      )}

      {action === 'confirm-delete' && (
        <div className="flex flex-col gap-3 bg-red-50 border border-red-200 rounded p-4">
          <p className="text-sm text-red-800 font-medium">
            Esta acción eliminará permanentemente al huésped y todos sus datos.
            No se puede deshacer. ¿Confirmar?
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAction('none')}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isPending}
              className="bg-red-700 hover:bg-red-800 text-white border-0"
            >
              {isPending ? 'Eliminando...' : 'Confirmar eliminación'}
            </Button>
          </div>
        </div>
      )}

      {action === 'confirm-anonymize' && (
        <div className="flex flex-col gap-3 bg-red-50 border border-red-200 rounded p-4">
          <p className="text-sm text-red-800 font-medium">
            El huésped tiene reservas asociadas. No se puede eliminar para
            conservar el historial. Puede anonimizar sus datos personales (PII)
            de forma irreversible.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAction('none')}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmAnonymize}
              disabled={isPending}
              className="bg-red-700 hover:bg-red-800 text-white border-0"
            >
              {isPending ? 'Anonimizando...' : 'Confirmar anonimización'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function GuestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const guestQuery = useGuest(id ?? null);
  const historyQuery = useGuestHistory(id ?? null);
  const contactEventsQuery = useGuestContactEvents(id ?? '');

  // ── Loading state ──
  if (guestQuery.isLoading || guestQuery.isPending) {
    return <PageSkeleton />;
  }

  // ── Error / 404 state ──
  if (guestQuery.isError || !guestQuery.data) {
    return <NotFoundCard />;
  }

  const guest = guestQuery.data as ExtendedGuestDto;
  const age = ageFromDateOfBirth(guest.dateOfBirth);

  return (
    <div className="min-h-screen bg-bg-base p-6">
      {/* Breadcrumb / back nav */}
      <button type="button"
        onClick={() => navigate('/guests')}
        className="text-ink-3 text-sm hover:text-ink-1 mb-6 flex items-center gap-1 transition-colors"
      >
        ← Volver a Huéspedes
      </button>

      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        {/* ── Section 1: Header ── */}
        <div className="bg-warm-white border border-warm-line rounded-lg p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-ink-1 text-2xl font-semibold">{guest.fullName}</h1>
              <p className="text-ink-2 text-sm mt-1">
                {guest.documentType} {('documentNumber' in guest) ? guest.documentNumber : '—'}
                {' · '}
                {guest.nationality}
                {' · '}
                {formatDisplayDate(guest.dateOfBirth)} ({age} años)
              </p>
            </div>

            {!editing && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(true)}
              >
                Editar
              </Button>
            )}
          </div>

          <div className="mt-4">
            <ContactButtons
              guestId={guest.id}
              fullName={guest.fullName}
              email={guest.email}
              phone={guest.phone}
              whatsappNumber={guest.whatsappNumber}
            />
          </div>
        </div>

        {/* ── Section 2: Info / Edit ── */}
        {editing ? (
          <GuestEditForm
            guest={guest}
            guestId={id!}
            onCancel={() => setEditing(false)}
            onSuccess={() => setEditing(false)}
          />
        ) : (
          <GuestInfoSection guest={guest} />
        )}

        {/* ── Section 3: Reservaciones ── */}
        <ReservationsSection
          guestId={guest.id}
          guest={guest}
          isLoading={historyQuery.isLoading}
          reservations={historyQuery.data?.reservations}
        />

        {/* ── Section 4: Últimos contactos ── */}
        <ContactEventsSection
          events={contactEventsQuery.data ?? []}
          isLoading={contactEventsQuery.isPending}
        />

        {/* ── Section 5: Zona de peligro — ADMIN only ── */}
        {isAdmin && (
          <DeleteOrAnonymizeSection
            guestId={guest.id}
            hasReservations={
              (historyQuery.data?.reservations?.length ?? 0) > 0
            }
            isAnonymized={!!guest.anonymizedAt}
          />
        )}
      </div>
    </div>
  );
}
