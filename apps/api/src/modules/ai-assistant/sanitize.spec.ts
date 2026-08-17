import { describe, it, expect } from 'vitest';
import { sanitizeInput } from './sanitize';

describe('sanitizeInput', () => {
  /**
   * Test 1: Strip control characters (except \t, \n, \r).
   * AI-07 requirement: control chars removed to prevent terminal injection.
   */
  it('strips control characters but preserves tab, newline, and carriage return', () => {
    // 0x00 (NUL), 0x07 (BEL), 0x1F (US), 0x7F (DEL) must be stripped
    const input = '\x00hello\x07world\x1F\x7F';
    expect(sanitizeInput(input)).toBe('helloworld');

    // \t (0x09), \n (0x0A), \r (0x0D) must be PRESERVED
    const withWhitespace = 'hello\tworld\nfoo\rbar';
    expect(sanitizeInput(withWhitespace)).toBe('hello\tworld\nfoo\rbar');
  });

  /**
   * Test 2: Truncate to 256 chars by default.
   * AI-07 requirement: caps free-text field length at 256.
   */
  it('truncates to 256 chars by default', () => {
    const longInput = 'a'.repeat(300);
    const result = sanitizeInput(longInput);
    expect(result.length).toBe(256);
    expect(result).toBe('a'.repeat(256));
  });

  /**
   * Test 3: Strips all 10 prompt-injection markers (case-insensitive).
   * AI-07 requirement: injection markers stripped before LLM context.
   */
  it('strips prompt-injection markers', () => {
    const markers = [
      { input: 'hello\nUser: inject', expected: 'hello inject' },
      { input: 'test\nSystem: override', expected: 'test override' },
      { input: 'query\nAssistant: fake', expected: 'query fake' },
      { input: 'hi<system>evil</system>', expected: 'hievil' },
      { input: 'msg[INST]hack[/INST]', expected: 'msghack' },
      { input: 'go<|im_start|>evil<|im_end|>', expected: 'goevil' },
      { input: 'text\n\nHuman: inject', expected: 'text inject' },
    ];

    for (const { input, expected } of markers) {
      expect(sanitizeInput(input), `Input: ${JSON.stringify(input)}`).toBe(expected);
    }
  });

  /**
   * Test 4: Accepts custom maxLen parameter.
   * Callers can specify a shorter limit for constrained fields.
   */
  it('accepts a custom maxLen parameter', () => {
    const input = 'hello world this is a longer string than sixty four chars here yes';
    const result = sanitizeInput(input, 64);
    expect(result.length).toBeLessThanOrEqual(64);
  });

  /**
   * Test 5: Empty string input returns empty string (not throw).
   * Guards against ZodError on empty guest search.
   */
  it('handles empty string without throwing', () => {
    expect(() => sanitizeInput('')).not.toThrow();
    expect(sanitizeInput('')).toBe('');
  });

  /**
   * Test 6: Preserves valid Spanish characters (international UTF-8 support).
   * Hotel operates in Colombia — guest names include Spanish diacritics.
   */
  it('preserves valid Spanish characters', () => {
    const spanish = 'José García ¿Cómo están? ¡Buenísimo! Ñoño núm. 5 café Bogotá';
    const result = sanitizeInput(spanish);
    // All Spanish chars must survive (they are multi-byte UTF-8, not ASCII control chars)
    expect(result).toContain('José');
    expect(result).toContain('García');
    expect(result).toContain('¿');
    expect(result).toContain('¡');
    expect(result).toContain('ñ');
    expect(result).toContain('ú');
    expect(result).toContain('Bogotá');
  });
});
