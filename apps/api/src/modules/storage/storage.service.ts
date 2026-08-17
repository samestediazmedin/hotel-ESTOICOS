import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as crypto from 'node:crypto';
import { extname, basename } from 'node:path';
import sharp from 'sharp';
import {
  STORAGE_ROOT,
  resolveImagePath,
  resolveThumbnailPath,
  resolveSidecarPath,
} from './safe-path';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — matches the previous R2 cap
const THUMB_WIDTH = 400;
const THUMB_HEIGHT = 300;

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
]);

export interface SaveImageInput {
  /** Original buffer from the multipart upload (multer.memoryStorage). */
  buffer: Buffer;
  /** Original client-supplied filename (used only inside sidecar metadata). */
  originalFilename: string;
  /** Original MIME type from the multipart Content-Type. */
  contentType: string;
  /** Context prefix for the filename (e.g. "offer", "room", "hotel"). */
  prefix: string;
  /** Optional arbitrary metadata to embed in the sidecar JSON. */
  context?: Record<string, unknown>;
  /** Optional user id of the uploader (also embedded in sidecar). */
  uploadedBy?: string | null;
}

export interface SaveImageResult {
  filename: string;
  publicUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  processedBytes: number;
}

/**
 * StorageService — filesystem-first image storage (2026-05-28).
 *
 * Replaces the previous S3/R2 presigned-URL pipeline with direct filesystem
 * writes under STORAGE_ROOT (Railway Volume mounted at /app/storage in prod).
 *
 * Each image stores three artefacts:
 *  1. images/<filename>.jpg   — processed binary (Sharp: rotate + JPEG mozjpeg q85)
 *  2. images/<filename>.json  — sidecar metadata (timestamps, context, dimensions)
 *  3. thumbnails/<filename>_thumb.jpg — auto-generated 400×300 cover crop
 *
 * Filename pattern: `<prefix>_<timestampMs>_<8hex>.jpg`
 * - prefix: free-form context tag (offer, room, hotel, avatar)
 * - timestampMs: epoch ms for cheap chronological sort
 * - 8hex: 4 random bytes (URLs are not enumerable)
 *
 * Public URLs are served by the API container via express.static under
 * GET /images/* with a 7-day immutable Cache-Control header — safe because
 * the filename hash makes the URL stable.
 *
 * SECURITY: all filename operations go through `sanitizeFilename` +
 * `resolveImagePath` (in ./safe-path.ts) to prevent path traversal.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);

  async onModuleInit(): Promise<void> {
    // Ensure the storage tree exists on first boot. Idempotent — fine in dev
    // and on a fresh Railway Volume mount.
    await fs.mkdir(`${STORAGE_ROOT}/images`, { recursive: true });
    await fs.mkdir(`${STORAGE_ROOT}/thumbnails`, { recursive: true });
    this.logger.log(`Storage root ready at ${STORAGE_ROOT}`);
  }

  /**
   * generateFilename — `<prefix>_<timestampMs>_<8hex>.jpg`
   *
   * `.jpg` is always the final extension because Sharp normalises every input
   * to JPEG. Saving as `.png` after Sharp would be misleading.
   */
  generateFilename(prefix: string): string {
    const safePrefix = prefix.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 20) || 'img';
    const ts = Date.now();
    const shortHash = crypto.randomBytes(4).toString('hex');
    return `${safePrefix}_${ts}_${shortHash}.jpg`;
  }

  /**
   * saveImage — full upload pipeline.
   *
   * Steps:
   *  1. Validate size + MIME
   *  2. Process via Sharp: rotate() (respect EXIF) → JPEG mozjpeg q85
   *  3. Resize to thumbnail 400×300 cover-crop
   *  4. Write binary + sidecar JSON + thumbnail
   *  5. Return public URLs (server-relative — frontend prepends API host)
   */
  async saveImage(input: SaveImageInput): Promise<SaveImageResult> {
    if (input.buffer.length === 0) {
      throw new Error('Empty file');
    }
    if (input.buffer.length > MAX_BYTES) {
      throw new Error('File exceeds 5MB limit');
    }
    if (!ALLOWED_MIME.has(input.contentType.toLowerCase())) {
      throw new Error(`Unsupported MIME type: ${input.contentType}`);
    }

    const filename = this.generateFilename(input.prefix);
    const imagePath = resolveImagePath(filename);

    // Step 1: process to JPEG with EXIF-correct rotation
    const processed = await sharp(input.buffer)
      .rotate() // honour EXIF orientation tag
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();

    const meta = await sharp(processed).metadata();

    // Step 2: thumbnail
    const thumbFilename = filename.replace(/\.jpg$/, '_thumb.jpg');
    const thumbPath = resolveThumbnailPath(thumbFilename);
    await sharp(processed)
      .resize(THUMB_WIDTH, THUMB_HEIGHT, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toFile(thumbPath);

    // Step 3: binary + sidecar (write image first, then sidecar — partial
    // failure leaves no orphan sidecar without a binary).
    await fs.writeFile(imagePath, processed);
    const sidecarPath = resolveSidecarPath(filename);
    const sidecar = {
      id: basename(filename, '.jpg'),
      createdAt: new Date().toISOString(),
      uploadedBy: input.uploadedBy ?? null,
      context: input.context ?? {},
      original: {
        filename: input.originalFilename,
        sizeBytes: input.buffer.length,
        mimeType: input.contentType,
      },
      processed: {
        width: meta.width ?? null,
        height: meta.height ?? null,
        mimeType: 'image/jpeg',
        sizeBytes: processed.length,
        thumbnail: `thumbnails/${thumbFilename}`,
      },
    };
    await fs.writeFile(sidecarPath, JSON.stringify(sidecar, null, 2), 'utf8');

    return {
      filename,
      publicUrl: `/images/${filename}`,
      thumbnailUrl: `/images/thumbnails/${thumbFilename}`,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      processedBytes: processed.length,
    };
  }

  /**
   * deleteImage — best-effort cleanup of binary + sidecar + thumbnail.
   *
   * Never throws — logs and continues. Callers (services that own the DB row)
   * MUST still delete the DB row regardless of disk-side outcome. Orphans on
   * disk are acceptable.
   */
  async deleteImage(filename: string): Promise<void> {
    try {
      const imagePath = resolveImagePath(filename);
      await this.tryUnlink(imagePath);

      const sidecarPath = resolveSidecarPath(filename);
      await this.tryUnlink(sidecarPath);

      const thumbFilename = filename.replace(/\.jpg$/, '_thumb.jpg');
      const thumbPath = resolveThumbnailPath(thumbFilename);
      await this.tryUnlink(thumbPath);
    } catch (err) {
      // sanitizeFilename rejected — silently ignore (defensive: don't crash
      // the delete flow on a malformed filename).
      this.logger.warn(
        `deleteImage skipped for "${filename}": ${(err as Error).message}`,
      );
    }
  }

  /**
   * imageExists — used by tests and by the controller as a defensive check.
   */
  async imageExists(filename: string): Promise<boolean> {
    try {
      const imagePath = resolveImagePath(filename);
      await fs.access(imagePath);
      return true;
    } catch {
      return false;
    }
  }

  private async tryUnlink(path: string): Promise<void> {
    try {
      await fs.unlink(path);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        this.logger.warn(`Failed to unlink ${basename(path)}: ${(err as Error).message}`);
      }
    }
  }
}
