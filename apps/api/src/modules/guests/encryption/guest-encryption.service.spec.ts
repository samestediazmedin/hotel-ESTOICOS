import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GuestEncryptionService } from './guest-encryption.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** 64 hex chars = 32 bytes — valid AES-256 key */
const VALID_KEY = 'a'.repeat(64);

/** Build a module with a ConfigService that returns the given key */
async function buildModule(getOrThrowValue: string | (() => string)): Promise<GuestEncryptionService> {
  const getOrThrow = vi.fn();
  if (typeof getOrThrowValue === 'function') {
    getOrThrow.mockImplementation(getOrThrowValue);
  } else {
    getOrThrow.mockReturnValue(getOrThrowValue);
  }

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      GuestEncryptionService,
      {
        provide: ConfigService,
        useValue: { getOrThrow },
      },
    ],
  }).compile();

  return module.get(GuestEncryptionService);
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('GuestEncryptionService', () => {
  let service: GuestEncryptionService;

  beforeEach(async () => {
    service = await buildModule(VALID_KEY);
  });

  // ── Test 1: format iv:tag:ciphertext ──────────────────────────────────────

  it('Test 1 — encrypt() returns "iv:tag:ciphertext" (three base64 segments)', () => {
    const result = service.encrypt('CC-1020304050');
    const parts = result.split(':');
    expect(parts).toHaveLength(3);
    // Each segment must be non-empty base64
    for (const part of parts) {
      expect(part.length).toBeGreaterThan(0);
      // base64 characters only (including = padding)
      expect(part).toMatch(/^[A-Za-z0-9+/=]+$/);
    }
  });

  // ── Test 2: round-trip identity ───────────────────────────────────────────

  it('Test 2 — decrypt(encrypt(plaintext)) === plaintext (round-trip)', () => {
    const plaintext = 'CC-1020304050';
    const ciphertext = service.encrypt(plaintext);
    const decrypted = service.decrypt(ciphertext);
    expect(decrypted).toBe(plaintext);
  });

  // ── Test 3: random IV — two encryptions differ ────────────────────────────

  it('Test 3 — encrypt called twice produces different ciphertexts (random IV)', () => {
    const c1 = service.encrypt('foo');
    const c2 = service.encrypt('foo');
    expect(c1).not.toBe(c2);
  });

  // ── Test 4: tampered ciphertext throws (AEAD auth tag) ───────────────────

  it('Test 4 — decrypting tampered ciphertext throws (AEAD auth tag enforcement)', () => {
    const ciphertext = service.encrypt('CC-1020304050');
    const parts = ciphertext.split(':');
    // Decode the auth tag, XOR the first byte, re-encode
    // This guarantees a real byte-level change that GCM will detect
    const tagBuf = Buffer.from(parts[1], 'base64');
    tagBuf[0] = tagBuf[0] ^ 0xff; // flip all bits in first byte
    const tamperedTag = tagBuf.toString('base64');
    const tampered = [parts[0], tamperedTag, parts[2]].join(':');
    expect(() => service.decrypt(tampered)).toThrow();
  });

  // ── Test 5: short key throws '64 hex' message ────────────────────────────

  it("Test 5 — constructor throws with '64 hex' message for short key", async () => {
    await expect(buildModule('abcd')).rejects.toThrow(/64 hex/i);
  });

  // ── Test 6: missing env var propagates ConfigService.getOrThrow error ─────

  it('Test 6 — constructor throws when GUEST_ENCRYPTION_KEY is missing (getOrThrow propagates)', async () => {
    const throwingGetOrThrow = () => {
      throw new Error('Config key "GUEST_ENCRYPTION_KEY" does not exist');
    };
    await expect(buildModule(throwingGetOrThrow)).rejects.toThrow(
      'GUEST_ENCRYPTION_KEY',
    );
  });
});
