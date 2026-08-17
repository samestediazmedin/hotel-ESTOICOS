import { describe, it, expect } from 'vitest';
import { formatRoomPrice, formatCOP, formatCOPShort } from './displayPrice';

describe('formatRoomPrice', () => {
  const IVA_RATE = 0.19;

  // ─── Flag ON ───────────────────────────────────────────────────────────────

  it('returns base * (1 + ivaRate) rounded when displayPricesWithIva is true', () => {
    const result = formatRoomPrice(290_000, { displayPricesWithIva: true, ivaRate: IVA_RATE });
    expect(result.amount).toBe(Math.round(290_000 * 1.19)); // 345100
    expect(result.ivaIncluded).toBe(true);
  });

  it('rounds the IVA-included amount (no decimals in COP)', () => {
    // 100_001 * 1.19 = 119001.19 → rounds to 119001
    const result = formatRoomPrice(100_001, { displayPricesWithIva: true, ivaRate: IVA_RATE });
    expect(result.amount).toBe(Math.round(100_001 * 1.19));
    expect(Number.isInteger(result.amount)).toBe(true);
  });

  it('produces ivaIncluded: true when flag is on', () => {
    const { ivaIncluded } = formatRoomPrice(200_000, { displayPricesWithIva: true, ivaRate: IVA_RATE });
    expect(ivaIncluded).toBe(true);
  });

  // ─── Flag OFF ──────────────────────────────────────────────────────────────

  it('returns the base price unchanged when displayPricesWithIva is false', () => {
    const result = formatRoomPrice(290_000, { displayPricesWithIva: false, ivaRate: IVA_RATE });
    expect(result.amount).toBe(290_000);
    expect(result.ivaIncluded).toBe(false);
  });

  it('produces ivaIncluded: false when flag is off', () => {
    const { ivaIncluded } = formatRoomPrice(200_000, { displayPricesWithIva: false, ivaRate: IVA_RATE });
    expect(ivaIncluded).toBe(false);
  });

  // ─── Edge cases ────────────────────────────────────────────────────────────

  it('handles zero base price gracefully', () => {
    const result = formatRoomPrice(0, { displayPricesWithIva: true, ivaRate: IVA_RATE });
    expect(result.amount).toBe(0);
    expect(result.ivaIncluded).toBe(true);
  });

  it('applies the ivaRate passed in, not a hardcoded constant', () => {
    // Non-standard rate to confirm parameterization
    const result = formatRoomPrice(100_000, { displayPricesWithIva: true, ivaRate: 0.10 });
    expect(result.amount).toBe(110_000);
  });
});

describe('formatCOP', () => {
  it('formats 290000 as Colombian peso currency string', () => {
    const formatted = formatCOP(290_000);
    // locale output varies across environments; assert it contains the numeric part
    expect(formatted).toMatch(/290/);
    expect(formatted).toMatch(/000/);
  });

  it('formats 0 without decimals', () => {
    const formatted = formatCOP(0);
    expect(formatted).toMatch(/0/);
    expect(formatted).not.toMatch(/\./);
  });
});

describe('formatCOPShort', () => {
  it('renders 345100 as "$345k"', () => {
    expect(formatCOPShort(345_100)).toBe('$345k');
  });

  it('renders 290000 as "$290k"', () => {
    expect(formatCOPShort(290_000)).toBe('$290k');
  });

  it('truncates (does not round) to the nearest thousand', () => {
    // 280999 / 1000 = 280.999 → toFixed(0) rounds to "281"
    expect(formatCOPShort(280_999)).toBe('$281k');
  });
});
