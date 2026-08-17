import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@/lib/zod-resolver';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/features/auth/auth.store';
import { toLocalISODate } from '@/lib/date';
import { runBackfill, runNow } from '@/features/operations/night-audit.api';
import type { NightAuditResult } from '@/features/operations/night-audit.api';

// ─── Schema ──────────────────────────────────────────────────────────────────

/**
 * BackfillFormSchema — Zod v4 for the date input on NightAuditPage.
 * YYYY-MM-DD format required (same as BackfillDto on the backend).
 */
const BackfillFormSchema = z.object({
  businessDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato requerido: YYYY-MM-DD'),
});

type BackfillFormData = z.infer<typeof BackfillFormSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * NightAuditPage — admin interface for manual night audit control.
 *
 * Route: /admin/night-audit
 * Protected: ADMIN and MANAGER roles only.
 *
 * Features:
 *  - Date picker for backfill (ADMIN or MANAGER can trigger)
 *  - "Ejecutar para hoy" button (ADMIN only — bypasses date picker)
 *  - Result panel showing audit response JSON
 *  - Both mutations are idempotent: running twice for same date returns { skipped: true }
 */
export function NightAuditPage() {
  const user = useAuthStore((s) => s.user);
  const [lastResult, setLastResult] = useState<NightAuditResult | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BackfillFormData>({
    resolver: zodResolver(BackfillFormSchema),
    defaultValues: {
      businessDate: toLocalISODate(new Date()),
    },
  });

  // Backfill mutation — available to ADMIN and MANAGER
  const backfillMutation = useMutation({
    mutationFn: (data: BackfillFormData) => runBackfill(data.businessDate),
    onSuccess: (result) => setLastResult(result),
  });

  // Run-now mutation — ADMIN only
  const runNowMutation = useMutation({
    mutationFn: runNow,
    onSuccess: (result) => setLastResult(result),
  });

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-ink-1 text-2xl font-semibold">Night Audit</h1>
        <p className="text-ink-3 text-sm mt-1">
          Control manual del ciclo de auditoría nocturna. El cron corre automáticamente a las 03:00 hora Bogotá.
        </p>
      </div>

      {/* Backfill form */}
      <div className="bg-warm-white border border-warm-line rounded-xl p-5 space-y-4">
        <h2 className="text-ink-1 text-sm font-semibold">Ejecutar backfill por fecha</h2>
        <p className="text-ink-3 text-xs">
          Ejecuta la auditoría para una fecha de negocio específica. Idempotente: si ya se ejecutó, retorna{' '}
          <code className="text-ink-2">skipped: true</code>.
        </p>

        <form
          onSubmit={handleSubmit((data) => backfillMutation.mutate(data))}
          className="flex gap-3 items-start"
        >
          <div className="flex flex-col gap-1 flex-1">
            <Input
              type="date"
              {...register('businessDate')}
              aria-label="Fecha de negocio (YYYY-MM-DD)"
            />
            {errors.businessDate && (
              <p className="text-xs text-red-600">{errors.businessDate.message}</p>
            )}
          </div>
          <Button
            type="submit"
            disabled={backfillMutation.isPending}
          >
            {backfillMutation.isPending ? 'Ejecutando...' : 'Ejecutar backfill'}
          </Button>
        </form>

        {backfillMutation.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-red-600 text-sm">
              {(backfillMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                'Error al ejecutar la auditoría.'}
            </p>
          </div>
        )}
      </div>

      {/* Run now — ADMIN only */}
      {isAdmin && (
        <div className="bg-warm-white border border-warm-line rounded-xl p-5 space-y-3">
          <h2 className="text-ink-1 text-sm font-semibold">Ejecutar para hoy</h2>
          <p className="text-ink-3 text-xs">
            Ejecuta la auditoría para la fecha de negocio actual del hotel.
          </p>
          <Button
            type="button"
            variant="secondary"
            disabled={runNowMutation.isPending}
            onClick={() => runNowMutation.mutate()}
          >
            {runNowMutation.isPending ? 'Ejecutando...' : 'Ejecutar para hoy'}
          </Button>

          {runNowMutation.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-red-600 text-sm">
                {(runNowMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                  'Error al ejecutar la auditoría.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Result panel */}
      {lastResult && (
        <div className="bg-warm-white border border-warm-line rounded-xl p-5 space-y-2">
          <h2 className="text-ink-1 text-sm font-semibold">
            Resultado
            {lastResult.skipped && (
              <span className="ml-2 text-xs font-normal text-amber-700 bg-amber-100 rounded px-2 py-0.5">
                omitido (ya ejecutado)
              </span>
            )}
          </h2>
          <pre className="text-xs text-ink-2 bg-warm-cream rounded p-3 overflow-x-auto">
            {JSON.stringify(lastResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
