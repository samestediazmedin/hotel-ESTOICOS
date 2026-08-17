import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * GuestEncryptionService — AES-256-GCM application-layer encryption
 * for guest documentNumber field.
 *
 * Key management:
 *  - GUEST_ENCRYPTION_KEY env var: 64 hex chars = 32 bytes = 256 bits
 *  - Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *  - Key NEVER leaves the application process (not passed to DB)
 *
 * Ciphertext format: "iv:tag:ciphertext" (all segments base64-encoded)
 *  - iv: 12 random bytes (GCM recommended IV length)
 *  - tag: 16-byte AEAD auth tag (tamper detection)
 *  - ciphertext: encrypted plaintext bytes
 *
 * SECURITY: Fail-fast on startup if key is missing or malformed —
 * prevents silent plaintext storage.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM recommended IV length in bytes
const TAG_LENGTH = 16; // GCM auth tag length in bytes

@Injectable()
export class GuestEncryptionService {
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    // getOrThrow propagates ConfigService's own error if env var is missing
    const rawKey = this.config.getOrThrow<string>('GUEST_ENCRYPTION_KEY');
    this.key = Buffer.from(rawKey, 'hex');
    // Key must be exactly 32 bytes (256 bits) — hex encodes as 64 chars
    if (this.key.length !== 32) {
      throw new Error(
        `GUEST_ENCRYPTION_KEY must be 64 hex characters (32 bytes). ` +
          `Got ${this.key.length} bytes. ` +
          `Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
      );
    }
  }

  /**
   * Encrypt a plaintext string using AES-256-GCM.
   * Each call generates a fresh random IV — identical plaintexts produce
   * different ciphertexts (semantic security).
   *
   * @returns "iv:tag:ciphertext" (base64 segments joined by colons)
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv, {
      authTagLength: TAG_LENGTH,
    });
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      iv.toString('base64'),
      tag.toString('base64'),
      encrypted.toString('base64'),
    ].join(':');
  }

  /**
   * Decrypt a ciphertext produced by encrypt().
   * Throws if the auth tag does not match (tampering detected) or
   * if the ciphertext format is invalid.
   *
   * @param ciphertext "iv:tag:ciphertext" (base64 segments)
   * @returns Original plaintext string
   */
  decrypt(ciphertext: string): string {
    const [ivB64, tagB64, encB64] = ciphertext.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const encrypted = Buffer.from(encB64, 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv, {
      authTagLength: TAG_LENGTH,
    });
    decipher.setAuthTag(tag);
    return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
  }
}
