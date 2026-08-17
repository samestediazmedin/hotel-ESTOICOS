import { api } from '@/lib/api';

export interface NightAuditResult {
  skipped: boolean;
  businessDate: string;
  openFoliosProcessed?: number;
  chargesPosted?: number;
  noShowsMarked?: number;
}

/**
 * runBackfill — POST /api/night-audit/backfill?date=YYYY-MM-DD
 * Triggers night audit for a specific past business date.
 * Idempotent: returns { skipped: true } if already completed for that date.
 */
export async function runBackfill(businessDate: string): Promise<NightAuditResult> {
  const { data } = await api.post<NightAuditResult>(
    `/night-audit/backfill?date=${businessDate}`,
  );
  return data;
}

/**
 * runNow — POST /api/night-audit/run-now
 * Triggers night audit for the current hotel_business_date.
 * ADMIN role only.
 */
export async function runNow(): Promise<NightAuditResult> {
  const { data } = await api.post<NightAuditResult>('/night-audit/run-now');
  return data;
}
