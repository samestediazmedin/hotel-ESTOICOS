import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/features/auth/auth.store';
import { useGuests } from './guests.api';
import type { AnyGuestDto, GuestResponseDto } from './guests.api';
import { GuestDrawer } from './GuestDrawer';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasDocumentNumber(guest: AnyGuestDto): guest is GuestResponseDto {
  return 'documentNumber' in guest;
}

/** Format last contact event as relative Spanish time, or "Nunca" if null. */
function formatLastContact(
  event: { createdAt: string } | null | undefined,
): string {
  if (!event) return 'Nunca';
  try {
    return formatDistanceToNow(new Date(event.createdAt), {
      locale: es,
      addSuffix: true,
    });
  } catch {
    return '—';
  }
}

/** Show last 4 of document or "—" for housekeeping / anonymized */
function maskedDocument(guest: AnyGuestDto): string {
  if (!hasDocumentNumber(guest)) return '—';
  if (guest.anonymizedAt) return '—';
  const doc = guest.documentNumber;
  if (doc.length <= 4) return doc;
  return `${guest.documentType} ···${doc.slice(-4)}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function GuestsPage() {
  const user = useAuthStore((s) => s.user);
  const isHousekeeping = user?.role === 'HOUSEKEEPING';
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  };

  // Drawer is reserved for "Nuevo huésped" creation flow only.
  // Row clicks navigate to /guests/:id (detail page).
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<AnyGuestDto | null>(null);

  const { data: guests = [], isLoading, isError } = useGuests(debouncedSearch || undefined);

  /** Navigate to guest detail page — does NOT open drawer. */
  const handleRowClick = (guest: AnyGuestDto) => {
    navigate(`/guests/${guest.id}`);
  };

  const handleNewGuest = () => {
    setSelectedGuest(null);
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setSelectedGuest(null);
  };

  return (
    <div className="min-h-screen bg-bg-base p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-ink-1 text-2xl font-semibold">Huéspedes</h1>
          <p className="text-ink-3 text-sm mt-1">
            Gestión de huéspedes registrados
          </p>
        </div>

        {/* HOUSEKEEPING cannot create guests */}
        {!isHousekeeping && (
          <Button onClick={handleNewGuest}>Nuevo huésped</Button>
        )}
      </div>

      {/* Search */}
      <div className="mb-4">
        <Input
          type="search"
          placeholder="Buscar por nombre..."
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {/* Table */}
      <div className="bg-warm-white border border-warm-line rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-warm-line bg-warm-cream">
              <th className="text-left px-4 py-3 text-ink-2 font-medium">
                Nombre
              </th>
              <th className="text-left px-4 py-3 text-ink-2 font-medium">
                Documento
              </th>
              <th className="text-left px-4 py-3 text-ink-2 font-medium">
                Nacionalidad
              </th>
              <th className="text-left px-4 py-3 text-ink-2 font-medium">
                Email
              </th>
              <th className="text-left px-4 py-3 text-ink-2 font-medium">
                Teléfono
              </th>
              <th className="text-left px-4 py-3 text-ink-2 font-medium">
                Último contacto
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-3">
                  Cargando huéspedes...
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-terracotta-deep">
                  Error cargando huéspedes. Intente de nuevo.
                </td>
              </tr>
            )}
            {!isLoading && !isError && guests.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-3">
                  No se encontraron huéspedes.
                </td>
              </tr>
            )}
            {guests.map((guest) => (
              <tr
                key={guest.id}
                onClick={() => handleRowClick(guest)}
                className={`border-b border-warm-line last:border-0 cursor-pointer hover:bg-warm-cream transition-colors ${
                  guest.anonymizedAt ? 'opacity-60' : ''
                }`}
              >
                <td className="px-4 py-3 text-ink-1">
                  <div className="flex items-center gap-2">
                    {guest.fullName}
                    {guest.anonymizedAt && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-terracotta/10 text-terracotta">
                        Anonimizado
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-2">
                  {maskedDocument(guest)}
                </td>
                <td className="px-4 py-3 text-ink-2">
                  {guest.nationality}
                </td>
                <td className="px-4 py-3 text-ink-2">
                  {guest.email ?? '—'}
                </td>
                <td className="px-4 py-3 text-ink-2">
                  {guest.phone ?? '—'}
                </td>
                <td className="px-4 py-3 text-ink-2">
                  {formatLastContact(guest.lastContactEvent)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drawer */}
      <GuestDrawer
        isOpen={drawerOpen}
        guest={selectedGuest}
        onClose={handleDrawerClose}
        onSuccess={handleDrawerClose}
      />
    </div>
  );
}
