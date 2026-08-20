import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { RatePlanDrawer, type RatePlan } from './RatePlanDrawer';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RatePlanRow extends RatePlan {
  extras: Array<{ id: string }>;
}

const TYPE_LABELS: Record<string, string> = {
  BAR: 'BAR',
  PROMO: 'PROMO',
  PACKAGE: 'PACKAGE',
};

const TYPE_COLORS: Record<string, string> = {
  BAR: 'bg-blue-100 text-blue-800',
  PROMO: 'bg-green-100 text-green-800',
  PACKAGE: 'bg-purple-100 text-purple-800',
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * RatePlansPage — manages rate plan catalog.
 *
 * Route: /pricing/rate-plans
 * Access: ADMIN, MANAGER (create/edit/deactivate), RECEPTION (read-only)
 *
 * Seasons are now attached to RoomTypes, not RatePlans.
 * Each plan has a priceModifier (Decimal, default 1.0) that multiplies the
 * room type's base price within the pricing engine.
 */
export function RatePlansPage() {
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<RatePlan | null>(null);

  const { data: ratePlans = [], isLoading } = useQuery<RatePlanRow[]>({
    queryKey: ['rate-plans'],
    queryFn: () =>
      api.get<RatePlanRow[]>('/pricing/rate-plans').then((r) => r.data),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/pricing/rate-plans/${id}/deactivate`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rate-plans'] });
    },
  });

  function openCreate() {
    setSelectedPlan(null);
    setDrawerOpen(true);
  }

  function openEdit(plan: RatePlan) {
    setSelectedPlan(plan);
    setDrawerOpen(true);
  }

  function handleSuccess() {
    void queryClient.invalidateQueries({ queryKey: ['rate-plans'] });
    setDrawerOpen(false);
    setSelectedPlan(null);
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-ink-1 text-2xl font-semibold">
            Planes de tarifa
          </h1>
          <p className="text-ink-3 text-sm mt-1">
            Gestión de tarifas BAR, promocionales y paquetes
          </p>
        </div>
        <Button onClick={openCreate}>Nueva tarifa</Button>
      </div>

      {/* Table */}
      <div className="bg-warm-white rounded-lg border border-warm-line overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-ink-3 text-sm">
            Cargando planes de tarifa...
          </div>
        ) : ratePlans.length === 0 ? (
          <div className="p-8 text-center text-ink-3 text-sm">
            No hay planes de tarifa registrados.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-warm-line bg-warm-cream">
                <th className="text-left px-4 py-3 text-ink-2 font-medium">
                  Nombre
                </th>
                <th className="text-left px-4 py-3 text-ink-2 font-medium">
                  Tipo
                </th>
                <th className="text-left px-4 py-3 text-ink-2 font-medium">
                  Modificador
                </th>
                <th className="text-left px-4 py-3 text-ink-2 font-medium">
                  Extras
                </th>
                <th className="text-left px-4 py-3 text-ink-2 font-medium">
                  Estado
                </th>
                <th className="text-right px-4 py-3 text-ink-2 font-medium">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {ratePlans.map((plan) => (
                <tr
                  key={plan.id}
                  className="border-b border-warm-line hover:bg-warm-cream/50 cursor-pointer transition-colors"
                  onClick={() => openEdit(plan)}
                >
                  <td className="px-4 py-3 text-ink-1 font-medium">
                    {plan.name}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        TYPE_COLORS[plan.type] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {TYPE_LABELS[plan.type] ?? plan.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-1" data-testid={`modifier-${plan.id}`}>
                    ×{Number(plan.priceModifier).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-ink-3">
                    {plan.extras.length === 0 ? (
                      <span className="text-ink-3/50">—</span>
                    ) : (
                      <span>
                        {plan.extras.length}{' '}
                        {plan.extras.length === 1 ? 'extra' : 'extras'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        plan.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {plan.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td
                    className="px-4 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-2">
                      <button type="button"
                        onClick={() => openEdit(plan)}
                        className="text-xs text-brand-primary hover:underline"
                      >
                        Editar
                      </button>
                      {plan.isActive && (
                        <button type="button"
                          onClick={() => deactivateMutation.mutate(plan.id)}
                          disabled={deactivateMutation.isPending}
                          className="text-xs text-status-in-progress hover:underline disabled:opacity-50"
                        >
                          Desactivar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Drawer */}
      <RatePlanDrawer
        isOpen={drawerOpen}
        ratePlan={selectedPlan}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedPlan(null);
        }}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
