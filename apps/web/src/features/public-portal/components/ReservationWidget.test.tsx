import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReservationWidget } from './ReservationWidget';
import type { HotelInfo } from '../types';
import type { RoomTypeCard } from '../types';
import { useReservationUiStore } from '../stores/reservationUiStore';

// ─── Module mocks ────────────────────────────────────────────────────────────

vi.mock('../hooks/useHotelInfo');
vi.mock('../hooks/useRoomTypes');

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
const { useHotelInfo } = await import('../hooks/useHotelInfo') as {
  useHotelInfo: ReturnType<typeof vi.fn>;
};
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
const { useRoomTypes } = await import('../hooks/useRoomTypes') as {
  useRoomTypes: ReturnType<typeof vi.fn>;
};

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ROOMS: RoomTypeCard[] = [
  {
    id: 'rt-1',
    name: 'Doble',
    capacity: 2,
    description: 'Cómoda.',
    basePrice: 290_000,
    photos: [],
    badge: null,
  },
];

const HOTEL_INFO_IVA_ON: HotelInfo = {
  hotelName: 'Hotel Test',
  hotelAddress: 'Bogotá',
  tagline: '',
  description: '',
  rating: 4.8,
  reviewCount: 10,
  tags: [],
  displayPricesWithIva: true,
  ivaRate: 0.19,
};

const HOTEL_INFO_IVA_OFF: HotelInfo = {
  ...HOTEL_INFO_IVA_ON,
  displayPricesWithIva: false,
};

function renderWidget(variant: 'desktop-sidebar' | 'mobile-bar' = 'desktop-sidebar') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ReservationWidget variant={variant} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReservationWidget — IVA price display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRoomTypes.mockReturnValue({ data: ROOMS });
    useReservationUiStore.setState({ datePickerRequestedAt: null });
  });

  it('shows IVA-included "Desde $345k" when displayPricesWithIva is true', () => {
    useHotelInfo.mockReturnValue({ data: HOTEL_INFO_IVA_ON });
    renderWidget();
    // 290000 * 1.19 = 345100 → "$345k"
    expect(screen.getByText('Desde $345k')).toBeInTheDocument();
  });

  it('shows "IVA incluido" hint in desktop sidebar when flag is on', () => {
    useHotelInfo.mockReturnValue({ data: HOTEL_INFO_IVA_ON });
    renderWidget('desktop-sidebar');
    expect(screen.getByText('IVA incluido')).toBeInTheDocument();
  });

  it('shows base "Desde $290k" when displayPricesWithIva is false', () => {
    useHotelInfo.mockReturnValue({ data: HOTEL_INFO_IVA_OFF });
    renderWidget();
    expect(screen.getByText('Desde $290k')).toBeInTheDocument();
  });

  it('does NOT show "IVA incluido" hint when flag is off', () => {
    useHotelInfo.mockReturnValue({ data: HOTEL_INFO_IVA_OFF });
    renderWidget('desktop-sidebar');
    expect(screen.queryByText('IVA incluido')).toBeNull();
  });
});

// ─── ReservationWidget — store-triggered date picker ─────────────────────────

describe('ReservationWidget — requestDatePicker signal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRoomTypes.mockReturnValue({ data: ROOMS });
    useHotelInfo.mockReturnValue({ data: HOTEL_INFO_IVA_OFF });
    useReservationUiStore.setState({ datePickerRequestedAt: null });
  });

  it('desktop-sidebar: opens ReservationDatePicker when datePickerRequestedAt is set', async () => {
    renderWidget('desktop-sidebar');
    // Picker should be closed initially — no calendar grids rendered
    expect(screen.queryAllByRole('grid')).toHaveLength(0);

    await act(async () => {
      useReservationUiStore.getState().requestDatePicker();
    });

    // desktop-sidebar uses numberOfMonths=2, so react-day-picker renders 2 grids
    expect(screen.getAllByRole('grid').length).toBeGreaterThan(0);
  });

  it('desktop-sidebar: clears the store signal after consuming it', async () => {
    renderWidget('desktop-sidebar');

    await act(async () => {
      useReservationUiStore.getState().requestDatePicker();
    });

    // After consuming, datePickerRequestedAt must be null so remounts don't re-trigger
    expect(useReservationUiStore.getState().datePickerRequestedAt).toBeNull();
  });

  it('mobile-bar: opens the picker panel when datePickerRequestedAt is set', async () => {
    renderWidget('mobile-bar');
    expect(screen.queryAllByRole('grid')).toHaveLength(0);

    await act(async () => {
      useReservationUiStore.getState().requestDatePicker();
    });

    expect(screen.getAllByRole('grid').length).toBeGreaterThan(0);
  });
});
