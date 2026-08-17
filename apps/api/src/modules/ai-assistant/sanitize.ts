/**
 * sanitize.ts — Input sanitization for AI assistant free-text inputs.
 *
 * Applied to find_guest.query (free text from the LLM) before passing to any service.
 * Other tools use Zod schema validation only — no free-text fields.
 *
 * Security goals:
 * 1. Strip control chars (except tab, newline, carriage return) — prevents terminal injection
 * 2. Truncate to maxLen chars — bounds LLM-generated query size
 * 3. Strip prompt-injection markers — prevents model hijacking via user input
 *
 * AI-07 requirement: sanitizeInput() strips control chars + 10 injection markers + caps length.
 */

/** Prompt-injection markers that must be stripped (case-insensitive). */
const INJECTION_PATTERNS: RegExp[] = [
  /\nUser:/gi,
  /\nSystem:/gi,
  /\nAssistant:/gi,
  /<system>/gi,
  /<\/system>/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
  /\n\nHuman:/gi,
];

/**
 * sanitizeInput — strips control chars, caps length, and removes prompt-injection markers.
 *
 * Preserved characters: \t (0x09), \n (0x0A), \r (0x0D) — common in legitimate text.
 * Stripped: 0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F, 0x7F (all other C0/C1 control chars).
 *
 * @param raw - Raw string input from the LLM tool call
 * @param maxLen - Maximum allowed length after stripping (default: 256)
 * @returns Sanitized string (may be empty if all chars were stripped)
 */
export function sanitizeInput(raw: string, maxLen = 256): string {
  // Step 1: Strip control chars EXCEPT \t (0x09), \n (0x0A), \r (0x0D)
  // Step 2: Trim whitespace from both ends
  // Step 3: Truncate to maxLen
  let s = raw
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLen);

  // Step 4: Strip all prompt-injection markers
  for (const pattern of INJECTION_PATTERNS) {
    s = s.replace(pattern, '');
  }

  return s;
}
