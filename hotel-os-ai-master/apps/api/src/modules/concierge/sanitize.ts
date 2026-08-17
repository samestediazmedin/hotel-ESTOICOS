/**
 * sanitize.ts — Input sanitization for the public Concierge IA chatbot.
 *
 * Extends Phase 07's sanitizeInput() with:
 * 1. Longer maxLen cap (500 vs 256) — public guests may write longer messages.
 * 2. 9 English + 5 Spanish public-specific prompt-injection patterns targeting
 *    unauthenticated users who may attempt jailbreaks or persona hijacks.
 *
 * Security goals (CON-09 / AI-07 / S04):
 * - NFKC Unicode normalization + zero-width/invisible char stripping (S04)
 * - Strip control chars, trim, slice to 500 chars (Phase 07 behaviour)
 * - Strip Phase 07 injection markers (structured turn delimiters)
 * - Strip public-chat jailbreak patterns — English + Spanish (S04)
 *
 * AI-07 requirement: sanitizeConciergeInput() adds 9 English + 5 Spanish
 * public-specific injection patterns on top of the 10 already handled by
 * Phase 07's sanitizeInput().
 */

import { sanitizeInput } from '../ai-assistant/sanitize';

/** Public-chat jailbreak / persona-hijack patterns (case-insensitive). */
const PUBLIC_INJECTION_PATTERNS: RegExp[] = [
  // ── English patterns ──────────────────────────────────────────────────────
  /ignore\s+previous\s+instructions?/gi,
  /disregard\s+(?:all|the)\s+(?:previous|above|earlier)/gi,
  /you\s+are\s+now\b/gi,
  /\bact\s+as\b/gi,
  /pretend\s+(?:you\s+are|to\s+be)/gi,
  /your\s+new\s+(?:role|persona|identity)/gi,
  /forget\s+(?:everything|your\s+instructions?)/gi,
  /jailbreak/gi,
  /\bDAN\s+mode\b/gi,
  // ── Spanish patterns (S04) ────────────────────────────────────────────────
  /ignora\s+(?:las?\s+)?instrucciones?\s+(?:anteriores?|previas?)/gi,
  /ahora\s+eres\b/gi,
  /modo\s+desarrollador/gi,
  /act[uú]a\s+como\b/gi,
  /olvida\s+(?:todo|tus\s+instrucciones)/gi,
];

/**
 * ZERO_WIDTH_RE — matches zero-width and invisible Unicode characters that can
 * be used to obfuscate injection payloads from regex matching.
 * Range: U+200B–U+200F (zero-width space, non-joiner, joiner, LTR/RTL marks),
 *        U+202A–U+202F (directional embedding controls),
 *        U+FEFF         (byte-order mark / zero-width no-break space),
 *        U+00AD         (soft hyphen).
 */
const ZERO_WIDTH_RE = /[\u200B-\u200F\u202A-\u202F\uFEFF\u00AD]/g;

/**
 * sanitizeConciergeInput — sanitize public user input for the Concierge chatbot.
 *
 * Process:
 * 1. NFKC Unicode normalization — collapses homoglyphs and fullwidth chars (S04).
 * 2. Strip zero-width / invisible Unicode chars used for regex-bypass (S04).
 * 3. Delegates to Phase 07 sanitizeInput(raw, 500) — strips control chars, trims,
 *    caps at 500 chars, removes 10 structured injection markers.
 * 4. Applies 9 English + 5 Spanish jailbreak patterns (S04).
 *
 * @param raw - Raw string from the public chat UI
 * @returns Sanitized string (max 500 chars, injection-free)
 */
export function sanitizeConciergeInput(raw: string): string {
  // S04: NFKC normalization collapses fullwidth / homoglyph evasion attempts.
  // S04: Strip zero-width and invisible chars before any pattern matching.
  let s = raw.normalize('NFKC').replace(ZERO_WIDTH_RE, '');

  s = sanitizeInput(s, 500);

  for (const pattern of PUBLIC_INJECTION_PATTERNS) {
    s = s.replace(pattern, '');
  }
  return s;
}
