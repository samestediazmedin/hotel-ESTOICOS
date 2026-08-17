/**
 * OffersService unit tests.
 *
 * 2026-05-28 — Rewritten for the filesystem-first storage pipeline.
 * Mocks StorageService instead of @aws-sdk/client-s3. No R2 / S3 / network
 * dependency — pure logic + Prisma stubs.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { OffersService } from './offers.service';
import { CreateOfferSchema } from './dto/create-offer.dto';

// ─── Factory helper ───────────────────────────────────────────────────────────

/** Minimal stub for an Offer row returned by Prisma (no relation). */
const OFFER_STUB = {
  id: 'offer-1',
  title: 'Test',
  description: null,
  imageKey: 'offer_1735393856123_a1b2c3d4.jpg',
  badge: null,
  validFrom: null,
  validTo: null,
  ctaText: null,
  ctaLink: null,
  isActive: true,
  displayOrder: 0,
  roomTypeId: null,
  roomType: null,
  createdAt: new Date('2026-05-28T12:00:00.000Z'),
  updatedAt: new Date('2026-05-28T12:00:00.000Z'),
};

function buildService(
  overrides: {
    prismaOverrides?: Record<string, unknown>;
    storageOverrides?: Record<string, unknown>;
  } = {},
) {
  const mockPrisma = {
    offer: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      aggregate: vi.fn().mockResolvedValue({ _max: { displayOrder: null } }),
      create: vi.fn().mockResolvedValue({ ...OFFER_STUB }),
      update: vi.fn().mockResolvedValue({ ...OFFER_STUB }),
      delete: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn().mockResolvedValue([]),
    ...overrides.prismaOverrides,
  };

  const mockStorage = {
    saveImage: vi.fn().mockResolvedValue({
      filename: 'offer_1735393856123_a1b2c3d4.jpg',
      publicUrl: '/images/offer_1735393856123_a1b2c3d4.jpg',
      thumbnailUrl: '/images/thumbnails/offer_1735393856123_a1b2c3d4_thumb.jpg',
      width: 1920,
      height: 1080,
      processedBytes: 287340,
    }),
    deleteImage: vi.fn().mockResolvedValue(undefined),
    imageExists: vi.fn().mockResolvedValue(true),
    generateFilename: vi.fn().mockReturnValue('offer_1735393856123_a1b2c3d4.jpg'),
    ...overrides.storageOverrides,
  };

  return new OffersService(mockPrisma as any, mockStorage as any);
}

describe('OffersService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── persistUpload ─────────────────────────────────────────────────────────

  describe('persistUpload', () => {
    it('delegates to StorageService.saveImage with prefix="offer" and returns the filename', async () => {
      const svc = buildService();
      const result = await svc.persistUpload({
        buffer: Buffer.from('fake-jpg-bytes'),
        originalname: 'promo.jpg',
        mimetype: 'image/jpeg',
      });
      expect(result).toBe('offer_1735393856123_a1b2c3d4.jpg');
      const storage = (svc as any).storage;
      expect(storage.saveImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: 'offer',
          originalFilename: 'promo.jpg',
          contentType: 'image/jpeg',
          context: { type: 'offer-image' },
        }),
      );
    });

    it('wraps StorageService errors in BadRequestException', async () => {
      const svc = buildService({
        storageOverrides: {
          saveImage: vi.fn().mockRejectedValue(new Error('File exceeds 5MB limit')),
        },
      });
      await expect(
        svc.persistUpload({
          buffer: Buffer.alloc(0),
          originalname: 'x.jpg',
          mimetype: 'image/jpeg',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── createOffer ──────────────────────────────────────────────────────────

  describe('createOffer', () => {
    it('rejects when validTo < validFrom', async () => {
      const svc = buildService();
      await expect(
        svc.createOffer({
          title: 'Promo',
          imageKey: 'offer_1_a.jpg',
          validFrom: '2026-06-01',
          validTo: '2026-05-01',
          isActive: true,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('persists offer with displayOrder=0 when table is empty', async () => {
      const svc = buildService();
      await svc.createOffer({
        title: 'Promo 1',
        imageKey: 'offer_1_a.jpg',
        isActive: true,
      } as any);
      const prisma = (svc as any).prisma;
      expect(prisma.offer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Promo 1',
            imageKey: 'offer_1_a.jpg',
            displayOrder: 0,
            isActive: true,
          }),
        }),
      );
    });

    it('persists offer with displayOrder=MAX+1 when other offers exist', async () => {
      const svc = buildService({
        prismaOverrides: {
          offer: {
            findMany: vi.fn().mockResolvedValue([]),
            findUnique: vi.fn().mockResolvedValue(null),
            aggregate: vi.fn().mockResolvedValue({ _max: { displayOrder: 4 } }),
            create: vi.fn().mockResolvedValue({
              ...OFFER_STUB,
              id: 'offer-5',
              title: 'Promo 5',
              imageKey: 'offer_5_e.jpg',
              displayOrder: 5,
            }),
          },
        },
      });
      await svc.createOffer({
        title: 'Promo 5',
        imageKey: 'offer_5_e.jpg',
        isActive: true,
      } as any);
      const prisma = (svc as any).prisma;
      expect(prisma.offer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ displayOrder: 5 }),
        }),
      );
    });

    it('returns response DTO with /images/<filename> imageUrl + ISO date strings', async () => {
      const svc = buildService({
        prismaOverrides: {
          offer: {
            findMany: vi.fn().mockResolvedValue([]),
            findUnique: vi.fn().mockResolvedValue(null),
            aggregate: vi.fn().mockResolvedValue({ _max: { displayOrder: null } }),
            create: vi.fn().mockResolvedValue({
              ...OFFER_STUB,
              id: 'o-1',
              title: 'Promo',
              description: 'desc',
              imageKey: 'offer_1735393856123_a1b2c3d4.jpg',
              badge: '-20%',
              validFrom: new Date('2026-06-01T00:00:00.000Z'),
              validTo: new Date('2026-08-31T00:00:00.000Z'),
              ctaText: 'Reservar',
            }),
          },
        },
      });
      const result = await svc.createOffer({
        title: 'Promo',
        imageKey: 'offer_1735393856123_a1b2c3d4.jpg',
        isActive: true,
      } as any);
      expect(result.imageUrl).toBe('/images/offer_1735393856123_a1b2c3d4.jpg');
      expect(result.validFrom).toBe('2026-06-01');
      expect(result.validTo).toBe('2026-08-31');
      expect(result.createdAt).toBe('2026-05-28T12:00:00.000Z');
    });
  });

  // ─── updateOffer ──────────────────────────────────────────────────────────

  describe('updateOffer', () => {
    it('throws NotFound when id does not exist', async () => {
      const svc = buildService();
      await expect(
        svc.updateOffer('missing', { title: 'New' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects merged validTo < merged validFrom (mixed update)', async () => {
      const svc = buildService({
        prismaOverrides: {
          offer: {
            findUnique: vi.fn().mockResolvedValue({
              ...OFFER_STUB,
              id: 'o-1',
              imageKey: 'offer_1_a.jpg',
              validFrom: new Date('2026-06-01T00:00:00.000Z'),
              validTo: new Date('2026-08-31T00:00:00.000Z'),
            }),
            update: vi.fn(),
          },
        },
      });
      await expect(
        svc.updateOffer('o-1', { validTo: '2026-05-15' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('deletes previous image file when imageKey changes', async () => {
      const svc = buildService({
        prismaOverrides: {
          offer: {
            findUnique: vi.fn().mockResolvedValue({
              ...OFFER_STUB,
              id: 'o-1',
              imageKey: 'offer_OLD_a.jpg',
            }),
            update: vi.fn().mockResolvedValue({
              ...OFFER_STUB,
              id: 'o-1',
              imageKey: 'offer_NEW_b.jpg',
            }),
          },
        },
      });
      await svc.updateOffer('o-1', { imageKey: 'offer_NEW_b.jpg' } as any);
      const storage = (svc as any).storage;
      expect(storage.deleteImage).toHaveBeenCalledWith('offer_OLD_a.jpg');
    });

    it('does NOT delete the previous image when imageKey is unchanged', async () => {
      const svc = buildService({
        prismaOverrides: {
          offer: {
            findUnique: vi.fn().mockResolvedValue({
              ...OFFER_STUB,
              id: 'o-1',
              imageKey: 'offer_SAME_a.jpg',
            }),
            update: vi.fn().mockResolvedValue({
              ...OFFER_STUB,
              id: 'o-1',
              title: 'New title',
              imageKey: 'offer_SAME_a.jpg',
            }),
          },
        },
      });
      await svc.updateOffer('o-1', { title: 'New title' } as any);
      const storage = (svc as any).storage;
      expect(storage.deleteImage).not.toHaveBeenCalled();
    });
  });

  // ─── deleteOffer ──────────────────────────────────────────────────────────

  describe('deleteOffer', () => {
    it('throws NotFound when id does not exist', async () => {
      const svc = buildService();
      await expect(svc.deleteOffer('missing')).rejects.toThrow(NotFoundException);
    });

    it('deletes both the image file and the DB row', async () => {
      const deletePrisma = vi.fn().mockResolvedValue({});
      const svc = buildService({
        prismaOverrides: {
          offer: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'o-1',
              imageKey: 'offer_1_a.jpg',
            }),
            delete: deletePrisma,
          },
        },
      });
      await svc.deleteOffer('o-1');
      const storage = (svc as any).storage;
      expect(storage.deleteImage).toHaveBeenCalledWith('offer_1_a.jpg');
      expect(deletePrisma).toHaveBeenCalledWith({ where: { id: 'o-1' } });
    });
  });

  // ─── listForPublic ────────────────────────────────────────────────────────

  describe('listForPublic', () => {
    it('queries with isActive=true and date-range filters', async () => {
      const svc = buildService();
      await svc.listForPublic();
      const prisma = (svc as any).prisma;
      const args = prisma.offer.findMany.mock.calls[0][0];
      expect(args.where).toMatchObject({ isActive: true });
      expect(args.where.AND).toBeInstanceOf(Array);
      expect(args.where.AND.length).toBe(2);
      expect(args.orderBy).toEqual([
        { displayOrder: 'asc' },
        { createdAt: 'asc' },
      ]);
    });
  });

  // ─── reorderOffers ────────────────────────────────────────────────────────

  describe('reorderOffers', () => {
    it('runs all updates in a single transaction with index-based ordering', async () => {
      const svc = buildService();
      await svc.reorderOffers(['a', 'b', 'c']);
      const prisma = (svc as any).prisma;
      expect(prisma.$transaction).toHaveBeenCalledOnce();
      const calls = prisma.offer.update.mock.calls;
      expect(calls).toEqual([
        [{ where: { id: 'a' }, data: { displayOrder: 0 } }],
        [{ where: { id: 'b' }, data: { displayOrder: 1 } }],
        [{ where: { id: 'c' }, data: { displayOrder: 2 } }],
      ]);
    });
  });

  // ─── roomType association ──────────────────────────────────────────────────

  describe('roomType association', () => {
    it('(a) createOffer persists roomTypeId when provided as a valid CUID', async () => {
      const CUID = 'cuid0000000000000000000001';
      const svc = buildService({
        prismaOverrides: {
          offer: {
            findMany: vi.fn().mockResolvedValue([]),
            findUnique: vi.fn().mockResolvedValue(null),
            aggregate: vi.fn().mockResolvedValue({ _max: { displayOrder: null } }),
            create: vi.fn().mockResolvedValue({
              ...OFFER_STUB,
              roomTypeId: CUID,
              roomType: { id: CUID, name: 'Suite Sumapaz' },
            }),
            update: vi.fn(),
            delete: vi.fn(),
          },
        },
      });
      await svc.createOffer({
        title: 'Suite deal',
        imageKey: 'offer_1_a.jpg',
        isActive: true,
        roomTypeId: CUID,
      } as any);
      const prisma = (svc as any).prisma;
      expect(prisma.offer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ roomTypeId: CUID }),
        }),
      );
    });

    it('(b) CreateOfferSchema rejects an invalid CUID for roomTypeId', () => {
      const result = CreateOfferSchema.safeParse({
        title: 'Test',
        imageKey: 'offer_1_a.jpg',
        roomTypeId: 'not-a-cuid',
      });
      expect(result.success).toBe(false);
    });

    it('(c) public response includes nested roomType when set', async () => {
      const CUID = 'cuid0000000000000000000002';
      const svc = buildService({
        prismaOverrides: {
          offer: {
            findMany: vi.fn().mockResolvedValue([
              {
                ...OFFER_STUB,
                roomTypeId: CUID,
                roomType: { id: CUID, name: 'Doble Deluxe' },
              },
            ]),
            findUnique: vi.fn().mockResolvedValue(null),
            aggregate: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
          },
        },
      });
      const results = await svc.listForPublic();
      expect(results[0].roomType).toEqual({ id: CUID, name: 'Doble Deluxe' });
    });

    it('(d) updateOffer sets roomTypeId to null when passed null', async () => {
      const svc = buildService({
        prismaOverrides: {
          offer: {
            findUnique: vi.fn().mockResolvedValue({
              ...OFFER_STUB,
              id: 'o-rt-1',
              roomTypeId: 'cuid0000000000000000000003',
            }),
            update: vi.fn().mockResolvedValue({ ...OFFER_STUB, id: 'o-rt-1', roomTypeId: null }),
            findMany: vi.fn(),
            aggregate: vi.fn(),
            create: vi.fn(),
            delete: vi.fn(),
          },
        },
      });
      await svc.updateOffer('o-rt-1', { roomTypeId: null } as any);
      const prisma = (svc as any).prisma;
      expect(prisma.offer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ roomTypeId: null }),
        }),
      );
    });
  });
});
