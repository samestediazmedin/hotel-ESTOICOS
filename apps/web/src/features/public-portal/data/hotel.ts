import type { HotelInfo } from '../types';

/**
 * Phase 12 — Used ONLY as TanStack Query placeholderData when the public API errors.
 * Real values come from GET /api/public/hotel-info (DB-backed).
 */
export const HOTEL_INFO_FALLBACK: HotelInfo = {
  hotelName: 'Hotel Sumapaz',
  hotelAddress: 'Centro Internacional, Bogotá',
  tagline: 'Boutique en el corazón cultural de Bogotá',
  description:
    'Edificio restaurado a pocos pasos del Parque Nacional y el Museo Nacional, con vista directa a los cerros orientales. Cocina bogotana de autor liderada por la chef Catalina Vélez, terraza con tinto recién pasado y guía personal con IA para descubrir la ciudad como un local.',
  phone: '+57 (1) 555-0100',
  rating: 4.84,
  reviewCount: 318,
  tags: ['Hotel boutique', '42 habitaciones', '4 pisos', 'Desayuno incluido'],
  // 2026-05-29 — safe fallback: show IVA-included prices (matches DB default)
  displayPricesWithIva: true,
  ivaRate: 0.19,
};
