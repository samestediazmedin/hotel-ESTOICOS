import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { HousekeepingPage } from './HousekeepingPage';

// ─── Mock socket hook (no-op — socket.io not needed in unit tests) ──────────
vi.mock('./useHousekeepingSocket', () => ({
  useHousekeepingSocket: vi.fn(),
}));

// ─── Mock housekeeping API ───────────────────────────────────────────────────
vi.mock('./housekeeping.api', () => ({
  housekeepingApi: {
    getBoard: vi.fn(),
    transitionRoom: vi.fn(),
    createTask: vi.fn(),
    listTasks: vi.fn(),
    updateTaskStatus: vi.fn(),
  },
}));

// ─── Mock auth store ─────────────────────────────────────────────────────────
vi.mock('@/features/auth/auth.store', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useAuthStore: vi.fn((selector: (s: any) => unknown) =>
    selector({ user: { id: 'u1', email: 'admin@test.com', role: 'ADMIN' }, accessToken: 'tok', isRestoring: false, setAccessToken: vi.fn(), setUser: vi.fn(), setIsRestoring: vi.fn(), clearAuth: vi.fn() }),
  ),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────
import { housekeepingApi } from './housekeeping.api';
import { useAuthStore } from '@/features/auth/auth.store';

const MOCK_ROOMS = [
  { id: 'r1', number: '101', floor: 1, cleaningStatus: 'DIRTY'       },
  { id: 'r2', number: '201', floor: 2, cleaningStatus: 'IN_PROGRESS' },
  { id: 'r3', number: '301', floor: 3, cleaningStatus: 'INSPECTION'  },
  { id: 'r4', number: '401', floor: 4, cleaningStatus: 'CLEAN'       },
];

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage() {
  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <HousekeepingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('HousekeepingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const baseState = { user: { id: 'u1', email: 'admin@test.com', role: 'ADMIN' as const }, accessToken: 'tok', isRestoring: false, setAccessToken: vi.fn(), setUser: vi.fn(), setIsRestoring: vi.fn(), clearAuth: vi.fn() };
    // Reset to ADMIN role by default
    vi.mocked(useAuthStore).mockImplementation((selector) =>
      selector(baseState),
    );
    vi.mocked(housekeepingApi.getBoard).mockResolvedValue({ rooms: MOCK_ROOMS as never });
  });

  it('renders 4 columns with correct Spanish labels', async () => {
    renderPage();
    // Columns appear after data resolves
    expect(await screen.findByTestId('column-DIRTY')).toBeInTheDocument();
    expect(await screen.findByTestId('column-IN_PROGRESS')).toBeInTheDocument();
    expect(await screen.findByTestId('column-INSPECTION')).toBeInTheDocument();
    expect(await screen.findByTestId('column-CLEAN')).toBeInTheDocument();

    expect(screen.getByText(/Pendientes/)).toBeInTheDocument();
    expect(screen.getByText(/En proceso/)).toBeInTheDocument();
    expect(screen.getByText(/Listas hoy/)).toBeInTheDocument();
    expect(screen.getByText(/Verificadas/)).toBeInTheDocument();
  });

  it('renders room cards in the correct column matching their cleaningStatus', async () => {
    renderPage();
    await screen.findByTestId('column-DIRTY');

    // Room 101 is DIRTY → should be inside column-DIRTY
    const dirtyCol = screen.getByTestId('column-DIRTY');
    expect(dirtyCol).toContainElement(screen.getByTestId('room-card-101'));

    // Room 201 is IN_PROGRESS
    const inProgressCol = screen.getByTestId('column-IN_PROGRESS');
    expect(inProgressCol).toContainElement(screen.getByTestId('room-card-201'));

    // Room 301 is INSPECTION
    const inspectionCol = screen.getByTestId('column-INSPECTION');
    expect(inspectionCol).toContainElement(screen.getByTestId('room-card-301'));

    // Room 401 is CLEAN
    const cleanCol = screen.getByTestId('column-CLEAN');
    expect(cleanCol).toContainElement(screen.getByTestId('room-card-401'));
  });

  it('clicking a room card opens the RoomStatusModal', async () => {
    renderPage();
    await screen.findByTestId('room-card-101');
    fireEvent.click(screen.getByTestId('room-card-101'));
    expect(await screen.findByTestId('room-status-modal')).toBeInTheDocument();
  });

  it('MANAGER role sees "Asignar tarea" CTA and clicking opens TaskAssignmentDrawer', async () => {
    const managerState = { user: { id: 'm1', email: 'manager@test.com', role: 'MANAGER' as const }, accessToken: 'tok', isRestoring: false, setAccessToken: vi.fn(), setUser: vi.fn(), setIsRestoring: vi.fn(), clearAuth: vi.fn() };
    vi.mocked(useAuthStore).mockImplementation((selector) =>
      selector(managerState),
    );
    renderPage();
    await screen.findByTestId('assign-task-101');
    fireEvent.click(screen.getByTestId('assign-task-101'));
    expect(await screen.findByTestId('task-assignment-drawer')).toBeInTheDocument();
  });

  it('RECEPTION role does NOT see "Asignar tarea" CTA', async () => {
    const receptionState = { user: { id: 'rec1', email: 'rec@test.com', role: 'RECEPTION' as const }, accessToken: 'tok', isRestoring: false, setAccessToken: vi.fn(), setUser: vi.fn(), setIsRestoring: vi.fn(), clearAuth: vi.fn() };
    vi.mocked(useAuthStore).mockImplementation((selector) =>
      selector(receptionState),
    );
    renderPage();
    await screen.findByTestId('column-DIRTY');
    expect(screen.queryByTestId('assign-task-101')).not.toBeInTheDocument();
  });
});
