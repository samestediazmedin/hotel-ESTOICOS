import axios from 'axios';
import { useQuery, useMutation } from '@tanstack/react-query';

// ─── Public Axios instance ────────────────────────────────────────────────────

/**
 * Separate axios instance for /api/public/* endpoints.
 *
 * CRITICAL: DO NOT reuse the authenticated `api` instance from lib/api.ts.
 * The authenticated instance attaches JWT Bearer tokens and has a 401 refresh
 * interceptor — neither should run on the public surface.
 *
 * withCredentials: true is required so the browser sends the CSRF cookie
 * (hotel_csrf) set by GET /api/public/csrf-token.
 */
export const publicApi = axios.create({
  baseURL: '/api/public',
  withCredentials: true,
});

// In-memory CSRF token (session-scoped — refreshed on demand)
let csrfToken: string | null = null;

/**
 * Request interceptor: attach X-CSRF-Token to every POST/PUT/PATCH/DELETE.
 * GET requests are safe methods and do not need the CSRF header.
 */
publicApi.interceptors.request.use((config) => {
  const method = (config.method ?? '').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

// ─── CSRF token hook ──────────────────────────────────────────────────────────

async function fetchCsrfToken(): Promise<string> {
  const res = await publicApi.get<{ csrfToken: string }>('/csrf-token');
  csrfToken = res.data.csrfToken; // store in module-level memory
  return res.data.csrfToken;
}

/**
 * useCsrfToken — fetches and caches the CSRF token.
 * staleTime: Infinity — token only rotates on explicit invalidation.
 * Call queryClient.invalidateQueries(['public', 'csrf']) to force refresh.
 */
export function useCsrfToken() {
  return useQuery({
    queryKey: ['public', 'csrf'],
    queryFn: fetchCsrfToken,
    staleTime: Infinity,
  });
}

// ─── Availability hook ────────────────────────────────────────────────────────

export interface RoomWithPricing {
  id: string;
  number: string;
  floor: number;
  roomTypeId: string;
  photos: { r2Key: string; url?: string }[];
  pricing: {
    roomTypeId: string;
    nights: number;
    subtotal: number;
    totalIva: number;
    total: number;
    currency: string;
    appliedRatePlan: string;
  };
}

export interface AvailabilityParams {
  checkIn: string;   // "YYYY-MM-DD"
  checkOut: string;  // "YYYY-MM-DD"
  adults: number;
}

async function fetchAvailability(params: AvailabilityParams): Promise<RoomWithPricing[]> {
  const res = await publicApi.get<{ rooms: RoomWithPricing[] }>('/availability', {
    params: { checkIn: params.checkIn, checkOut: params.checkOut, adults: params.adults },
  });
  return res.data.rooms;
}

/**
 * usePublicAvailability — fetches available rooms for the given date range.
 * queryKey prefixed with ['public', ...] (Pitfall P14 namespace).
 */
export function usePublicAvailability(
  params: AvailabilityParams | null,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['public', 'availability', params?.checkIn, params?.checkOut, params?.adults],
    queryFn: () => fetchAvailability(params!),
    enabled: options?.enabled !== false && params !== null,
  });
}

// ─── Room types hook (2026-05-27 — request-to-book by type) ───────────────────

/**
 * PublicRoomType — UNIFIED shape returned by GET /api/public/room-types.
 * Same shape consumed by the homepage public-portal (features/public-portal).
 */
export interface PublicRoomType {
  id: string;
  name: string;
  capacity: number;
  description: string;
  basePrice: number;
  amenities: string[];
  photos: Array<{ url: string; alt: string }>;
  badge: string | null;
}

async function fetchRoomTypes(): Promise<PublicRoomType[]> {
  // Direct array (NOT wrapped) — matches the public-portal contract.
  const res = await publicApi.get<PublicRoomType[]>('/room-types');
  return res.data;
}

/**
 * usePublicRoomTypes — fetches the catalogue of published room types for the
 * public booking flow. Does NOT expose availability — the admin reviews each
 * request manually and contacts the guest if anything needs adjusting.
 */
export function usePublicRoomTypes() {
  return useQuery({
    queryKey: ['public', 'room-types'],
    queryFn: fetchRoomTypes,
    staleTime: 5 * 60 * 1000, // catalogue rarely changes
  });
}

// ─── Single offer lookup (for booking flow room-type lock) ────────────────────

/**
 * PublicOfferDetail — the subset of offer data needed by the booking flow.
 * Mirrors OfferResponseDto shape (backend returns full DTO; we only use these).
 */
export interface PublicOfferDetail {
  id: string;
  roomType: { id: string; name: string } | null;
}

async function fetchPublicOffer(id: string): Promise<PublicOfferDetail> {
  const res = await publicApi.get<PublicOfferDetail>(`/offers/${id}`);
  return res.data;
}

/**
 * usePublicOffer — fetches a single offer by id.
 * Only enabled when an offer id is present (booking flow ?offer=<id>).
 */
export function usePublicOffer(id: string | null) {
  return useQuery({
    queryKey: ['public', 'offer', id],
    queryFn: () => fetchPublicOffer(id!),
    enabled: id !== null && id.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Rate options (engine-driven pricing per rate plan) ──────────────────────

/**
 * PricingBreakdown — full server-computed price breakdown for a single rate plan
 * applied to a room type + date range. Grand total = roomTotal + extrasTotal.
 */
export interface PricingBreakdown {
  roomTypeId: string;
  ratePlanId: string | null;
  nights: number;
  items: Array<{
    date: string;
    base: number;
    multiplier: number;
    nightRate: number;
    ivaRate: number;
    ivaAmount: number;
    lineTotal: number;
    seasonName: string | null;
  }>;
  subtotal: number;
  totalIva: number;
  roomTotal: number;
  extras: Array<{
    name: string;
    pricingMode: string;      // "PER_STAY" | "PER_NIGHT" | "PER_PERSON_PER_NIGHT"
    unitAmount: number;
    quantity: number;
    subtotal: number;
    ivaAmount: number;
    total: number;
  }>;
  extrasSubtotal: number;
  extrasIva: number;
  extrasTotal: number;
  total: number;              // grand total = roomTotal + extrasTotal
  currency: 'COP';
  appliedRatePlan: string;
  minNightsViolation?: {
    required: number;
    actual: number;
    seasonName: string;
  };
}

/**
 * RatePlanOption — one selectable rate for a room type.
 * ratePlanId = null means synthetic "Base Rate" (no active plan, BAR only).
 */
export interface RatePlanOption {
  ratePlanId: string | null;
  ratePlanName: string;
  ratePlanType: string;       // "BAR" | "PROMO" | "PACKAGE" | "BASE"
  description: string | null;
  breakdown: PricingBreakdown;
}

export interface RateOptionsParams {
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
}

async function fetchRateOptions(params: RateOptionsParams): Promise<RatePlanOption[]> {
  const res = await publicApi.get<RatePlanOption[]>('/rate-options', {
    params: {
      roomTypeId: params.roomTypeId,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      adults: params.adults,
    },
  });
  return res.data;
}

/**
 * useRateOptions — fetches engine-computed rate plan options for a room type.
 *
 * - Lazy: pass null to skip the request (used for expand-on-demand UX).
 * - staleTime: 60s — engine results are deterministic for the same inputs;
 *   short enough to reflect any same-session admin changes.
 */
export function useRateOptions(params: RateOptionsParams | null) {
  return useQuery({
    queryKey: [
      'public',
      'rate-options',
      params?.roomTypeId,
      params?.checkIn,
      params?.checkOut,
      params?.adults,
    ],
    queryFn: () => fetchRateOptions(params!),
    enabled: params !== null,
    staleTime: 60 * 1000,
  });
}

// ─── Create booking mutation ──────────────────────────────────────────────────

export interface CreatePublicBookingPayload {
  fullName: string;
  email: string;
  phone: string;
  documentType: 'CC' | 'CE' | 'PASSPORT' | 'TI' | 'NIT';
  documentNumber: string;
  nationality: string;
  dateOfBirth: string; // "YYYY-MM-DD"
  /** roomId — kept for backward compat with old callers; the public flow no longer sends it. */
  roomId?: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  // Phase 15 — Extended contact capture (GCC-04)
  preferredLanguage?: 'es' | 'en';
  contactPreference?: 'EMAIL' | 'PHONE' | 'WHATSAPP' | null;
  whatsappNumber?: string | null;
  marketingConsent?: boolean;
  dietaryRestrictions?: string | null;
  specialRequests?: string | null;
  /**
   * 2026-05-28 — id of the homepage Offer the guest came from, if any.
   * The backend persists it on the PENDING reservation so the admin sees
   * "Vino por: <offer.title>" in the reservation drawer.
   */
  sourceOfferId?: string | null;
  /**
   * 2026-05-29 Phase 2 — chosen rate plan id from the rate-options engine.
   * null or omitted = server uses BAR (current behaviour, backward-compat).
   */
  ratePlanId?: string | null;
}

export interface CreateBookingResult {
  reservationId: string;
  guestName: string;
  total: number;
}

async function createBooking(payload: CreatePublicBookingPayload): Promise<CreateBookingResult> {
  const res = await publicApi.post<CreateBookingResult>('/bookings', payload);
  return res.data;
}

/**
 * useCreatePublicBooking — mutation to POST /api/public/bookings.
 * On success: returns { reservationId, guestName, total }.
 * On 409: ConflictException from backend — room no longer available.
 * On 403: CSRF token expired — caller should invalidate ['public', 'csrf'] and retry.
 */
export function useCreatePublicBooking() {
  return useMutation({
    mutationFn: createBooking,
  });
}
