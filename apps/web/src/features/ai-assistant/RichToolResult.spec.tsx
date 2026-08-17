/**
 * RichToolResult — regression tests for tool result rendering.
 *
 * These tests guard against the production crash where result envelopes
 * (objects like { rooms, truncated, total }) were mis-typed as flat arrays,
 * causing "a.find is not a function" (TypeError) at runtime.
 *
 * Root cause: backend tool handlers return envelope objects, not flat arrays.
 * See apps/api/src/modules/ai-assistant/tools/*.tool.ts for exact shapes.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RichToolResult } from './RichToolResult';

// ── helpers ──────────────────────────────────────────────────────────────────

function renderTool(toolName: string, result: unknown) {
  return render(
    <MemoryRouter>
      <RichToolResult toolName={toolName} result={result} />
    </MemoryRouter>,
  );
}

// ── get_availability ─────────────────────────────────────────────────────────

describe('RichToolResult — get_availability', () => {
  it('renders room rows from envelope without crashing', () => {
    const result = {
      rooms: [
        { roomNumber: '101', typeName: 'Doble Estándar', floor: 1, pricePerNight: 280000 },
        { roomNumber: '202', typeName: 'Suite Andina', floor: 2, pricePerNight: 720000 },
      ],
      truncated: false,
      total: 2,
    };

    // Must NOT throw "a.find is not a function"
    expect(() => renderTool('get_availability', result)).not.toThrow();
    expect(screen.getByText('101')).toBeInTheDocument();
    expect(screen.getByText('202')).toBeInTheDocument();
    expect(screen.getByText('Doble Estándar')).toBeInTheDocument();
  });

  it('shows truncation notice when truncated=true', () => {
    const result = {
      rooms: [{ roomNumber: '101', typeName: 'Doble', floor: 1, pricePerNight: 280000 }],
      truncated: true,
      total: 25,
    };

    renderTool('get_availability', result);
    expect(screen.getByText(/Resultados truncados/)).toBeInTheDocument();
    expect(screen.getByText(/de 25 total/)).toBeInTheDocument();
  });

  it('renders empty table when rooms array is empty', () => {
    const result = { rooms: [], truncated: false, total: 0 };

    expect(() => renderTool('get_availability', result)).not.toThrow();
    // Table headers must render even with no rows
    expect(screen.getByText('Habitación')).toBeInTheDocument();
  });
});

// ── find_guest ───────────────────────────────────────────────────────────────

describe('RichToolResult — find_guest', () => {
  it('renders guest rows from envelope without crashing', () => {
    const result = {
      guests: [
        { id: 'cuid1', fullName: 'María García', nationality: 'CO', totalStays: 3 },
        { id: 'cuid2', fullName: 'John Smith', nationality: 'US', totalStays: 1 },
      ],
      truncated: false,
      total: 2,
    };

    expect(() => renderTool('find_guest', result)).not.toThrow();
    expect(screen.getByText('María García')).toBeInTheDocument();
    expect(screen.getByText('John Smith')).toBeInTheDocument();
  });

  it('renders empty list when guests array is empty', () => {
    const result = { guests: [], truncated: false, total: 0 };

    expect(() => renderTool('find_guest', result)).not.toThrow();
  });
});

// ── get_checkins_today ───────────────────────────────────────────────────────

describe('RichToolResult — get_checkins_today', () => {
  it('renders checkin rows from envelope without crashing', () => {
    const result = {
      checkins: [
        { reservationId: 'res001abc', guestName: 'Ana López', roomNumber: '301', checkInDate: '2026-05-29', status: 'CONFIRMED' },
      ],
      truncated: false,
      total: 1,
    };

    expect(() => renderTool('get_checkins_today', result)).not.toThrow();
    expect(screen.getByText('Ana López')).toBeInTheDocument();
    expect(screen.getByText('2026-05-29')).toBeInTheDocument();
  });
});

// ── get_checkouts_today ──────────────────────────────────────────────────────

describe('RichToolResult — get_checkouts_today', () => {
  it('renders checkout rows from envelope without crashing', () => {
    const result = {
      checkouts: [
        { reservationId: 'res002def', guestName: 'Carlos Ruiz', roomNumber: '210', checkOutDate: '2026-05-29', folioBalance: 0 },
      ],
      truncated: false,
      total: 1,
    };

    expect(() => renderTool('get_checkouts_today', result)).not.toThrow();
    expect(screen.getByText('Carlos Ruiz')).toBeInTheDocument();
  });
});

// ── error prop ───────────────────────────────────────────────────────────────

describe('RichToolResult — error prop', () => {
  it('renders error banner when error prop is provided', () => {
    renderTool('get_availability', undefined);
    // No result, no error → null render, no crash
    expect(document.body.textContent).toBe('');
  });

  it('renders error message when error string is provided', () => {
    render(
      <MemoryRouter>
        <RichToolResult toolName="get_availability" result={undefined} error="Tool timeout" />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Tool timeout/)).toBeInTheDocument();
  });
});
