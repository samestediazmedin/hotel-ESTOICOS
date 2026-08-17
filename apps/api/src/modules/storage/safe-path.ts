import { resolve, sep } from 'node:path';

/**
 * STORAGE_ROOT — absolute path to the storage tree.
 *
 * Resolved ONCE at module load. All subsequent path operations are checked
 * against this root with a `startsWith` guard so the input filename can never
 * escape the storage tree (defence-in-depth against path traversal).
 *
 * Defaults to `./storage` for local dev; production deployment uses
 * `/app/storage` (Railway Volume mount path).
 */
export const STORAGE_ROOT = resolve(process.env.STORAGE_DIR ?? './storage');

/**
 * sanitizeFilename — strict allowlist validator for user-supplied filenames.
 *
 * Rules:
 *  - Must be non-empty and ≤ 200 chars
 *  - No path separators (`/`, `\`) anywhere
 *  - No parent-directory tokens (`..`)
 *  - Only `[A-Za-z0-9._-]` allowed (rejects null bytes, percent-encoded
 *    traversal like `%2F`, unicode lookalikes, spaces, quotes)
 *
 * Throws Error (NOT a Nest exception — controller layer wraps it) so the
 * helper stays framework-agnostic and reusable in scripts/tests.
 */
export function sanitizeFilename(name: unknown): string {
  if (typeof name !== 'string') {
    throw new Error('Invalid filename: must be a string');
  }
  if (name.length === 0 || name.length > 200) {
    throw new Error('Invalid filename: length must be 1..200');
  }
  if (
    name.includes('/') ||
    name.includes('\\') ||
    name.includes('..') ||
    name.includes('\0')
  ) {
    throw new Error('Path traversal attempt');
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
    throw new Error('Invalid filename characters');
  }
  return name;
}

/**
 * resolveImagePath — turn a sanitised filename into an absolute path that is
 * GUARANTEED to live under STORAGE_ROOT/images/.
 *
 * Two-layer defence:
 *  1. sanitizeFilename() rejects every dangerous character.
 *  2. resolve() + startsWith() verifies the resulting absolute path still
 *     begins with STORAGE_ROOT — catches edge cases the regex might miss
 *     (e.g. unicode normalisation tricks).
 */
export function resolveImagePath(filename: string): string {
  const safe = sanitizeFilename(filename);
  const resolved = resolve(STORAGE_ROOT, 'images', safe);
  if (!resolved.startsWith(STORAGE_ROOT + sep) && resolved !== STORAGE_ROOT) {
    throw new Error('Path escapes storage root');
  }
  return resolved;
}

/**
 * resolveThumbnailPath — same as resolveImagePath but for the thumbnails/
 * sibling directory.
 */
export function resolveThumbnailPath(filename: string): string {
  const safe = sanitizeFilename(filename);
  const resolved = resolve(STORAGE_ROOT, 'thumbnails', safe);
  if (!resolved.startsWith(STORAGE_ROOT + sep) && resolved !== STORAGE_ROOT) {
    throw new Error('Path escapes storage root');
  }
  return resolved;
}

/**
 * resolveSidecarPath — same as resolveImagePath but for the sidecar
 * `.json` metadata file (same directory, different extension).
 */
export function resolveSidecarPath(filename: string): string {
  const safe = sanitizeFilename(filename);
  // Replace the trailing extension with .json
  const sidecarName = safe.replace(/\.[^.]+$/, '.json');
  const resolved = resolve(STORAGE_ROOT, 'images', sidecarName);
  if (!resolved.startsWith(STORAGE_ROOT + sep) && resolved !== STORAGE_ROOT) {
    throw new Error('Path escapes storage root');
  }
  return resolved;
}
