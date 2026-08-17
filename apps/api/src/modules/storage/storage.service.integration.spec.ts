/**
 * StorageService integration tests.
 *
 * These hit the real filesystem (and the real Sharp pipeline) so we know
 * the wiring works end-to-end before relying on it in production. The tests
 * use a temporary STORAGE_DIR scoped per-process so they never collide with
 * the dev or prod tree.
 *
 * IMPORTANT: STORAGE_DIR must be set BEFORE safe-path.ts is loaded because
 * STORAGE_ROOT is captured at module load. We use vi.hoisted() so the
 * assignment runs before the static import below.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import sharp from 'sharp';

const env = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const osMod = require('node:os');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pathMod = require('node:path');
  const tmpRoot = pathMod.join(
    osMod.tmpdir(),
    `hos-storage-test-${process.pid}-${Date.now()}`,
  );
  process.env.STORAGE_DIR = tmpRoot;
  return { tmpRoot };
});

// Static import resolves AFTER vi.hoisted has set STORAGE_DIR.
import { StorageService } from './storage.service';

const { tmpRoot } = env;

describe('StorageService — integration', () => {
  let svc: StorageService;
  let testJpegBuffer: Buffer;

  beforeAll(async () => {
    svc = new StorageService();
    await svc.onModuleInit();
    testJpegBuffer = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 200, g: 50, b: 50 } },
    })
      .jpeg()
      .toBuffer();
  });

  afterAll(async () => {
    try {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('initialises the storage tree on module init', async () => {
    const stat1 = await fs.stat(path.join(tmpRoot, 'images'));
    const stat2 = await fs.stat(path.join(tmpRoot, 'thumbnails'));
    expect(stat1.isDirectory()).toBe(true);
    expect(stat2.isDirectory()).toBe(true);
  });

  it('saveImage writes binary + sidecar + thumbnail and returns server-relative URLs', async () => {
    const result = await svc.saveImage({
      buffer: testJpegBuffer,
      originalFilename: 'redbox.jpg',
      contentType: 'image/jpeg',
      prefix: 'test',
      uploadedBy: 'user-1',
      context: { type: 'integration-test' },
    });

    expect(result.filename).toMatch(/^test_\d+_[0-9a-f]{8}\.jpg$/);
    expect(result.publicUrl).toBe(`/images/${result.filename}`);
    expect(result.thumbnailUrl).toMatch(
      /^\/images\/thumbnails\/test_\d+_[0-9a-f]{8}_thumb\.jpg$/,
    );
    expect(result.width).toBe(100);
    expect(result.height).toBe(100);
    expect(result.processedBytes).toBeGreaterThan(0);

    const binaryPath = path.join(tmpRoot, 'images', result.filename);
    const binaryStat = await fs.stat(binaryPath);
    expect(binaryStat.size).toBe(result.processedBytes);

    const sidecarPath = binaryPath.replace(/\.jpg$/, '.json');
    const sidecarText = await fs.readFile(sidecarPath, 'utf8');
    const sidecar = JSON.parse(sidecarText);
    expect(sidecar.id).toBe(result.filename.replace(/\.jpg$/, ''));
    expect(sidecar.uploadedBy).toBe('user-1');
    expect(sidecar.context).toEqual({ type: 'integration-test' });
    expect(sidecar.original.filename).toBe('redbox.jpg');
    expect(sidecar.processed.mimeType).toBe('image/jpeg');
    expect(sidecar.processed.width).toBe(100);

    const thumbName = result.filename.replace(/\.jpg$/, '_thumb.jpg');
    const thumbPath = path.join(tmpRoot, 'thumbnails', thumbName);
    const thumbStat = await fs.stat(thumbPath);
    expect(thumbStat.size).toBeGreaterThan(0);
    const thumbMeta = await sharp(thumbPath).metadata();
    expect(thumbMeta.width).toBe(400);
    expect(thumbMeta.height).toBe(300);
  });

  it('rejects files over the 5 MB cap', async () => {
    const bigBuffer = Buffer.alloc(5 * 1024 * 1024 + 1, 0);
    await expect(
      svc.saveImage({
        buffer: bigBuffer,
        originalFilename: 'huge.jpg',
        contentType: 'image/jpeg',
        prefix: 'test',
      }),
    ).rejects.toThrow(/5MB/);
  });

  it('rejects empty buffers', async () => {
    await expect(
      svc.saveImage({
        buffer: Buffer.alloc(0),
        originalFilename: 'empty.jpg',
        contentType: 'image/jpeg',
        prefix: 'test',
      }),
    ).rejects.toThrow(/Empty/);
  });

  it('rejects unsupported MIME types', async () => {
    await expect(
      svc.saveImage({
        buffer: testJpegBuffer,
        originalFilename: 'foo.gif',
        contentType: 'image/gif',
        prefix: 'test',
      }),
    ).rejects.toThrow(/Unsupported MIME/);
  });

  it('deleteImage removes binary + sidecar + thumbnail', async () => {
    const result = await svc.saveImage({
      buffer: testJpegBuffer,
      originalFilename: 'todelete.jpg',
      contentType: 'image/jpeg',
      prefix: 'test',
    });

    await svc.deleteImage(result.filename);

    const binaryPath = path.join(tmpRoot, 'images', result.filename);
    const sidecarPath = binaryPath.replace(/\.jpg$/, '.json');
    const thumbPath = path.join(
      tmpRoot,
      'thumbnails',
      result.filename.replace(/\.jpg$/, '_thumb.jpg'),
    );

    await expect(fs.access(binaryPath)).rejects.toThrow();
    await expect(fs.access(sidecarPath)).rejects.toThrow();
    await expect(fs.access(thumbPath)).rejects.toThrow();
  });

  it('deleteImage is idempotent (does not throw on already-gone files)', async () => {
    await expect(svc.deleteImage('test_0_deadbeef.jpg')).resolves.toBeUndefined();
  });

  it('deleteImage swallows traversal attempts without crashing', async () => {
    await expect(svc.deleteImage('../etc/passwd')).resolves.toBeUndefined();
  });

  it('imageExists returns true for a saved image and false for a missing one', async () => {
    const r = await svc.saveImage({
      buffer: testJpegBuffer,
      originalFilename: 'exists.jpg',
      contentType: 'image/jpeg',
      prefix: 'test',
    });
    expect(await svc.imageExists(r.filename)).toBe(true);
    expect(await svc.imageExists('test_99999_ffffffff.jpg')).toBe(false);
  });

  it('processes EXIF-rotated source and outputs upright JPEG', async () => {
    const rotated = await sharp({
      create: { width: 200, height: 100, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

    const result = await svc.saveImage({
      buffer: rotated,
      originalFilename: 'rotated.jpg',
      contentType: 'image/jpeg',
      prefix: 'test',
    });
    // After .rotate() Sharp normalises so the displayed orientation = 1.
    // Source was 200x100 with orientation=6 (90° CW), which after rotate
    // becomes 100x200 (width and height swap).
    expect(result.width).toBe(100);
    expect(result.height).toBe(200);
  });

  it('generateFilename strips unsafe chars from prefix', () => {
    const name = svc.generateFilename('off er/../$malicious');
    expect(name).toMatch(/^[a-zA-Z0-9-]+_\d+_[0-9a-f]{8}\.jpg$/);
    expect(name).not.toContain('/');
    expect(name.startsWith('offer')).toBe(true);
  });
});
