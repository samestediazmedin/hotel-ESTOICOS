/**
 * HotelPhotosService unit tests — filesystem-first refactor (2026-05-28).
 *
 * Mocks StorageService + Prisma. No real filesystem, no Sharp, no R2.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { HotelPhotosService } from './hotel-photos.service';

function buildService(
  overrides: {
    prismaOverrides?: Record<string, unknown>;
    storageOverrides?: Record<string, unknown>;
  } = {},
) {
  const mockPrisma = {
    hotelPhoto: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      aggregate: vi.fn().mockResolvedValue({ _max: { displayOrder: null } }),
      create: vi.fn().mockResolvedValue({
        id: 'photo-1',
        url: '',
        key: 'hotel_1735_a1b2c3d4.jpg',
        alt: '',
        displayOrder: 0,
      }),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn().mockResolvedValue([]),
    ...overrides.prismaOverrides,
  };

  const mockStorage = {
    saveImage: vi.fn().mockResolvedValue({
      filename: 'hotel_1735_a1b2c3d4.jpg',
      publicUrl: '/images/hotel_1735_a1b2c3d4.jpg',
      thumbnailUrl: '/images/thumbnails/hotel_1735_a1b2c3d4_thumb.jpg',
      width: 1920,
      height: 1080,
      processedBytes: 12345,
    }),
    deleteImage: vi.fn().mockResolvedValue(undefined),
    ...overrides.storageOverrides,
  };

  return new HotelPhotosService(mockPrisma as any, mockStorage as any);
}

describe('HotelPhotosService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listPhotos', () => {
    it('returns /images/<key> for storage-managed rows', async () => {
      const svc = buildService({
        prismaOverrides: {
          hotelPhoto: {
            findMany: vi.fn().mockResolvedValue([
              { id: 'p1', url: '', key: 'hotel_1_a.jpg', alt: 'Pool', displayOrder: 0 },
            ]),
          },
        },
      });
      const results = await svc.listPhotos();
      expect(results[0].url).toBe('/images/hotel_1_a.jpg');
    });

    it('falls back to stored url for legacy seed rows (key=null)', async () => {
      const svc = buildService({
        prismaOverrides: {
          hotelPhoto: {
            findMany: vi.fn().mockResolvedValue([
              {
                id: 'p2',
                url: 'https://images.unsplash.com/legacy.jpg',
                key: null,
                alt: 'Lobby',
                displayOrder: 1,
              },
            ]),
          },
        },
      });
      const results = await svc.listPhotos();
      expect(results[0].url).toBe('https://images.unsplash.com/legacy.jpg');
    });
  });

  describe('uploadPhoto', () => {
    it('persists and returns /images/<key> URL', async () => {
      const svc = buildService();
      const res = await svc.uploadPhoto(
        { buffer: Buffer.from('x'), originalname: 'a.jpg', mimetype: 'image/jpeg' },
        'Lobby photo',
        'user-1',
      );
      expect(res.url).toBe('/images/hotel_1735_a1b2c3d4.jpg');
      const prisma = (svc as any).prisma;
      expect(prisma.hotelPhoto.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          key: 'hotel_1735_a1b2c3d4.jpg',
          alt: 'Lobby photo',
          displayOrder: 0,
          url: '',
        }),
      });
    });

    it('uses displayOrder = MAX + 1 when gallery is non-empty', async () => {
      const svc = buildService({
        prismaOverrides: {
          hotelPhoto: {
            aggregate: vi.fn().mockResolvedValue({ _max: { displayOrder: 4 } }),
            create: vi.fn().mockResolvedValue({
              id: 'photo-5',
              url: '',
              key: 'hotel_5_e.jpg',
              alt: '',
              displayOrder: 5,
            }),
          },
        },
      });
      await svc.uploadPhoto(
        { buffer: Buffer.from('x'), originalname: 'a.jpg', mimetype: 'image/jpeg' },
        undefined,
        undefined,
      );
      const prisma = (svc as any).prisma;
      expect(prisma.hotelPhoto.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ displayOrder: 5 }),
      });
    });

    it('wraps StorageService errors in BadRequestException', async () => {
      const svc = buildService({
        storageOverrides: {
          saveImage: vi.fn().mockRejectedValue(new Error('File exceeds 5MB limit')),
        },
      });
      await expect(
        svc.uploadPhoto(
          { buffer: Buffer.alloc(0), originalname: 'a.jpg', mimetype: 'image/jpeg' },
          undefined,
          undefined,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deletePhoto', () => {
    it('throws NotFound when id does not exist', async () => {
      const svc = buildService();
      await expect(svc.deletePhoto('missing')).rejects.toThrow(NotFoundException);
    });

    it('deletes from storage and DB when row has a key', async () => {
      const deleteMock = vi.fn().mockResolvedValue({});
      const svc = buildService({
        prismaOverrides: {
          hotelPhoto: {
            findUnique: vi.fn().mockResolvedValue({ id: 'p1', key: 'hotel_1_a.jpg', url: '' }),
            delete: deleteMock,
          },
        },
      });
      await svc.deletePhoto('p1');
      const storage = (svc as any).storage;
      expect(storage.deleteImage).toHaveBeenCalledWith('hotel_1_a.jpg');
      expect(deleteMock).toHaveBeenCalledWith({ where: { id: 'p1' } });
    });

    it('skips storage delete for legacy rows with key=null', async () => {
      const deleteMock = vi.fn().mockResolvedValue({});
      const svc = buildService({
        prismaOverrides: {
          hotelPhoto: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'p1',
              key: null,
              url: 'https://images.unsplash.com/legacy.jpg',
            }),
            delete: deleteMock,
          },
        },
      });
      await svc.deletePhoto('p1');
      const storage = (svc as any).storage;
      expect(storage.deleteImage).not.toHaveBeenCalled();
      expect(deleteMock).toHaveBeenCalledWith({ where: { id: 'p1' } });
    });
  });

  describe('reorderPhotos', () => {
    it('runs all updates inside one transaction with index-based ordering', async () => {
      const svc = buildService();
      await svc.reorderPhotos(['a', 'b', 'c']);
      const prisma = (svc as any).prisma;
      expect(prisma.$transaction).toHaveBeenCalledOnce();
      const calls = prisma.hotelPhoto.update.mock.calls;
      expect(calls).toEqual([
        [{ where: { id: 'a' }, data: { displayOrder: 0 } }],
        [{ where: { id: 'b' }, data: { displayOrder: 1 } }],
        [{ where: { id: 'c' }, data: { displayOrder: 2 } }],
      ]);
    });
  });
});
