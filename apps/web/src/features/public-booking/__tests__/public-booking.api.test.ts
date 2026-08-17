/**
 * public-booking.api — useRateOptions hook
 *
 * Tests use MSW to intercept the /api/public/rate-options request. No real
 * HTTP calls are made. The TanStack Query wrapper is exercised via
 * renderHook from @testing-library/react.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { server } from '../../../test/msw-server';
import { useRateOptions, type RatePlanOption } from '../public-booking.api';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_RATE: RatePlanOption = {
  ratePlanId: null,
  ratePlanName: 'Tarifa Base',
  ratePlanType: 'BASE',
  description: null,
  breakdown: {
    roomTypeId: 'rt-1',
    ratePlanId: null,
    nights: 2,
    items: [
      {
        date: '2026-06-10',
        base: 200000,
        multiplier: 1,
        nightRate: 200000,
        ivaRate: 0.19,
        ivaAmount: 38000,
        lineTotal: 238000,
        seasonName: null,
      },
      {
        date: '2026-06-11',
        base: 200000,
        multiplier: 1,
        nightRate: 200000,
        ivaRate: 0.19,
        ivaAmount: 38000,
        lineTotal: 238000,
        seasonName: null,
      },
    ],
    subtotal: 400000,
    totalIva: 76000,
    roomTotal: 476000,
    extras: [],
    extrasSubtotal: 0,
    extrasIva: 0,
    extrasTotal: 0,
    total: 476000,
    currency: 'COP',
    appliedRatePlan: 'BASE',
  },
};

const PACKAGE_RATE: RatePlanOption = {
  ratePlanId: 'rp-pkg-001',
  ratePlanName: 'Luna de Miel',
  ratePlanType: 'PACKAGE',
  description: 'Incluye desayuno buffet y botella de vino',
  breakdown: {
    ...BASE_RATE.breakdown,
    ratePlanId: 'rp-pkg-001',
    extras: [
      {
        name: 'Desayuno buffet',
        pricingMode: 'PER_PERSON_PER_NIGHT',
        unitAmount: 35000,
        quantity: 4,
        subtotal: 140000,
        ivaAmount: 0,
        total: 140000,
      },
      {
        name: 'Botella de vino',
        pricingMode: 'PER_STAY',
        unitAmount: 80000,
        quantity: 1,
        subtotal: 80000,
        ivaAmount: 0,
        total: 80000,
      },
    ],
    extrasSubtotal: 220000,
    extrasIva: 0,
    extrasTotal: 220000,
    total: 696000,
    appliedRatePlan: 'Luna de Miel',
  },
};

// ─── Wrapper ──────────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useRateOptions', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/public/rate-options', () =>
        HttpResponse.json([BASE_RATE, PACKAGE_RATE]),
      ),
    );
  });

  it('returns rate options when all params are present', async () => {
    const { result } = renderHook(
      () =>
        useRateOptions({
          roomTypeId: 'rt-1',
          checkIn: '2026-06-10',
          checkOut: '2026-06-12',
          adults: 2,
        }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].ratePlanName).toBe('Tarifa Base');
    expect(result.current.data![1].ratePlanName).toBe('Luna de Miel');
  });

  it('is idle (not fetched) when params are null', () => {
    const { result } = renderHook(() => useRateOptions(null), {
      wrapper: makeWrapper(),
    });
    // enabled=false → query never fires, status stays 'pending' with fetchStatus 'idle'
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  it('returns extras on PACKAGE rate option', async () => {
    const { result } = renderHook(
      () =>
        useRateOptions({
          roomTypeId: 'rt-1',
          checkIn: '2026-06-10',
          checkOut: '2026-06-12',
          adults: 2,
        }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const pkg = result.current.data!.find((o) => o.ratePlanType === 'PACKAGE');
    expect(pkg).toBeDefined();
    expect(pkg!.breakdown.extras).toHaveLength(2);
    expect(pkg!.breakdown.extras[0].name).toBe('Desayuno buffet');
  });

  it('exposes minNightsViolation when present', async () => {
    const violatingRate: RatePlanOption = {
      ...BASE_RATE,
      ratePlanId: 'rp-min3',
      ratePlanName: 'Tarifa Fin de Semana',
      ratePlanType: 'BAR',
      breakdown: {
        ...BASE_RATE.breakdown,
        minNightsViolation: { required: 3, actual: 2, seasonName: 'Temporada Alta' },
      },
    };
    server.use(
      http.get('/api/public/rate-options', () =>
        HttpResponse.json([violatingRate]),
      ),
    );

    const { result } = renderHook(
      () =>
        useRateOptions({
          roomTypeId: 'rt-1',
          checkIn: '2026-06-10',
          checkOut: '2026-06-12',
          adults: 2,
        }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const opt = result.current.data![0];
    expect(opt.breakdown.minNightsViolation?.required).toBe(3);
  });
});
