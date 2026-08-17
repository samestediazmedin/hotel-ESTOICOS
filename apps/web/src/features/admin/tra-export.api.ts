import { api } from '@/lib/api';

/**
 * downloadTraCsv — requests the TRA Colombia CSV export and triggers a browser download.
 *
 * Sends a GET to /api/tra-export with from/to date parameters.
 * The server returns text/csv; charset=utf-8 with Content-Disposition: attachment.
 *
 * The blob is wrapped in a temporary object URL and auto-clicked to trigger download.
 * The URL is revoked immediately after to free memory.
 *
 * @param from  Start date in YYYY-MM-DD format (local calendar date via toLocalISODate)
 * @param to    End date in YYYY-MM-DD format (local calendar date via toLocalISODate)
 */
export async function downloadTraCsv(from: string, to: string): Promise<void> {
  const res = await api.get('/tra-export', {
    params: { from, to },
    responseType: 'blob',
  });

  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TRA_${from}_${to}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
