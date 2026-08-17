import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { publicPortalApi } from '../public-portal.api';
import type { RoomTypeCard } from '../types';

/**
 * Phase 12 — useRoomTypes (NEW)
 *
 * Replaces the hardcoded data/roomTypes.ts module (deleted in 12-05).
 * Fetches from GET /api/public/room-types — array sorted by basePrice ASC,
 * badge computed server-side (first → "Más económica", second → "Mejor valor").
 *
 * Fallback constant provides a minimal 2-entry subset so the portal renders
 * correctly even when the API is unavailable.
 */

const ROOM_TYPES_FALLBACK: RoomTypeCard[] = [
  {
    id: 'fallback-doble-estandar',
    name: 'Doble Estándar',
    capacity: 2,
    description: 'Habitación cómoda para dos huéspedes.',
    basePrice: 280000,
    photos: [],
    badge: 'Más económica',
  },
  {
    id: 'fallback-doble-deluxe',
    name: 'Doble Deluxe',
    capacity: 2,
    description: 'Habitación deluxe con vista a La Candelaria.',
    basePrice: 380000,
    photos: [],
    badge: 'Mejor valor',
  },
  {
    id: 'fallback-familiar',
    name: 'Familiar',
    capacity: 4,
    description: 'Habitación amplia para familias.',
    basePrice: 520000,
    photos: [],
    badge: null,
  },
  {
    id: 'fallback-suite-andina',
    name: 'Suite Andina',
    capacity: 3,
    description: 'Suite con vista a los cerros orientales.',
    basePrice: 720000,
    photos: [],
    badge: null,
  },
];

export function useRoomTypes(): UseQueryResult<RoomTypeCard[], Error> {
  return useQuery({
    queryKey: ['public', 'room-types'],
    queryFn: publicPortalApi.getRoomTypes,
    staleTime: 60_000,
    placeholderData: ROOM_TYPES_FALLBACK,
    retry: 2,
  });
}
