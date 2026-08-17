/**
 * PhotosService unit tests — filesystem-first refactor (2026-05-28).
 *
 * Mocks StorageService + Prisma + InventoryRepository. No real filesystem,
 * no Sharp, no R2 — pure logic tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { PhotosService } from './photos.service';

function buildService(
  overrides: {
    prismaOverrides?: Record<string, unknown>;
    storageOverrides?: Record<string, unknown>;
    repoOverrides?: Record<string, unknown>;
  } = {},
) {
  const mockPrisma = {
    roomPhoto: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({
        id: 'photo-1',
        roomId: 'room-1',
        key: 'room_1735_a1b2c3d4.jpg',
        order: 0,
        contentType: 'image/jpeg',
        size: 12345,
      }),
      delete: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides.prismaOverrides,
  };

  const mockRepo = {
    findRoomById: vi.fn().mockResolvedValue({ id: 'room-1', number: '101' }),
    ...overrides.repoOverrides,
  };

  const mockStorage = {
    saveImage: vi.fn().mockResolvedValue({
      filename: 'room_1735_a1b2c3d4.jpg',
      publicUrl: '/images/room_1735_a1b2c3d4.jpg',
      thumbnailUrl: '/images/thumbnails/room_1735_a1b2c3d4_thumb.jpg',
      width: 1920,
      height: 1080,
      processedBytes: 12345,
    }),
    deleteImage: vi.fn().mockResolvedValue(undefined),
    ...overrides.storageOverrides,
  };

  return new PhotosService(mockPrisma as any, mockRepo as any, mockStorage as any);
}

describe('PhotosService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadPhoto', () => {
    it('throws NotFound when the room does not exist', async () => {
      const svc = buildService({
        repoOverrides: { findRoomById: vi.fn().mockResolvedValue(null) },
      });
      await expect(
        svc.uploadPhoto(
          'missing',
          { buffer: Buffer.from('x'), originalname: 'a.jpg', mimetype: 'image/jpeg' },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('wraps StorageService errors in BadRequestException', async () => {
      const svc = buildService({
        storageOverrides: {
          saveImage: vi.fn().mockRejectedValue(new Error('File exceeds 5MB limit')),
        },
      });
      await expect(
        svc.uploadPhoto(
          'room-1',
          { buffer: Buffer.alloc(0), originalname: 'a.jpg', mimetype: 'image/jpeg' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('persists with order=0 when the room has no prior photos', async () => {
      const svc = buildService();
      const res = await svc.uploadPhoto(
        'room-1',
        { buffer: Buffer.from('x'), originalname: 'a.jpg', mimetype: 'image/jpeg' },
        'user-7',
      );
      const prisma = (svc as any).prisma;
      expect(prisma.roomPhoto.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          roomId: 'room-1',
          key: 'room_1735_a1b2c3d4.jpg',
          order: 0,
          contentType: 'image/jpeg',
        }),
      });
      expect(res.url).toBe('/images/room_1735_a1b2c3d4.jpg');
    });

    it('persists with order = COUNT when the room has prior photos', async () => {
      const svc = buildService({
        prismaOverrides: {
          roomPhoto: {
            count: vi.fn().mockResolvedValue(3),
            create: vi.fn().mockResolvedValue({
              id: 'photo-4',
              roomId: 'room-1',
              key: 'room_1735_a1b2c3d4.jpg',
              order: 3,
              contentType: 'image/jpeg',
              size: 12345,
            }),
          },
        },
      });
      await svc.uploadPhoto(
        'room-1',
        { buffer: Buffer.from('x'), originalname: 'a.jpg', mimetype: 'image/jpeg' },
      );
      const prisma = (svc as any).prisma;
      expect(prisma.roomPhoto.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ order: 3 }),
      });
    });

    it('forwards uploaderId as context to StorageService', async () => {
      const svc = buildService();
      await svc.uploadPhoto(
        'room-1',
        { buffer: Buffer.from('x'), originalname: 'a.jpg', mimetype: 'image/jpeg' },
        'user-99',
      );
      const storage = (svc as any).storage;
      expect(storage.saveImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: 'room',
          uploadedBy: 'user-99',
          context: { type: 'room-photo', roomId: 'room-1' },
        }),
      );
    });
  });

  describe('deletePhoto', () => {
    it('throws NotFound when the id does not exist', async () => {
      const svc = buildService();
      await expect(svc.deletePhoto('missing')).rejects.toThrow(NotFoundException);
    });

    it('removes the disk artefacts and then the DB row', async () => {
      const deleteMock = vi.fn().mockResolvedValue({});
      const svc = buildService({
        prismaOverrides: {
          roomPhoto: {
            findUnique: vi.fn().mockResolvedValue({ id: 'p1', key: 'room_1_a.jpg' }),
            delete: deleteMock,
          },
        },
      });
      await svc.deletePhoto('p1');
      const storage = (svc as any).storage;
      expect(storage.deleteImage).toHaveBeenCalledWith('room_1_a.jpg');
      expect(deleteMock).toHaveBeenCalledWith({ where: { id: 'p1' } });
    });
  });

  describe('getPhotosForRoom', () => {
    it('returns photos with derived /images/<key> URLs', async () => {
      const svc = buildService({
        prismaOverrides: {
          roomPhoto: {
            findMany: vi.fn().mockResolvedValue([
              { id: 'a', key: 'room_1_a.jpg', order: 0 },
              { id: 'b', key: 'room_2_b.jpg', order: 1 },
            ]),
          },
        },
      });
      const res = await svc.getPhotosForRoom('room-1');
      expect(res).toEqual([
        { id: 'a', url: '/images/room_1_a.jpg', order: 0 },
        { id: 'b', url: '/images/room_2_b.jpg', order: 1 },
      ]);
    });
  });
});
