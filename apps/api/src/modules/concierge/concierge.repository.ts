/**
 * concierge.repository.ts — Read-only repository for Concierge IA tool handlers.
 *
 * All methods are read-only (SELECT only). Write operations go through
 * ConciergeAdminRepository (admin CRUD) or AuditLogRepository (audit log).
 *
 * P16: every query MUST filter WHERE isActive = true (soft-delete pattern).
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { VenueType } from '../../generated/prisma/client';
import {
  VenueResponseDto,
  VenueDetailResponseDto,
  ConciergeEventDto,
  toVenueResponseDto,
} from './dto/venue-response.dto';

@Injectable()
export class ConciergeRepository {
  private readonly hotelLat: number;
  private readonly hotelLng: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.hotelLat = Number(this.config.get<string>('HOTEL_LAT', '4.6097'));
    this.hotelLng = Number(this.config.get<string>('HOTEL_LNG', '-74.0817'));
  }

  /**
   * searchVenues — find active venues matching the given filters.
   *
   * Filters applied:
   * - isActive: true (always)
   * - type: optional VenueType filter
   * - rating: optional minimum rating
   * - query: optional text search on name or description (case-insensitive)
   *
   * Results are sorted by distanceKm ASC (nearest first) and capped at 10.
   * If maxDistanceKm is set, venues beyond that radius are excluded post-DB.
   */
  async searchVenues(args: {
    query?: string;
    type?: VenueType;
    maxDistanceKm?: number;
    minRating?: number;
  }): Promise<VenueResponseDto[]> {
    const where: any = { isActive: true };

    if (args.type) {
      where.type = args.type;
    }

    if (args.minRating != null) {
      where.rating = { gte: args.minRating };
    }

    if (args.query) {
      where.OR = [
        { name: { contains: args.query, mode: 'insensitive' } },
        { description: { contains: args.query, mode: 'insensitive' } },
      ];
    }

    const venues = await this.prisma.bogotaVenue.findMany({ where });

    let dtos = venues.map((v) => toVenueResponseDto(v, this.hotelLat, this.hotelLng));

    // Post-DB distance filter
    if (args.maxDistanceKm != null) {
      dtos = dtos.filter((d) => d.distanceKm <= args.maxDistanceKm!);
    }

    // Sort nearest first, cap at 10
    dtos.sort((a, b) => a.distanceKm - b.distanceKm);
    return dtos.slice(0, 10);
  }

  /**
   * getVenueById — fetch a single venue with its upcoming events.
   *
   * Events are filtered to isActive=true and startDate >= now.
   * Returns null if venue not found or isActive=false.
   */
  async getVenueById(id: string): Promise<VenueDetailResponseDto | null> {
    const venue = await this.prisma.bogotaVenue.findUnique({
      where: { id },
      include: {
        events: {
          where: {
            isActive: true,
            startDate: { gte: new Date() },
          },
          orderBy: { startDate: 'asc' },
          take: 5,
        },
      },
    });

    if (!venue || !venue.isActive) return null;

    const dto = toVenueResponseDto(venue, this.hotelLat, this.hotelLng);

    const events: ConciergeEventDto[] = venue.events.map((e) => ({
      id: e.id,
      title: e.title,
      startDate: e.startDate,
      endDate: e.endDate,
      description: e.description,
      ticketUrl: e.ticketUrl,
    }));

    return { ...dto, events };
  }

  /**
   * getTransportInfo — placeholder for Phase 08 MVP.
   *
   * Returns empty options array. When no rows exist, the assistant falls back
   * to system-prompt knowledge ("consult reception for transport options").
   * A real transport table can be added in v2 without changing this interface.
   */
  async getTransportInfo(args: {
    fromArea: string;
    toArea: string;
  }): Promise<{ fromArea: string; toArea: string; options: unknown[] }> {
    return {
      fromArea: args.fromArea,
      toArea: args.toArea,
      options: [],
    };
  }

  /**
   * getEvents — fetch upcoming events, optionally filtered by date range or venue type.
   */
  async getEvents(args: {
    startDate?: string;
    endDate?: string;
    venueType?: VenueType;
  }): Promise<ConciergeEventDto[]> {
    const where: any = {
      isActive: true,
      startDate: { gte: new Date() },
    };

    if (args.startDate) {
      where.startDate = { gte: new Date(args.startDate) };
    }
    if (args.endDate) {
      where.endDate = { lte: new Date(args.endDate) };
    }
    if (args.venueType) {
      where.venue = { type: args.venueType };
    }

    const events = await this.prisma.conciergeEvent.findMany({
      where,
      orderBy: { startDate: 'asc' },
      take: 20,
      include: {
        venue: { select: { type: true, isActive: true } },
      },
    });

    // Filter by venue isActive (in case relation filter was not sufficient)
    return events
      .filter((e) => e.venue.isActive)
      .map((e) => ({
        id: e.id,
        title: e.title,
        startDate: e.startDate,
        endDate: e.endDate,
        description: e.description,
        ticketUrl: e.ticketUrl,
      }));
  }
}
