import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useReservationDraft } from './useReservationDraft';

function makeWrapper(initialPath: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="*" element={<>{children}</>} />
        </Routes>
      </MemoryRouter>
    );
  };
}

describe('useReservationDraft', () => {
  it('reads checkIn / checkOut / adults from URL search params', () => {
    const { result } = renderHook(() => useReservationDraft(), {
      wrapper: makeWrapper('/?checkIn=2026-06-14&checkOut=2026-06-18&adults=3'),
    });
    expect(result.current.draft.checkIn).toBe('2026-06-14');
    expect(result.current.draft.checkOut).toBe('2026-06-18');
    expect(result.current.draft.adults).toBe(3);
    expect(result.current.canCommit).toBe(true);
  });

  it('defaults adults to 2 when missing from URL', () => {
    const { result } = renderHook(() => useReservationDraft(), {
      wrapper: makeWrapper('/'),
    });
    expect(result.current.draft.adults).toBe(2);
    expect(result.current.draft.checkIn).toBeNull();
    expect(result.current.canCommit).toBe(false);
  });

  it('clamps adults between 1 and 10 via setAdults', () => {
    const { result } = renderHook(() => useReservationDraft(), {
      wrapper: makeWrapper('/'),
    });
    act(() => result.current.setAdults(15));
    expect(result.current.draft.adults).toBe(10);
    act(() => result.current.setAdults(0));
    expect(result.current.draft.adults).toBe(1);
  });

  it('canCommit is false when only checkIn is set (checkOut missing)', () => {
    const { result } = renderHook(() => useReservationDraft(), {
      wrapper: makeWrapper('/?checkIn=2026-06-14&adults=2'),
    });
    expect(result.current.canCommit).toBe(false);
  });

  it('canCommit is false when checkIn === checkOut (0 nights)', () => {
    const { result } = renderHook(() => useReservationDraft(), {
      wrapper: makeWrapper('/?checkIn=2026-06-14&checkOut=2026-06-14&adults=2'),
    });
    expect(result.current.canCommit).toBe(false);
  });

  it('canCommit is true when checkOut is strictly after checkIn (≥1 night)', () => {
    const { result } = renderHook(() => useReservationDraft(), {
      wrapper: makeWrapper('/?checkIn=2026-06-14&checkOut=2026-06-15&adults=1'),
    });
    expect(result.current.canCommit).toBe(true);
  });
});
