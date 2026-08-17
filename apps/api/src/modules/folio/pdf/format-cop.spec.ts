import { describe, it, expect } from 'vitest';
import { formatCOP } from './format-cop';

describe('formatCOP', () => {
  it('formats 0 as $ 0', () => {
    expect(formatCOP(0)).toBe('$ 0');
  });

  it('formats 100 as $ 100', () => {
    expect(formatCOP(100)).toBe('$ 100');
  });

  it('formats 1000 as $ 1.000', () => {
    expect(formatCOP(1000)).toBe('$ 1.000');
  });

  it('formats 100000 as $ 100.000', () => {
    expect(formatCOP(100000)).toBe('$ 100.000');
  });

  it('formats 1234567 as $ 1.234.567', () => {
    expect(formatCOP(1234567)).toBe('$ 1.234.567');
  });

  it('formats -50000 as -$ 50.000', () => {
    expect(formatCOP(-50000)).toBe('-$ 50.000');
  });

  it('formats null as $ 0', () => {
    expect(formatCOP(null)).toBe('$ 0');
  });

  it('formats undefined as $ 0', () => {
    expect(formatCOP(undefined)).toBe('$ 0');
  });

  it('formats Decimal-like object (99.5) as $ 100 (rounded)', () => {
    // Simulate Prisma Decimal — has .toString() method
    const decimalLike = { toString: () => '99.5' };
    expect(formatCOP(decimalLike)).toBe('$ 100');
  });
});
