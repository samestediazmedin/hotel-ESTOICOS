import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock shared socket singleton
const mockSocket = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

vi.mock('@/lib/socket', () => ({
  getOrCreateSocket: vi.fn(() => mockSocket),
  disconnectSocket: vi.fn(),
}));

// Mock auth store
const mockAuthStore = {
  user: { id: 'user-self', email: 'staff@hotel.com', role: 'RECEPTION' as const },
  accessToken: 'test-token',
};

vi.mock('@/features/auth/auth.store', () => ({
  useAuthStore: vi.fn((selector: (s: typeof mockAuthStore) => unknown) =>
    selector(mockAuthStore),
  ),
}));

// Mock API client
vi.mock('../guest-contact.api', () => ({
  listContactEvents: vi.fn().mockResolvedValue([
    {
      id: 'event-1',
      guestId: 'guest-abc',
      staffUserId: 'user-other',
      method: 'CALL',
      notes: null,
      createdAt: '2026-05-19T10:00:00.000Z',
      staffUser: { id: 'user-other', name: 'María Pérez', email: 'maria@hotel.com' },
    },
  ]),
}));

// Mock sonner
const mockToastInfo = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    info: (msg: string) => mockToastInfo(msg),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Import hook AFTER mocks ───────────────────────────────────────────────────

import { useGuestContactEvents } from './useGuestContactEvents';
import { getOrCreateSocket } from '@/lib/socket';
import type { ContactEventSocketPayload } from '../types';

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // Test wrapper — display name is not needed for testing infrastructure components.
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useGuestContactEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock socket handlers
    mockSocket.emit.mockClear();
    mockSocket.on.mockClear();
    mockSocket.off.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test 1 ─────────────────────────────────────────────────────────────────────
  it('returns TanStack Query result with data array of GuestContactEventDto', async () => {
    const { result } = renderHook(() => useGuestContactEvents('guest-abc'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].id).toBe('event-1');
    expect(result.current.data![0].method).toBe('CALL');
  });

  // Test 2 ─────────────────────────────────────────────────────────────────────
  it('on mount with valid guestId + accessToken: connects socket and emits join-room', async () => {
    const { result } = renderHook(() => useGuestContactEvents('guest-abc'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(getOrCreateSocket).toHaveBeenCalledWith('test-token');
    expect(mockSocket.emit).toHaveBeenCalledWith('join-room', 'guest:guest-abc');
    expect(mockSocket.on).toHaveBeenCalledWith('contact-event.created', expect.any(Function));
  });

  // Test 3 ─────────────────────────────────────────────────────────────────────
  it('on unmount emits leave-room and removes listener', async () => {
    const { result, unmount } = renderHook(() => useGuestContactEvents('guest-abc'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    unmount();

    expect(mockSocket.emit).toHaveBeenCalledWith('leave-room', 'guest:guest-abc');
    expect(mockSocket.off).toHaveBeenCalledWith('contact-event.created', expect.any(Function));
  });

  // Test 4 ─────────────────────────────────────────────────────────────────────
  it('contact-event.created from SELF: invalidates query but shows NO toast', async () => {
    const { result } = renderHook(() => useGuestContactEvents('guest-abc'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    // Extract the handler registered via socket.on
    const onCall = mockSocket.on.mock.calls.find(([event]) => event === 'contact-event.created');
    expect(onCall).toBeDefined();
    const handleEvent = onCall![1] as (payload: ContactEventSocketPayload) => void;

    // Simulate event from self
    handleEvent({
      eventId: 'event-self',
      guestId: 'guest-abc',
      method: 'WHATSAPP',
      staffUserId: 'user-self', // same as mockAuthStore.user.id
      staffUserName: 'Self Staff',
      createdAt: '2026-05-19T11:00:00.000Z',
    });

    expect(mockToastInfo).not.toHaveBeenCalled();
  });

  // Test 5 ─────────────────────────────────────────────────────────────────────
  it('contact-event.created from OTHER user: invalidates query AND shows toast with staffUserName', async () => {
    const { result } = renderHook(() => useGuestContactEvents('guest-abc'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    const onCall = mockSocket.on.mock.calls.find(([event]) => event === 'contact-event.created');
    const handleEvent = onCall![1] as (payload: ContactEventSocketPayload) => void;

    handleEvent({
      eventId: 'event-remote',
      guestId: 'guest-abc',
      method: 'CALL',
      staffUserId: 'user-other', // different from 'user-self'
      staffUserName: 'Ana Recepción',
      createdAt: '2026-05-19T11:00:00.000Z',
    });

    expect(mockToastInfo).toHaveBeenCalledOnce();
    expect(mockToastInfo).toHaveBeenCalledWith(
      'Ana Recepción inició contacto por llamada con este huésped',
    );
  });

  // Test 6 ─────────────────────────────────────────────────────────────────────
  it('uses correct Spanish method labels: CALL→llamada, WHATSAPP→WhatsApp, EMAIL→email', async () => {
    const { result } = renderHook(() => useGuestContactEvents('guest-abc'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    const onCall = mockSocket.on.mock.calls.find(([event]) => event === 'contact-event.created');
    const handleEvent = onCall![1] as (payload: ContactEventSocketPayload) => void;

    // CALL → llamada
    handleEvent({
      eventId: 'e1', guestId: 'guest-abc', method: 'CALL',
      staffUserId: 'user-other', staffUserName: 'Staff A', createdAt: new Date().toISOString(),
    });
    expect(mockToastInfo).toHaveBeenLastCalledWith(
      'Staff A inició contacto por llamada con este huésped',
    );

    // WHATSAPP → WhatsApp
    handleEvent({
      eventId: 'e2', guestId: 'guest-abc', method: 'WHATSAPP',
      staffUserId: 'user-other', staffUserName: 'Staff B', createdAt: new Date().toISOString(),
    });
    expect(mockToastInfo).toHaveBeenLastCalledWith(
      'Staff B inició contacto por WhatsApp con este huésped',
    );

    // EMAIL → email
    handleEvent({
      eventId: 'e3', guestId: 'guest-abc', method: 'EMAIL',
      staffUserId: 'user-other', staffUserName: 'Staff C', createdAt: new Date().toISOString(),
    });
    expect(mockToastInfo).toHaveBeenLastCalledWith(
      'Staff C inició contacto por email con este huésped',
    );
  });

  // Test 7 ─────────────────────────────────────────────────────────────────────
  it('no accessToken: no socket created, query disabled', async () => {
    // Temporarily set accessToken to null
    const originalToken = mockAuthStore.accessToken;
    mockAuthStore.accessToken = null as unknown as string;

    const { result } = renderHook(() => useGuestContactEvents('guest-abc'), {
      wrapper: makeWrapper(),
    });

    // Wait a tick — query should stay in pending/disabled state (no fetch)
    await new Promise((r) => setTimeout(r, 50));

    expect(getOrCreateSocket).not.toHaveBeenCalled();
    expect(mockSocket.emit).not.toHaveBeenCalled();
    // data should be undefined (query not enabled)
    expect(result.current.data).toBeUndefined();

    // Restore
    mockAuthStore.accessToken = originalToken;
  });

  // Test 8 ─────────────────────────────────────────────────────────────────────
  it('guestId change: leaves old room and joins new room', async () => {
    let guestId = 'guest-abc';

    const { result, rerender } = renderHook(() => useGuestContactEvents(guestId), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    // Verify joined first room
    expect(mockSocket.emit).toHaveBeenCalledWith('join-room', 'guest:guest-abc');

    // Change guestId → triggers effect re-run
    guestId = 'guest-xyz';
    rerender();

    await waitFor(() => {
      // Should have left old room
      expect(mockSocket.emit).toHaveBeenCalledWith('leave-room', 'guest:guest-abc');
    });

    // Should join new room
    expect(mockSocket.emit).toHaveBeenCalledWith('join-room', 'guest:guest-xyz');
  });
});
