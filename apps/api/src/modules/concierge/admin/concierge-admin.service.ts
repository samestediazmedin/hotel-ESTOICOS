/**
 * concierge-admin.service.ts — Application service for admin venue catalog management.
 *
 * Validates input with Zod then delegates to ConciergeAdminRepository.
 * Throws BadRequestException (HTTP 400) on Zod validation failure with issue details.
 */

import { BadRequestException, Injectable } from '@nestjs/common';
import { BogotaVenue } from '../../../generated/prisma/client';
import { CreateVenueSchema, UpdateVenueSchema } from '../dto/create-venue.dto';
import type { CreateVenueDto, UpdateVenueDto } from '../dto/create-venue.dto';
import { ConciergeAdminRepository } from './concierge-admin.repository';

@Injectable()
export class ConciergeAdminService {
  constructor(private readonly repo: ConciergeAdminRepository) {}

  async listVenues(opts: { includeInactive?: boolean }): Promise<BogotaVenue[]> {
    return this.repo.listVenues(opts.includeInactive ?? false);
  }

  async createVenue(body: unknown): Promise<BogotaVenue> {
    const result = CreateVenueSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: result.error.issues,
      });
    }
    return this.repo.createVenue(result.data);
  }

  async updateVenue(id: string, body: unknown): Promise<BogotaVenue> {
    const result = UpdateVenueSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: result.error.issues,
      });
    }
    return this.repo.updateVenue(id, result.data);
  }

  async disableVenue(id: string): Promise<BogotaVenue> {
    return this.repo.disableVenue(id);
  }
}
