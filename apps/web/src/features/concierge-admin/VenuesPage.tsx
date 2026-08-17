import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Upload, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { VenueDrawer } from './VenueDrawer';
import { listVenues, importCsv } from './concierge-admin.api';
import type { Venue } from './concierge-admin.api';
import type { VenueType } from '@/features/concierge/types';

// ─── Type labels ──────────────────────────────────────────────────────────────

const VENUE_TYPE_LABELS: Record<VenueType, string> = {
  RESTAURANT: 'Restaurante',
  BAR: 'Bar',
  CAFE: 'Café',
  MUSEUM: 'Museo',
  PARK: 'Parque',
  SHOPPING: 'Compras',
  NIGHTLIFE: 'Vida nocturna',
  TRANSPORT_HUB: 'Transporte',
  EVENT_VENUE: 'Evento',
  OTHER: 'Otro',
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * VenuesPage — ADMIN-only catalog screen for managing Bogotá venues.
 *
 * CON-09: Accessible at /admin/concierge/venues inside StaffLayout.
 * RBAC: Server returns 403 for non-ADMIN. Nav link hidden client-side too (Sidebar.tsx).
 */
export function VenuesPage() {
  const [showInactive, setShowInactive] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // ─── Data fetching ────────────────────────────────────────────────────────

  const { data: venues = [], refetch } = useQuery<Venue[]>({
    queryKey: ['concierge', 'venues', showInactive],
    queryFn: () => listVenues(showInactive),
  });

  // ─── Drawer handlers ──────────────────────────────────────────────────────

  const openCreate = () => {
    setSelectedVenue(null);
    setDrawerOpen(true);
  };

  const openEdit = (venue: Venue) => {
    setSelectedVenue(venue);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedVenue(null);
  };

  const handleSuccess = () => {
    closeDrawer();
    void refetch();
  };

  // ─── CSV import ───────────────────────────────────────────────────────────

  const handleCsvChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus('Importando...');
    try {
      const result = await importCsv(file);
      setImportStatus(
        `Importado: ${result.inserted} insertados, ${result.skipped} omitidos, ${result.errors} errores`,
      );
      void refetch();
    } catch {
      setImportStatus('Error al importar CSV');
    } finally {
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink-1">Catálogo Concierge</h1>
          <p className="text-sm text-ink-3 mt-0.5">
            Lugares de Bogotá recomendados por el concierge IA
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Import CSV */}
          <Button
            type="button"
            variant="secondary"
            onClick={() => csvInputRef.current?.click()}
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Importar CSV
          </Button>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            onChange={handleCsvChange}
            className="sr-only"
          />

          {/* Create */}
          <Button type="button" onClick={openCreate} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Crear lugar
          </Button>
        </div>
      </div>

      {/* Import status */}
      {importStatus && (
        <div className="rounded-lg border border-warm-line bg-warm-white px-4 py-2 text-sm text-ink-2">
          {importStatus}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Mostrar inactivos
        </label>
        <span className="text-sm text-ink-3">{venues.length} lugares</span>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-warm-line overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Foto</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="hidden md:table-cell">Calif.</TableHead>
              <TableHead className="hidden lg:table-cell">Dirección</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {venues.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-ink-3 text-sm">
                  No hay lugares aún. Crea el primero o importa un CSV.
                </TableCell>
              </TableRow>
            ) : (
              venues.map((venue) => (
                <TableRow
                  key={venue.id}
                  className="cursor-pointer hover:bg-warm-white-hover"
                  onClick={() => openEdit(venue)}
                >
                  {/* Thumbnail */}
                  <TableCell>
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                      {venue.photoUrl ? (
                        <img
                          src={`${(import.meta.env.VITE_R2_PUBLIC_URL as string) ?? ''}/${venue.photoUrl}`}
                          alt={venue.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <MapPin className="w-4 h-4 text-gray-400" aria-hidden />
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="font-medium text-ink-1 text-sm">{venue.name}</span>
                  </TableCell>

                  <TableCell>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {VENUE_TYPE_LABELS[venue.type] ?? venue.type}
                    </span>
                  </TableCell>

                  <TableCell className="hidden md:table-cell text-sm text-ink-2">
                    {venue.rating !== null ? venue.rating.toFixed(1) : '—'}
                  </TableCell>

                  <TableCell className="hidden lg:table-cell text-sm text-ink-3 max-w-[200px] truncate">
                    {venue.address ?? '—'}
                  </TableCell>

                  <TableCell>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        venue.isActive
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {venue.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Venue drawer */}
      <VenueDrawer
        isOpen={drawerOpen}
        venue={selectedVenue}
        onClose={closeDrawer}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
