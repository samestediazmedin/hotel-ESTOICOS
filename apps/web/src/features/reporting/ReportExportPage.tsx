import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Download, BarChart3, Loader2 } from 'lucide-react';
import { reportingApi } from './reporting.api';
import { formatCOP, formatPct } from './lib/format-cop';
import { toLocalISODate } from '@/lib/date';
import type { OperationsReportDto } from './reporting.api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build default date range: today - 6 days to today (7-day window). */
function defaultRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  return {
    startDate: toLocalISODate(start),
    endDate: toLocalISODate(end),
  };
}

/** Format YYYY-MM-DD for display as DD/MM/YYYY. */
function fmtDisplayDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ─── KPI summary card ─────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: string;
}

function SummaryCard({ label, value }: SummaryCardProps) {
  return (
    <div className="bg-warm-white border border-warm-line rounded-lg p-4">
      <p className="text-xs text-ink-3 mb-1">{label}</p>
      <p className="text-xl font-bold text-ink-1">{value}</p>
    </div>
  );
}

// ─── ReportExportPage ─────────────────────────────────────────────────────────

/**
 * ReportExportPage — date-range report with CSV/PDF download.
 *
 * Route: /reportes (ADMIN/MANAGER only — server enforces RBAC on export endpoints).
 *
 * Features:
 *  - react-day-picker-style date inputs (HTML date inputs with toLocalISODate)
 *  - "Generar resumen" → GET /api/reports/operations → KPI summary + daily table
 *  - "Descargar CSV" → Blob download, no token in URL
 *  - "Descargar PDF" → Blob download; surfaces 400 Spanish error if range > 31 days
 *  - Empty state: "No hay datos para este rango" (no crash when daysCount=0)
 */
export function ReportExportPage() {
  // ── Date range state ──────────────────────────────────────────────────────
  const defaults = defaultRange();
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [dateError, setDateError] = useState<string | null>(null);

  // ── Fetch trigger ─────────────────────────────────────────────────────────
  const [queryKey, setQueryKey] = useState<[string, string, string] | null>(null);

  const {
    data: report,
    isFetching,
    error: fetchError,
  } = useQuery<OperationsReportDto>({
    queryKey: ['reports', 'operations', ...(queryKey ?? ['', ''])],
    queryFn: () => reportingApi.getOperationsReport(queryKey![1], queryKey![2]),
    enabled: queryKey !== null,
    retry: false,
    staleTime: 0,
  });

  // ── Download state ────────────────────────────────────────────────────────
  const [csvLoading, setCsvLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function validate(): boolean {
    if (startDate > endDate) {
      setDateError('La fecha de inicio no puede ser posterior a la fecha de fin.');
      return false;
    }
    setDateError(null);
    return true;
  }

  function handleGenerate() {
    if (!validate()) return;
    setQueryKey(['reports', startDate, endDate]);
    setDownloadError(null);
  }

  async function handleDownloadCsv() {
    if (!validate()) return;
    setDownloadError(null);
    setCsvLoading(true);
    try {
      await reportingApi.downloadCsv(startDate, endDate);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message ?? 'Error al descargar CSV.';
      setDownloadError(Array.isArray(msg) ? msg.join(' ') : msg);
    } finally {
      setCsvLoading(false);
    }
  }

  async function handleDownloadPdf() {
    if (!validate()) return;
    setDownloadError(null);
    setPdfLoading(true);
    try {
      await reportingApi.downloadPdf(startDate, endDate);
    } catch (err: unknown) {
      // Surface the Spanish 400 message from the backend (31-day cap)
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message ?? 'Error al generar PDF.';
      setDownloadError(Array.isArray(msg) ? msg.join(' ') : msg);
    } finally {
      setPdfLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-brand" />
        <div>
          <h1 className="text-2xl font-bold text-ink-1">Reportes</h1>
          <p className="text-sm text-ink-3">
            Reporte operacional por rango de fechas
          </p>
        </div>
      </div>

      {/* ── Date range form ──────────────────────────────────────────────── */}
      <div className="bg-warm-white border border-warm-line rounded-lg p-5">
        <h2 className="text-sm font-semibold text-ink-2 mb-4 uppercase tracking-wide">
          Seleccionar rango
        </h2>

        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="startDate" className="text-xs text-ink-3">
              Fecha inicio
            </label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-warm-line rounded-md px-3 py-2 text-sm bg-bg-base text-ink-1 focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="endDate" className="text-xs text-ink-3">
              Fecha fin
            </label>
            <input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-warm-line rounded-md px-3 py-2 text-sm bg-bg-base text-ink-1 focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>

          {/* Action buttons */}
          <button
            onClick={handleGenerate}
            disabled={isFetching}
            className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-md text-sm font-medium hover:bg-brand/90 disabled:opacity-50 transition-colors"
          >
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BarChart3 className="h-4 w-4" />
            )}
            Generar resumen
          </button>

          <button
            onClick={handleDownloadCsv}
            disabled={csvLoading}
            className="flex items-center gap-2 px-4 py-2 border border-warm-line rounded-md text-sm font-medium text-ink-2 hover:bg-warm-white-hover disabled:opacity-50 transition-colors"
          >
            {csvLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Descargar CSV
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
            className="flex items-center gap-2 px-4 py-2 border border-warm-line rounded-md text-sm font-medium text-ink-2 hover:bg-warm-white-hover disabled:opacity-50 transition-colors"
          >
            {pdfLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Descargar PDF
          </button>
        </div>

        {/* Inline validation error */}
        {dateError && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {dateError}
          </p>
        )}

        {/* Download error (e.g. 31-day cap from backend) */}
        {downloadError && (
          <div
            className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700"
            role="alert"
          >
            {downloadError}
          </div>
        )}

        {/* Fetch error */}
        {fetchError && (
          <div
            className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700"
            role="alert"
          >
            Error al cargar el reporte. Intente de nuevo.
          </div>
        )}
      </div>

      {/* ── Report results ───────────────────────────────────────────────── */}
      {report && (
        <div className="space-y-6">

          {/* Period label */}
          <p className="text-sm text-ink-3">
            Periodo:{' '}
            <span className="font-medium text-ink-1">
              {fmtDisplayDate(report.range.startDate)} al{' '}
              {fmtDisplayDate(report.range.endDate)}
            </span>
            {' · '}
            <span className="text-ink-3">
              {report.totals.daysCount} día{report.totals.daysCount !== 1 ? 's' : ''} con datos
            </span>
          </p>

          {report.totals.daysCount === 0 ? (
            /* Empty state */
            <div className="bg-warm-white border border-warm-line rounded-lg p-12 text-center">
              <BarChart3 className="h-10 w-10 text-ink-3 mx-auto mb-3" />
              <p className="text-ink-3">No hay datos para este rango</p>
              <p className="text-xs text-ink-3 mt-1">
                Verifica que el night audit haya corrido para las fechas seleccionadas.
              </p>
            </div>
          ) : (
            <>
              {/* KPI summary cards */}
              <div>
                <h2 className="text-sm font-semibold text-ink-2 mb-3 uppercase tracking-wide">
                  Resumen del periodo
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <SummaryCard
                    label="Ingreso total"
                    value={formatCOP(report.totals.totalRevenue)}
                  />
                  <SummaryCard
                    label="Ocupación prom."
                    value={formatPct(report.totals.avgOccupancyPct)}
                  />
                  <SummaryCard
                    label="ADR promedio"
                    value={formatCOP(report.totals.avgAdr)}
                  />
                  <SummaryCard
                    label="RevPAR promedio"
                    value={formatCOP(report.totals.avgRevpar)}
                  />
                  <SummaryCard
                    label="Total llegadas"
                    value={String(report.totals.totalArrivals)}
                  />
                  <SummaryCard
                    label="Total salidas"
                    value={String(report.totals.totalDepartures)}
                  />
                </div>
              </div>

              {/* Daily breakdown table */}
              <div>
                <h2 className="text-sm font-semibold text-ink-2 mb-3 uppercase tracking-wide">
                  Detalle diario
                </h2>
                <div className="overflow-x-auto border border-warm-line rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-warm-white-hover text-ink-3">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold">Fecha</th>
                        <th className="text-right px-4 py-3 font-semibold">Ocupación</th>
                        <th className="text-right px-4 py-3 font-semibold">ADR</th>
                        <th className="text-right px-4 py-3 font-semibold">RevPAR</th>
                        <th className="text-right px-4 py-3 font-semibold">Llegadas</th>
                        <th className="text-right px-4 py-3 font-semibold">Salidas</th>
                        <th className="text-right px-4 py-3 font-semibold">Ingresos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.daily.map((row, idx) => (
                        <tr
                          key={row.businessDate}
                          className={idx % 2 === 0 ? 'bg-bg-base' : 'bg-warm-white'}
                        >
                          <td className="px-4 py-2 text-ink-1">
                            {fmtDisplayDate(row.businessDate)}
                          </td>
                          <td className="px-4 py-2 text-right text-ink-2">
                            {formatPct(row.occupancyPct)}
                          </td>
                          <td className="px-4 py-2 text-right text-ink-2">
                            {formatCOP(row.adr)}
                          </td>
                          <td className="px-4 py-2 text-right text-ink-2">
                            {formatCOP(row.revpar)}
                          </td>
                          <td className="px-4 py-2 text-right text-ink-2">
                            {row.arrivalsCount}
                          </td>
                          <td className="px-4 py-2 text-right text-ink-2">
                            {row.departuresCount}
                          </td>
                          <td className="px-4 py-2 text-right font-medium text-ink-1">
                            {formatCOP(row.totalRevenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
