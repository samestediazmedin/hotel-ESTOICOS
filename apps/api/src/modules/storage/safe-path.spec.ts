import { describe, it, expect } from 'vitest';
import { sanitizeFilename } from './safe-path';

/**
 * sanitizeFilename — OWASP path traversal / file-name validation tests.
 * These are the hard guarantees the rest of the storage layer depends on.
 */
describe('sanitizeFilename', () => {
  it('accepts the canonical generated pattern', () => {
    expect(sanitizeFilename('offer_1735393856123_a1b2c3d4.jpg')).toBe(
      'offer_1735393856123_a1b2c3d4.jpg',
    );
  });

  it('accepts thumbnail suffix', () => {
    expect(sanitizeFilename('offer_1735_a1_thumb.jpg')).toBe(
      'offer_1735_a1_thumb.jpg',
    );
  });

  it('rejects forward-slash path traversal', () => {
    expect(() => sanitizeFilename('../etc/passwd')).toThrow(/Path traversal/);
  });

  it('rejects backslash path traversal (Windows)', () => {
    expect(() => sanitizeFilename('..\\windows\\system32')).toThrow(
      /Path traversal/,
    );
  });

  it('rejects URL-encoded slash (%2F should never decode at this layer)', () => {
    // %2F itself is a string of [%, 2, F] — only the % is disallowed by regex
    expect(() => sanitizeFilename('a%2Fb.jpg')).toThrow(/Invalid filename characters/);
  });

  it('rejects null bytes', () => {
    expect(() => sanitizeFilename('a\0b.jpg')).toThrow();
  });

  it('rejects empty string', () => {
    expect(() => sanitizeFilename('')).toThrow(/length/);
  });

  it('rejects names longer than 200 chars', () => {
    expect(() => sanitizeFilename('a'.repeat(201) + '.jpg')).toThrow(/length/);
  });

  it('rejects non-string inputs', () => {
    expect(() => sanitizeFilename(undefined)).toThrow(/must be a string/);
    expect(() => sanitizeFilename(123 as unknown)).toThrow(/must be a string/);
  });

  it('rejects spaces and quotes', () => {
    expect(() => sanitizeFilename('my photo.jpg')).toThrow(
      /Invalid filename characters/,
    );
    expect(() => sanitizeFilename('foo"bar.jpg')).toThrow();
  });

  it('rejects unicode lookalikes (full-width slash)', () => {
    // U+FF0F FULLWIDTH SOLIDUS — visually a slash, regex rejects it
    expect(() => sanitizeFilename('a／b.jpg')).toThrow();
  });
});
