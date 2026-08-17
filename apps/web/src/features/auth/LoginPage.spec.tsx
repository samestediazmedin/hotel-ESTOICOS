/**
 * LoginPage.spec.tsx — GREEN phase
 * Tests the login screen renders correctly and behaves as expected
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from './LoginPage';

// Use vi.hoisted so mock references are available when vi.mock factory is called
const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn().mockResolvedValue({ data: { hotelName: 'Hotel Test' } }),
  navigate: vi.fn(),
}));

// Mock the api module — get resolves so LoginPage's useEffect (hotelName fetch) doesn't crash
vi.mock('@/lib/api', () => ({
  api: {
    post: mocks.post,
    get: mocks.get,
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

// Mock react-router-dom navigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default behavior after clearAllMocks
    mocks.get.mockResolvedValue({ data: { hotelName: 'Hotel Test' } });
  });

  it('renders without crashing', () => {
    render(<LoginPage />, { wrapper });
  });

  it('renders "Entrar" submit button', () => {
    render(<LoginPage />, { wrapper });
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });

  it('renders an input with type="email"', () => {
    render(<LoginPage />, { wrapper });
    const emailInput = document.querySelector('input[type="email"]');
    expect(emailInput).toBeInTheDocument();
  });

  it('renders an input with type="password"', () => {
    render(<LoginPage />, { wrapper });
    const passwordInput = document.querySelector('input[type="password"]');
    expect(passwordInput).toBeInTheDocument();
  });

  it('shows "Credenciales incorrectas" on 401 error', async () => {
    mocks.post.mockRejectedValueOnce({
      response: { status: 401, data: { message: 'Credenciales incorrectas' } },
    });

    render(<LoginPage />, { wrapper });

    const emailInput = document.querySelector('input[type="email"]')!;
    const passwordInput = document.querySelector('input[type="password"]')!;
    const submitBtn = screen.getByRole('button', { name: /entrar/i });

    fireEvent.change(emailInput, { target: { value: 'test@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpass123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/credenciales incorrectas/i)).toBeInTheDocument();
    });
  });

  it('has no hardcoded hex colors in rendered output style attributes', () => {
    render(<LoginPage />, { wrapper });
    const allElements = document.querySelectorAll('[style]');
    const hexPattern = /#[0-9a-fA-F]{3,8}/;
    allElements.forEach((el) => {
      const styleAttr = el.getAttribute('style') ?? '';
      expect(styleAttr).not.toMatch(hexPattern);
    });
  });
});
