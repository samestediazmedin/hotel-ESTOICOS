/**
 * tokens.ts — Single source of truth for HotelOS AI design tokens
 *
 * These values are the canonical TypeScript representation of the Claude Design
 * bundle palette from .design-fetch/hotelos-ai/project/tokens.jsx (lines 18-91).
 * The hex values here MUST match the .hos block in src/styles/globals.css exactly.
 * tokens.spec.ts enforces this constraint on every CI run.
 *
 * Usage:
 *   - In tests: import { tokens } from '@/design/tokens' for assertions
 *   - In components: use Tailwind utility classes (bg-terracotta, text-ink-1, etc.)
 *     or CSS variables (var(--terracotta)) — never import hex values directly in components
 *
 * NOTE: warm-line and warm-line-strong are pre-composed rgba() values.
 *       Do NOT use Tailwind opacity modifiers (e.g., border-warm-line/50) with these
 *       tokens — rgba() is not channel-separable. Use them as-is.
 */

export const tokens = {
  colors: {
    // Warm neutral ramp
    'warm-white':       '#faf7f2',
    'warm-paper':       '#f4efe6',
    'warm-cream':       '#ede5d6',
    'warm-tan':         '#d4c5a9',
    'warm-line':        'rgba(58, 42, 28, 0.10)',   // Pre-composed rgba — no opacity modifier
    'warm-line-strong': 'rgba(58, 42, 28, 0.18)',   // Pre-composed rgba — no opacity modifier

    // Ink ramp
    'ink-1': '#2a221a',
    'ink-2': '#5a4d3f',
    'ink-3': '#8a7d6e',
    'ink-4': '#b3a89a',

    // Brand — terracotta
    'terracotta':       '#c4623f',
    'terracotta-deep':  '#9d4a2e',
    'terracotta-soft':  '#f1d4c2',
    'terracotta-tint':  '#faeae0',

    // Brand — mustard
    'mustard':      '#d4a23a',
    'mustard-soft': '#f1dfa9',
    'mustard-tint': '#faf0d4',

    // Brand — olive
    'olive':      '#6b7a3d',
    'olive-tint': '#e8eccf',

    // Brand — clay
    'clay':      '#8a4f3d',
    'clay-tint': '#ecd5cb',

    // Status FG (6 foreground tokens — verbatim from tokens.jsx lines 45-56)
    'status-available':    '#5b9d6e',
    'status-reserved':     '#4a78b8',
    'status-occupied':     '#c4623f',  // Same as terracotta
    'status-cleaning':     '#d4a23a',  // Bundle var(--status-cleaning) — #a8801c (line 267) is NOT adopted as token
    'status-maintenance':  '#8a7d6e',
    'status-blocked':      '#2a221a',

    // Status BG (6 background tokens — verbatim from tokens.jsx lines 45-56)
    'status-available-bg':   '#d8ebd9',
    'status-reserved-bg':    '#d8e3f2',
    'status-occupied-bg':    '#f1d4c2',
    'status-cleaning-bg':    '#f1dfa9',
    'status-maintenance-bg': '#e0dad0',
    'status-blocked-bg':     '#b8b0a3',
  },

  fontFamily: {
    display: "'Instrument Serif', 'Cormorant Garamond', Georgia, serif",
    body:    "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    mono:    "'Geist Mono', ui-monospace, 'JetBrains Mono', monospace",
  },

  borderRadius: {
    sm:      '4px',
    DEFAULT: '8px',
    md:      '8px',
    lg:      '12px',
    xl:      '14px',    // Bundle .hos-card uses border-radius: 14px
    pill:    '999px',
  },

  spacing: {
    '1':  '4px',
    '2':  '8px',
    '3':  '12px',
    '4':  '16px',
    '5':  '20px',
    '6':  '24px',
    '8':  '32px',
    '10': '40px',
    '12': '48px',
    '16': '64px',
  },
} as const;

export type TokenColors = keyof typeof tokens.colors;
export type TokenFontFamily = keyof typeof tokens.fontFamily;
