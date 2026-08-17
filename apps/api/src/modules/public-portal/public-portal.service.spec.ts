import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { PublicPortalService } from './public-portal.service';
import { SystemConfigService } from '../../system-config/system-config.service';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockSystemConfig = {
  id: 'cfg-1',
  hotelBusinessDate: new Date('2026-05-17'),
  hotelTimezone: 'America/Bogota',
  // Prisma Decimal mock: Number() uses valueOf(); toString() and toNumber() also needed.
  ivaRate: { toNumber: () => 0.19, toString: () => '0.19', valueOf: () => 0.19 },
  hotelName: 'Hotel Sumapaz',
  hotelLogoUrl: null,
  address: 'La Candelaria, Bogotá', // Phase 13 — DB-backed address (migration backfill)
  tagline: 'Boutique en el corazón histórico de Bogotá',
  description: 'Hotel boutique de 42 habitaciones en pleno centro histórico.',
  phone: '+57 (1) 555-0100',
  tags: ['Hotel boutique', '42 habitaciones', '4 pisos', 'Desayuno incluido'],
  updatedAt: new Date('2026-05-17'),
  // 2026-05-29 — new field
  displayPricesWithIva: true,
};

// Prisma Decimal-like object (has toString and valueOf but not a plain number)
class MockDecimal {
  private value: number;
  constructor(val: number) {
    this.value = val;
  }
  toNumber() { return this.value; }
  toString() { return String(this.value); }
  valueOf() { return this.value; }
}

const makeRoomType = (id: string, name: string, price: number, maxOccupancy: number, photos: any[] = []) => ({
  id,
  name,
  description: `Descripción de ${name}`,
  basePrice: new MockDecimal(price),
  maxOccupancy,
  amenities: ['WiFi'],
  isActive: true,
  isPublished: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  photos,
});

const makePhoto = (order: number) => ({
  id: `photo-${order}`,
  roomId: 'room-1',
  key: `hotel/room1/photo-${order}.jpg`,
  contentType: 'image/jpeg',
  size: 102400,
  order,
  createdAt: new Date('2026-01-01'),
});

const makeHotelPhoto = (displayOrder: number) => ({
  id: `hp-${displayOrder}`,
  url: `https://images.unsplash.com/photo-${displayOrder}`,
  alt: `Foto del hotel ${displayOrder}`,
  displayOrder,
  createdAt: new Date('2026-01-01'),
});

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  roomType: { findMany: vi.fn() },
  hotelPhoto: { findMany: vi.fn() },
};

const mockSystemConfigService = {
  getConfig: vi.fn(),
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('PublicPortalService', () => {
  let service: PublicPortalService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicPortalService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SystemConfigService, useValue: mockSystemConfigService },
      ],
    }).compile();

    service = module.get(PublicPortalService);
  });

  // ─── getHotelInfo ─────────────────────────────────────────────────────────

  describe('getHotelInfo', () => {
    it('returns placeholder rating 4.84 (v1.2 hardcoded — Phase 14 will use real aggregate)', async () => {
      mockSystemConfigService.getConfig.mockResolvedValue(mockSystemConfig);

      const result = await service.getHotelInfo();

      expect(result.rating).toBe(4.84);
    });

    it('returns placeholder reviewCount 318 (v1.2 hardcoded — Phase 14 will use real aggregate)', async () => {
      mockSystemConfigService.getConfig.mockResolvedValue(mockSystemConfig);

      const result = await service.getHotelInfo();

      expect(result.reviewCount).toBe(318);
    });

    it('returns address from system_config.address DB column (Phase 13 — no longer hardcoded)', async () => {
      mockSystemConfigService.getConfig.mockResolvedValue(mockSystemConfig);

      const result = await service.getHotelInfo();

      expect(result.address).toBe('La Candelaria, Bogotá');
    });

    it('returns empty string for address when system_config.address is null', async () => {
      mockSystemConfigService.getConfig.mockResolvedValue({
        ...mockSystemConfig,
        address: null,
      });

      const result = await service.getHotelInfo();

      expect(result.address).toBe('');
    });

    it('maps hotelName from systemConfig verbatim', async () => {
      mockSystemConfigService.getConfig.mockResolvedValue(mockSystemConfig);

      const result = await service.getHotelInfo();

      expect(result.name).toBe('Hotel Sumapaz');
    });

    it('maps tagline from systemConfig verbatim', async () => {
      mockSystemConfigService.getConfig.mockResolvedValue(mockSystemConfig);

      const result = await service.getHotelInfo();

      expect(result.tagline).toBe('Boutique en el corazón histórico de Bogotá');
    });

    it('defaults null tagline to empty string', async () => {
      mockSystemConfigService.getConfig.mockResolvedValue({
        ...mockSystemConfig,
        tagline: null,
        description: null,
        phone: null,
        tags: [],
      });

      const result = await service.getHotelInfo();

      expect(result.tagline).toBe('');
      expect(result.description).toBe('');
      expect(result.phone).toBe('');
      expect(result.tags).toEqual([]);
    });

    it('defaults null config to safe fallback values', async () => {
      mockSystemConfigService.getConfig.mockResolvedValue(null);

      const result = await service.getHotelInfo();

      expect(result.name).toBe('Hotel Sumapaz');
      expect(result.tagline).toBe('');
      expect(result.description).toBe('');
      expect(result.phone).toBe('');
      expect(result.rating).toBe(4.84);
      expect(result.reviewCount).toBe(318);
      expect(result.tags).toEqual([]);
    });

    // ─── 2026-05-29: displayPricesWithIva + ivaRate ───────────────────────────

    it('returns displayPricesWithIva from config verbatim (true)', async () => {
      mockSystemConfigService.getConfig.mockResolvedValue(mockSystemConfig);

      const result = await service.getHotelInfo();

      expect(result.displayPricesWithIva).toBe(true);
    });

    it('returns displayPricesWithIva false when config has it false', async () => {
      mockSystemConfigService.getConfig.mockResolvedValue({
        ...mockSystemConfig,
        displayPricesWithIva: false,
      });

      const result = await service.getHotelInfo();

      expect(result.displayPricesWithIva).toBe(false);
    });

    it('returns ivaRate as a plain number via Number(config.ivaRate) — not a Decimal string', async () => {
      mockSystemConfigService.getConfig.mockResolvedValue(mockSystemConfig);

      const result = await service.getHotelInfo();

      // Must be a plain JS number — NOT a Prisma Decimal object or string "0.19"
      expect(typeof result.ivaRate).toBe('number');
      expect(result.ivaRate).toBe(0.19);
    });

    it('returns ivaRate 0.19 as fallback when config is null', async () => {
      mockSystemConfigService.getConfig.mockResolvedValue(null);

      const result = await service.getHotelInfo();

      expect(result.ivaRate).toBe(0.19);
      expect(result.displayPricesWithIva).toBe(true);
    });
  });

  // ─── getPublishedRoomTypes ────────────────────────────────────────────────

  describe('getPublishedRoomTypes', () => {
    it('queries with where: { isPublished: true, isActive: true }', async () => {
      mockPrisma.roomType.findMany.mockResolvedValue([]);

      await service.getPublishedRoomTypes();

      expect(mockPrisma.roomType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isPublished: true, isActive: true },
        }),
      );
    });

    it('orders results by basePrice ascending', async () => {
      mockPrisma.roomType.findMany.mockResolvedValue([]);

      await service.getPublishedRoomTypes();

      expect(mockPrisma.roomType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { basePrice: 'asc' },
        }),
      );
    });

    it('converts Prisma Decimal basePrice to a plain JavaScript number', async () => {
      const roomTypes = [makeRoomType('rt-1', 'Doble Estándar', 280000, 2)];
      mockPrisma.roomType.findMany.mockResolvedValue(roomTypes);

      const result = await service.getPublishedRoomTypes();

      expect(typeof result[0].basePrice).toBe('number');
      expect(result[0].basePrice).toBe(280000);
    });

    it('maps maxOccupancy to capacity as an integer', async () => {
      const roomTypes = [makeRoomType('rt-1', 'Doble Estándar', 280000, 2)];
      mockPrisma.roomType.findMany.mockResolvedValue(roomTypes);

      const result = await service.getPublishedRoomTypes();

      expect(result[0].capacity).toBe(2);
      expect(Number.isInteger(result[0].capacity)).toBe(true);
    });

    it('assigns "Más económica" to index 0, "Mejor valor" to index 1, null to rest', async () => {
      const roomTypes = [
        makeRoomType('rt-1', 'Básica', 200000, 1),
        makeRoomType('rt-2', 'Doble', 280000, 2),
        makeRoomType('rt-3', 'Suite', 450000, 3),
        makeRoomType('rt-4', 'Penthouse', 800000, 4),
      ];
      mockPrisma.roomType.findMany.mockResolvedValue(roomTypes);

      const result = await service.getPublishedRoomTypes();

      expect(result[0].badge).toBe('Más económica');
      expect(result[1].badge).toBe('Mejor valor');
      expect(result[2].badge).toBeNull();
      expect(result[3].badge).toBeNull();
    });

    it('returns photos: [] when a room type has no RoomTypePhoto rows', async () => {
      const roomTypes = [makeRoomType('rt-1', 'Sin Foto', 300000, 2, [])];
      mockPrisma.roomType.findMany.mockResolvedValue(roomTypes);

      const result = await service.getPublishedRoomTypes();

      expect(result[0].photos).toEqual([]);
    });

    it('maps RoomType.photos to /images/<key> using filename-served URLs', async () => {
      const photos = [makePhoto(0), makePhoto(1), makePhoto(2)];
      const roomTypes = [makeRoomType('rt-1', 'Doble Estándar', 280000, 2, photos)];
      mockPrisma.roomType.findMany.mockResolvedValue(roomTypes);

      const result = await service.getPublishedRoomTypes();

      expect(result[0].photos).toHaveLength(3);
      expect(result[0].photos[0].url).toBe('/images/hotel/room1/photo-0.jpg');
      expect(result[0].photos[0].alt).toBe('Doble Estándar');
    });
  });

  // ─── getHotelPhotos ───────────────────────────────────────────────────────

  describe('getHotelPhotos', () => {
    it('orders hotel photos by displayOrder ascending', async () => {
      mockPrisma.hotelPhoto.findMany.mockResolvedValue([]);

      await service.getHotelPhotos();

      expect(mockPrisma.hotelPhoto.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { displayOrder: 'asc' },
        }),
      );
    });

    it('maps hotel photo rows to { url, alt, displayOrder } shape verbatim', async () => {
      const photos = [makeHotelPhoto(0), makeHotelPhoto(1), makeHotelPhoto(2)];
      mockPrisma.hotelPhoto.findMany.mockResolvedValue(photos);

      const result = await service.getHotelPhotos();

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        url: 'https://images.unsplash.com/photo-0',
        alt: 'Foto del hotel 0',
        displayOrder: 0,
      });
    });
  });
});
