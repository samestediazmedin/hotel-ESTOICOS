import { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { Button } from '@/components/ui/button';
import { toLocalISODate } from '@/lib/date';
import { downloadTraCsv } from './tra-export.api';

/**
 * TraExportPage — TRA Colombia compliance export page.
 *
 * Accessible at /admin/tra-export — ADMIN and MANAGER roles only.
 * RBAC is enforced server-side via @Roles('ADMIN', 'MANAGER') on the controller.
 * Client-side: nav link visibility is gated by role in DashboardPlaceholder.
 *
 * LOW CONFIDENCE NOTE:
 * The CSV format (semicolon delimiter, UTF-8 BOM, DD/MM/YYYY dates, Spanish headers)
 * is a best-effort approximation. The hotel owner must verify the exact format with
 * COTELCO or the local alcaldía before first production export.
 *
 * Workflow:
 * 1. Select date range with react-day-picker v10 range mode
 * 2. Click "Descargar CSV" — triggers GET /api/tra-export?from=...&to=...
 * 3. Browser downloads TRA_<from>_<to>.csv
 * 4. Upload manually to COTELCO/SITUR portal (no API submission in v1)
 *
 * DATE HANDLING:
 * Uses toLocalISODate() (not toISOString().slice(0,10)) to prevent the UTC-5
 * Bogotá off-by-one error for user-selected dates (D-15).
 */
export function TraExportPage() {
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canExport = Boolean(range?.from && range?.to);

  async function handleExport() {
    if (!range?.from || !range?.to) return;

    setIsLoading(true);
    setError(null);

    try {
      const from = toLocalISODate(range.from);
      const to = toLocalISODate(range.to);
      await downloadTraCsv(from, to);
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response &&
        typeof err.response === 'object' &&
        'data' in err.response &&
        err.response.data &&
        typeof err.response.data === 'object' &&
        'message' in err.response.data
          ? String((err.response.data as { message: unknown }).message)
          : 'Error al generar el export. Intente nuevamente.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-base p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-ink-1 text-2xl font-medium mb-2">
          Export TRA Colombia
        </h1>

        <p className="text-ink-3 text-sm mb-6">
          Genera el archivo CSV con los huéspedes de estadías completadas en el rango
          seleccionado, para presentación ante la autoridad de turismo (COTELCO /
          alcaldía local).
        </p>

        <div className="bg-warm-white border border-warm-line rounded-lg p-6 mb-6">
          <h2 className="text-ink-2 text-sm font-medium mb-4">
            Selecciona el rango de fechas
          </h2>

          <DayPicker
            mode="range"
            selected={range}
            onSelect={setRange}
            numberOfMonths={2}
          />
        </div>

        {range?.from && range?.to && (
          <p className="text-ink-2 text-sm mb-4">
            Rango seleccionado:{' '}
            <span className="font-medium text-ink-1">
              {toLocalISODate(range.from)}
            </span>{' '}
            →{' '}
            <span className="font-medium text-ink-1">
              {toLocalISODate(range.to)}
            </span>
          </p>
        )}

        {error && (
          <p className="text-red-600 text-sm mb-4" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button
            onClick={handleExport}
            disabled={!canExport || isLoading}
          >
            {isLoading ? 'Generando...' : 'Descargar CSV'}
          </Button>

          {range && (
            <Button
              variant="outline"
              onClick={() => setRange(undefined)}
              disabled={isLoading}
            >
              Limpiar selección
            </Button>
          )}
        </div>

        <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-amber-800 text-xs font-medium mb-1">
            Nota de confianza — formato LOW CONFIDENCE
          </p>
          <p className="text-amber-700 text-xs">
            El formato del CSV (delimitador punto y coma, codificación UTF-8 BOM, fechas
            DD/MM/YYYY) es una aproximación. El propietario del hotel debe verificar el
            formato exacto con COTELCO o la alcaldía local antes del primer export en
            producción.
          </p>
        </div>
      </div>
    </div>
  );
}
