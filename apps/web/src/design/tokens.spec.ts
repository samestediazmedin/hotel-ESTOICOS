/**
 * tokens.spec.ts — Bundle token sync enforcement
 *
 * Validates that tokens.ts mirrors the canonical Claude Design bundle palette
 * verbatim (names + hex values from .design-fetch/hotelos-ai/project/tokens.jsx).
 *
 * RED: fails against v1.0 tokens.ts (wrong names + wrong hex values)
 * GREEN: passes after tokens.ts is rewritten with bundle palette
 */
import { describe, it, expect } from 'vitest';
import { tokens } from './tokens';

describe('Design Tokens — bundle palette sync (tokens.jsx verbatim)', () => {

  // ── Token count ─────────────────────────────────────────────────────────
  it('has exactly 33 color tokens (bundle palette)', () => {
    // 4 warm-hex + 2 warm-rgba + 4 ink + 4 terracotta + 3 mustard + 2 olive + 2 clay
    // + 6 status-fg + 6 status-bg = 33
    expect(Object.keys(tokens.colors).length).toBe(33);
  });

  // ── Warm neutral ramp ────────────────────────────────────────────────────
  it('warm-white is #faf7f2', () => {
    expect(tokens.colors['warm-white']).toBe('#faf7f2');
  });

  it('warm-paper is #f4efe6', () => {
    expect(tokens.colors['warm-paper']).toBe('#f4efe6');
  });

  it('warm-cream is #ede5d6', () => {
    expect(tokens.colors['warm-cream']).toBe('#ede5d6');
  });

  it('warm-tan is #d4c5a9', () => {
    expect(tokens.colors['warm-tan']).toBe('#d4c5a9');
  });

  it('warm-line is rgba(58, 42, 28, 0.10)', () => {
    expect(tokens.colors['warm-line']).toBe('rgba(58, 42, 28, 0.10)');
  });

  it('warm-line-strong is rgba(58, 42, 28, 0.18)', () => {
    expect(tokens.colors['warm-line-strong']).toBe('rgba(58, 42, 28, 0.18)');
  });

  // ── Ink ramp ─────────────────────────────────────────────────────────────
  it('ink-1 is #2a221a', () => {
    expect(tokens.colors['ink-1']).toBe('#2a221a');
  });

  it('ink-2 is #5a4d3f', () => {
    expect(tokens.colors['ink-2']).toBe('#5a4d3f');
  });

  it('ink-3 is #8a7d6e', () => {
    expect(tokens.colors['ink-3']).toBe('#8a7d6e');
  });

  it('ink-4 is #b3a89a', () => {
    expect(tokens.colors['ink-4']).toBe('#b3a89a');
  });

  // ── Brand — terracotta ────────────────────────────────────────────────────
  it('terracotta is #c4623f (bundle value — NOT v1.0 #c45a3a)', () => {
    expect(tokens.colors['terracotta']).toBe('#c4623f');
  });

  it('terracotta-deep is #9d4a2e', () => {
    expect(tokens.colors['terracotta-deep']).toBe('#9d4a2e');
  });

  it('terracotta-soft is #f1d4c2', () => {
    expect(tokens.colors['terracotta-soft']).toBe('#f1d4c2');
  });

  it('terracotta-tint is #faeae0', () => {
    expect(tokens.colors['terracotta-tint']).toBe('#faeae0');
  });

  // ── Brand — mustard / olive / clay ────────────────────────────────────────
  it('mustard is #d4a23a', () => {
    expect(tokens.colors['mustard']).toBe('#d4a23a');
  });

  it('mustard-soft is #f1dfa9', () => {
    expect(tokens.colors['mustard-soft']).toBe('#f1dfa9');
  });

  it('mustard-tint is #faf0d4', () => {
    expect(tokens.colors['mustard-tint']).toBe('#faf0d4');
  });

  it('olive is #6b7a3d', () => {
    expect(tokens.colors['olive']).toBe('#6b7a3d');
  });

  it('olive-tint is #e8eccf', () => {
    expect(tokens.colors['olive-tint']).toBe('#e8eccf');
  });

  it('clay is #8a4f3d', () => {
    expect(tokens.colors['clay']).toBe('#8a4f3d');
  });

  it('clay-tint is #ecd5cb', () => {
    expect(tokens.colors['clay-tint']).toBe('#ecd5cb');
  });

  // ── Status FG (6 foreground tokens) ──────────────────────────────────────
  it('status-available fg is #5b9d6e', () => {
    expect(tokens.colors['status-available']).toBe('#5b9d6e');
  });

  it('status-reserved fg is #4a78b8', () => {
    expect(tokens.colors['status-reserved']).toBe('#4a78b8');
  });

  it('status-occupied fg is #c4623f (same as terracotta)', () => {
    expect(tokens.colors['status-occupied']).toBe('#c4623f');
  });

  it('status-cleaning fg is #d4a23a (bundle var(--status-cleaning) value)', () => {
    expect(tokens.colors['status-cleaning']).toBe('#d4a23a');
  });

  it('status-maintenance fg is #8a7d6e', () => {
    expect(tokens.colors['status-maintenance']).toBe('#8a7d6e');
  });

  it('status-blocked fg is #2a221a', () => {
    expect(tokens.colors['status-blocked']).toBe('#2a221a');
  });

  // ── Status BG (6 background tokens) ──────────────────────────────────────
  it('status-available-bg is #d8ebd9', () => {
    expect(tokens.colors['status-available-bg']).toBe('#d8ebd9');
  });

  it('status-reserved-bg is #d8e3f2', () => {
    expect(tokens.colors['status-reserved-bg']).toBe('#d8e3f2');
  });

  it('status-occupied-bg is #f1d4c2', () => {
    expect(tokens.colors['status-occupied-bg']).toBe('#f1d4c2');
  });

  it('status-cleaning-bg is #f1dfa9', () => {
    expect(tokens.colors['status-cleaning-bg']).toBe('#f1dfa9');
  });

  it('status-maintenance-bg is #e0dad0', () => {
    expect(tokens.colors['status-maintenance-bg']).toBe('#e0dad0');
  });

  it('status-blocked-bg is #b8b0a3', () => {
    expect(tokens.colors['status-blocked-bg']).toBe('#b8b0a3');
  });

  // ── Font families ─────────────────────────────────────────────────────────
  it('display font contains Instrument Serif (bundle primary — NOT Source Serif 4)', () => {
    expect(tokens.fontFamily.display).toContain('Instrument Serif');
  });

  it('body font contains Geist', () => {
    expect(tokens.fontFamily.body).toContain('Geist');
  });

  it('mono font contains Geist Mono', () => {
    expect(tokens.fontFamily.mono).toContain('Geist Mono');
  });

  // ── v1.0 token names are GONE ─────────────────────────────────────────────
  it('does NOT have v1.0 token brand-primary', () => {
    expect(tokens.colors).not.toHaveProperty('brand-primary');
  });

  it('does NOT have v1.0 token bg-base', () => {
    expect(tokens.colors).not.toHaveProperty('bg-base');
  });

  it('does NOT have v1.0 token surface', () => {
    expect(tokens.colors).not.toHaveProperty('surface');
  });

  it('does NOT have v1.0 token text-primary', () => {
    expect(tokens.colors).not.toHaveProperty('text-primary');
  });

  // ── Border radius (xl added for bundle .hos-card 14px) ───────────────────
  it('has borderRadius xl: 14px (bundle .hos-card radius)', () => {
    expect(tokens.borderRadius.xl).toBe('14px');
  });
});
