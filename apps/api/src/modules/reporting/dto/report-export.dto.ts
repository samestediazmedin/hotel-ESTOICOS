import { z } from 'zod';

/**
 * ReportExportSchema — Zod v4 schema for date-range report export params.
 *
 * Both dates must be YYYY-MM-DD strings.
 * startDate must be <= endDate (chronological order).
 *
 * Uses Zod v4 .issues convention (NOT .errors).
 */
export const ReportExportSchema = z
  .object({
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD'),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD'),
  })
  .refine((d) => d.startDate <= d.endDate, {
    message: 'startDate must be <= endDate',
  });

export type ReportExportDto = z.infer<typeof ReportExportSchema>;

/**
 * PdfReportSchema — extends ReportExportSchema with a 31-day cap.
 *
 * PDF export is memory-intensive (yoga-wasm PDF layout engine).
 * Ranges > 31 days return HTTP 400 with a Spanish user-facing message.
 * CSV export uses ReportExportSchema only (no cap — line-based, low memory).
 */
export const PdfReportSchema = ReportExportSchema.refine(
  (d) => {
    const diffMs = Date.parse(d.endDate) - Date.parse(d.startDate);
    return diffMs / 86_400_000 <= 30; // max 31 days inclusive (diff <= 30)
  },
  {
    message:
      'El reporte PDF está limitado a 31 días. Use formato CSV para rangos mayores.',
  },
);
