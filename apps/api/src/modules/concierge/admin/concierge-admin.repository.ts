/**
 * concierge-admin.repository.ts — Write-side repository for admin catalog management.
 *
 * All mutations (create, update, soft-delete, bulk-import) live here.
 * The read-only side (for tool handlers) is in ConciergeRepository.
 *
 * Soft-delete pattern: disableVenue() sets isActive=false (never hard-deletes).
 * This preserves historical audit data and lets ADMIN re-enable venues.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { BogotaVenue } from '../../../generated/prisma/client';
import type { CreateVenueDto, UpdateVenueDto } from '../dto/create-venue.dto';

@Injectable()
export class ConciergeAdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * listVenues — list all venues for the admin screen.
   * @param includeInactive - if true, returns disabled venues too (default: false)
   */
  async listVenues(includeInactive = false): Promise<BogotaVenue[]> {
    return this.prisma.bogotaVenue.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * createVenue — insert a new venue.
   */
  async createVenue(data: CreateVenueDto): Promise<BogotaVenue> {
    return this.prisma.bogotaVenue.create({
      data: {
        name: data.name,
        type: data.type as any,
        description: data.description ?? null,
        rating: data.rating != null ? data.rating : null,
        address: data.address ?? null,
        phone: data.phone ?? null,
        lat: data.lat,
        lng: data.lng,
        photoUrl: data.photoUrl ?? null,
        mapsUrl: data.mapsUrl ?? null,
        reservationUrl: data.reservationUrl ?? null,
        website: data.website ?? null,
      },
    });
  }

  /**
   * updateVenue — partial update of an existing venue.
   */
  async updateVenue(id: string, data: UpdateVenueDto): Promise<BogotaVenue> {
    const existing = await this.prisma.bogotaVenue.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Venue ${id} not found`);

    return this.prisma.bogotaVenue.update({
      where: { id },
      data: {
        ...(data.name != null && { name: data.name }),
        ...(data.type != null && { type: data.type as any }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.rating !== undefined && { rating: data.rating }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.lat != null && { lat: data.lat }),
        ...(data.lng != null && { lng: data.lng }),
        ...(data.photoUrl !== undefined && { photoUrl: data.photoUrl }),
        ...(data.mapsUrl !== undefined && { mapsUrl: data.mapsUrl }),
        ...(data.reservationUrl !== undefined && { reservationUrl: data.reservationUrl }),
        ...(data.website !== undefined && { website: data.website }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  /**
   * disableVenue — soft-delete by setting isActive=false.
   */
  async disableVenue(id: string): Promise<BogotaVenue> {
    const existing = await this.prisma.bogotaVenue.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Venue ${id} not found`);

    return this.prisma.bogotaVenue.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * bulkCreateSkipDuplicates — transactional bulk insert with duplicate detection.
   *
   * Duplicate check: same name + address combination (case-insensitive).
   * If a matching venue already exists, the row is skipped (not overwritten).
   *
   * Note: Prisma's createMany skipDuplicates requires a unique constraint.
   * Since the schema does not have one on (name, address), we check individually.
   */
  async bulkCreateSkipDuplicates(
    rows: CreateVenueDto[],
  ): Promise<{ inserted: number; skipped: number }> {
    let inserted = 0;
    let skipped = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const row of rows) {
        // Check for duplicate by name + address
        const existing = await tx.bogotaVenue.findFirst({
          where: {
            name: { equals: row.name, mode: 'insensitive' },
            ...(row.address
              ? { address: { equals: row.address, mode: 'insensitive' } }
              : {}),
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        await tx.bogotaVenue.create({
          data: {
            name: row.name,
            type: row.type as any,
            description: row.description ?? null,
            rating: row.rating != null ? row.rating : null,
            address: row.address ?? null,
            phone: row.phone ?? null,
            lat: row.lat,
            lng: row.lng,
            photoUrl: row.photoUrl ?? null,
            mapsUrl: row.mapsUrl ?? null,
            reservationUrl: row.reservationUrl ?? null,
            website: row.website ?? null,
          },
        });
        inserted++;
      }
    });

    return { inserted, skipped };
  }
}
