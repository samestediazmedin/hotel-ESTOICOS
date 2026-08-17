/**
 * create-venue.dto.ts — Zod validation schema for creating a Bogotá venue.
 *
 * Phone format: Colombia international format +57 followed by 10 digits (no spaces).
 * Example: +573001234567
 *
 * lat/lng: Bogotá city bounds approximately lat 3.7-5.0, lng -74.9 to -73.9.
 * Using full global range (±90 / ±180) to avoid false rejections from venues
 * at the city boundary. The DB constraint (NOT NULL) is enforced by the migration.
 *
 * P14: Phone regex = ^\+57\d{10}$ (Colombia format +57XXXXXXXXXX, no spaces)
 */

import { z } from 'zod';

export const CreateVenueSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum([
    'RESTAURANT',
    'BAR',
    'CAFE',
    'MUSEUM',
    'PARK',
    'SHOPPING',
    'NIGHTLIFE',
    'TRANSPORT_HUB',
    'EVENT_VENUE',
    'OTHER',
  ]),
  description: z.string().max(2000).optional(),
  rating: z.number().min(0).max(5).optional(),
  address: z.string().max(300).optional(),
  phone: z
    .string()
    .regex(/^\+57\d{10}$/, 'Colombia phone format required: +57 followed by 10 digits (no spaces)')
    .optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  photoUrl: z.string().optional(), // R2 key (not full URL — Phase 02-02 convention)
  mapsUrl: z.string().url().optional(),
  reservationUrl: z.string().url().optional(),
  website: z.string().url().optional(),
});

export type CreateVenueDto = z.infer<typeof CreateVenueSchema>;

export const UpdateVenueSchema = CreateVenueSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type UpdateVenueDto = z.infer<typeof UpdateVenueSchema>;
