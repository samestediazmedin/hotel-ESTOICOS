/**
 * foursquare.client.ts — Thin HTTP wrapper around the Foursquare Places API v2.
 *
 * Used by the public Concierge IA tools (search_venues, get_venue_detail) to fetch
 * live places near the hotel based on the guest's free-text query. Replaces the
 * previous local-DB-only implementation (which required a curated venue table).
 *
 * Why Foursquare v2 (legacy) and not v3 (2026-05-25 decision):
 *   - The credentials issued by Foursquare to the user on signup are v2 OAuth
 *     credentials (client_id + client_secret), not a v3 Service API Key.
 *   - v2 is deprecated but still operational and free — sufficient for a single-hotel
 *     MVP delivery on the agreed timeline.
 *   - Migration path to v3: replace these endpoints + auth scheme in this single file;
 *     the tool surface (NearbyPlaceDto fields) stays identical.
 *
 * Authentication: v2 uses query-string auth with `client_id`, `client_secret`, and a
 * `v=YYYYMMDD` version pin (no header tokens).
 *
 * Endpoints used:
 *   - GET /v2/venues/search        → list of venues near a coordinate
 *   - GET /v2/venues/{VENUE_ID}    → full venue detail (rating, hours, photos, tips)
 *
 * READ-ONLY: this client only performs GET requests. CON-04 (read-only tool guarantee)
 * is preserved because the client never touches Prisma and never writes to Foursquare.
 *
 * Failure semantics:
 *   - Network error / non-2xx response → throws FoursquareError (caught upstream by
 *     ConciergeToolExecutorService, which converts it to a structured error so the
 *     SSE stream survives).
 *   - Missing credentials → isConfigured() returns false; tool handlers return a
 *     structured `configuration_missing` payload instead of throwing.
 *
 * Caching: 30-min in-process LRU keyed by (endpoint, query, lat, lng, radius).
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Hotel coordinates fallback — Plaza de Bolívar, La Candelaria, Bogotá. */
const HOTEL_LAT_DEFAULT = 4.6097;
const HOTEL_LNG_DEFAULT = -74.0817;

/** Foursquare Places API v2 base URL. */
const FOURSQUARE_V2_BASE = 'https://api.foursquare.com/v2';

/**
 * v2 version date pin — Foursquare requires this so the response shape is locked
 * to the API version released on or before this date. Update only when migrating
 * to a newer field set.
 */
const FOURSQUARE_API_VERSION = '20250525';

/** Cache TTL — 30 minutes is enough to absorb bursty guest queries without serving stale ratings. */
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;

/** Per-venue timeout when enriching search results with the detail endpoint. */
const DETAIL_ENRICH_TIMEOUT_MS = 3500;

/** Raw shape of a Foursquare v2 venue. */
interface FoursquareV2Venue {
  id: string;
  name: string;
  categories?: Array<{
    id: string;
    name: string;
    pluralName?: string;
    shortName?: string;
    primary?: boolean;
    icon?: { prefix?: string; suffix?: string };
  }>;
  location?: {
    address?: string;
    lat?: number;
    lng?: number;
    distance?: number; // meters from the requesting `ll`
    city?: string;
    state?: string;
    country?: string;
    formattedAddress?: string[];
  };
  rating?: number; // 0-10 scale, ONLY present in /venues/{id} response
  price?: { tier?: number; currency?: string };
  hours?: { status?: string; isOpen?: boolean };
  bestPhoto?: { prefix?: string; suffix?: string; width?: number; height?: number };
  contact?: { phone?: string; formattedPhone?: string };
  url?: string;
  description?: string;
  photos?: {
    groups?: Array<{ items?: Array<{ prefix?: string; suffix?: string }> }>;
  };
}

interface FoursquareV2SearchResponse {
  meta?: { code?: number; errorType?: string; errorDetail?: string };
  response?: { venues?: FoursquareV2Venue[] };
}

interface FoursquareV2DetailResponse {
  meta?: { code?: number; errorType?: string; errorDetail?: string };
  response?: { venue?: FoursquareV2Venue };
}

/**
 * Frontend-friendly venue type enum, mapped from Foursquare category names by
 * inferVenueType(). Used by the React VenueCard so the badge shows the right
 * Spanish label (Restaurante, Café, Museo…).
 */
export type VenueType =
  | 'RESTAURANT'
  | 'BAR'
  | 'CAFE'
  | 'MUSEUM'
  | 'PARK'
  | 'SHOPPING'
  | 'NIGHTLIFE'
  | 'TRANSPORT_HUB'
  | 'EVENT_VENUE'
  | 'OTHER';

/** Normalized shape returned to the LLM and frontend VenueCard. */
export interface NearbyPlaceDto {
  id: string; // Foursquare v2 venue ID
  name: string;
  type: VenueType; // mapped from category for the frontend badge
  category: string; // raw Foursquare category name (kept for the LLM)
  address: string;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number;
  rating: number | null; // 0-5 scale (rescaled from Foursquare 0-10) — populated by detail enrichment
  priceLevel: number | null; // 1-4 tier
  mapsUrl: string; // Google Maps deep-link
  openNow: boolean | null;
  hoursDisplay: string | null;
  phone: string | null;
  website: string | null;
  photoUrl: string | null; // absolute Foursquare photo URL (600x400) or null — populated by detail enrichment
  /**
   * Foursquare category icon (PNG 64×64) — comes free in /v2/venues/search and
   * is used by VenueCard as the visual identity in lieu of a real venue photo
   * (which lives behind Foursquare's premium tier).
   */
  categoryIconUrl: string | null;
}

export interface NearbyPlaceDetailDto extends NearbyPlaceDto {
  description: string | null;
  photoUrls: string[];
}

export interface SearchNearbyArgs {
  /** Free-text query — restaurant, museum name, cuisine type, etc. */
  query?: string;
  /** Foursquare v2 category IDs (comma-separated). Optional. */
  categoryIds?: string;
  /** Search radius in kilometres. Default 5. Max 50. */
  maxDistanceKm?: number;
  /** Minimum rating on the 0-5 scale (NOTE: search response has no rating — filter is no-op for search). */
  minRating?: number;
  /** How many to return. Default 10. Max 50. */
  limit?: number;
}

export class FoursquareError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly upstreamBody?: string,
  ) {
    super(message);
    this.name = 'FoursquareError';
  }
}

@Injectable()
export class FoursquareClient {
  private readonly logger = new Logger(FoursquareClient.name);
  private readonly clientId: string | null;
  private readonly clientSecret: string | null;
  private readonly hotelLat: number;
  private readonly hotelLng: number;
  private readonly cache: Map<string, { expiresAt: number; payload: unknown }> = new Map();

  constructor(private readonly config: ConfigService) {
    this.clientId = this.config.get<string>('FOURSQUARE_CLIENT_ID') ?? null;
    this.clientSecret = this.config.get<string>('FOURSQUARE_CLIENT_SECRET') ?? null;
    this.hotelLat = Number(this.config.get<string>('HOTEL_LAT', String(HOTEL_LAT_DEFAULT)));
    this.hotelLng = Number(this.config.get<string>('HOTEL_LNG', String(HOTEL_LNG_DEFAULT)));

    if (!this.clientId || !this.clientSecret) {
      this.logger.warn(
        'FOURSQUARE_CLIENT_ID and/or FOURSQUARE_CLIENT_SECRET are not set — ' +
          'search_venues will return a configuration error.',
      );
    }
  }

  /** Returns true iff the client can make API calls (both creds present). */
  isConfigured(): boolean {
    return !!this.clientId && !!this.clientSecret;
  }

  /**
   * searchNearby — call Foursquare /v2/venues/search and return normalized places
   * sorted by distance from the hotel (Foursquare returns them already sorted
   * ascending when `ll` is provided).
   */
  async searchNearby(args: SearchNearbyArgs): Promise<NearbyPlaceDto[]> {
    if (!this.isConfigured()) {
      throw new FoursquareError('FOURSQUARE credentials are not configured', 500);
    }

    const maxKm = clamp(args.maxDistanceKm ?? 5, 0.1, 50);
    const radiusMeters = Math.round(maxKm * 1000);
    const limit = clamp(args.limit ?? 10, 1, 50);
    const ll = `${this.hotelLat},${this.hotelLng}`;

    const url = new URL(`${FOURSQUARE_V2_BASE}/venues/search`);
    this.applyAuth(url);
    url.searchParams.set('ll', ll);
    url.searchParams.set('radius', String(radiusMeters));
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('intent', 'browse');
    if (args.query) url.searchParams.set('query', args.query);
    if (args.categoryIds) url.searchParams.set('categoryId', args.categoryIds);

    const cacheKey = `s:${normalizeCacheKey(url)}`;
    const cached = this.readCache<FoursquareV2SearchResponse>(cacheKey);
    const raw = cached ?? (await this.get<FoursquareV2SearchResponse>(url.toString()));
    if (!cached) this.writeCache(cacheKey, raw);

    const venues = raw.response?.venues ?? [];
    const baseResults = venues.map((v) => this.normalize(v));

    // NOTE (2026-05-26): the /v2/venues/{id} detail endpoint requires premium credits
    // on Foursquare v2 — it returns HTTP 402 "credits_exhausted" on the free tier.
    // That means photoUrl, rating, openNow, etc. cannot be populated without paying
    // or upgrading to a v3 Service API Key (which includes photos + ratings in the
    // /v3/places/search response on the free tier). For now we return the base
    // search results unenriched; the frontend gracefully degrades by showing a pin
    // icon placeholder when photoUrl is null.

    if (typeof args.minRating === 'number') {
      // No rating is available on v2 search results, so a minRating filter would
      // exclude every venue. Skip the filter when rating is not present.
      return baseResults;
    }
    return baseResults;
  }

  /**
   * getDetail — call /v2/venues/{id} for full venue info (rating, hours, photos).
   * Returns null on 404.
   */
  async getDetail(venueId: string): Promise<NearbyPlaceDetailDto | null> {
    if (!this.isConfigured()) {
      throw new FoursquareError('FOURSQUARE credentials are not configured', 500);
    }

    const url = new URL(`${FOURSQUARE_V2_BASE}/venues/${encodeURIComponent(venueId)}`);
    this.applyAuth(url);

    const cacheKey = `d:${venueId}`;
    const cached = this.readCache<FoursquareV2DetailResponse>(cacheKey);
    let raw: FoursquareV2DetailResponse;
    try {
      raw = cached ?? (await this.get<FoursquareV2DetailResponse>(url.toString()));
      if (!cached) this.writeCache(cacheKey, raw);
    } catch (err) {
      if (err instanceof FoursquareError && err.statusCode === 404) return null;
      throw err;
    }

    const venue = raw.response?.venue;
    if (!venue) return null;

    const base = this.normalize(venue);
    const photoUrls = collectPhotoUrls(venue, 5);
    // S01: sanitize description from external source — cap at 600 chars, strip injection.
    const safeDescription = sanitizeVenueField(venue.description ?? null, 600) || null;
    return { ...base, description: safeDescription, photoUrls };
  }

  // ── internals ────────────────────────────────────────────────────────────

  /** Append v2 auth + version params (mutates the URL). */
  private applyAuth(url: URL): void {
    url.searchParams.set('client_id', this.clientId!);
    url.searchParams.set('client_secret', this.clientSecret!);
    url.searchParams.set('v', FOURSQUARE_API_VERSION);
  }

  private normalize(v: FoursquareV2Venue): NearbyPlaceDto {
    const lat = v.location?.lat ?? null;
    const lng = v.location?.lng ?? null;
    const distanceKm =
      v.location?.distance != null ? Math.round((v.location.distance / 1000) * 10) / 10 : 0;
    const rating5 = v.rating != null ? Math.round((v.rating / 2) * 10) / 10 : null;

    const addressBits = [
      v.location?.address,
      v.location?.city,
      v.location?.state,
      v.location?.country,
    ]
      .filter(Boolean)
      .join(', ');
    const address = v.location?.formattedAddress?.join(', ') ?? addressBits ?? '';

    const primaryCategory = v.categories?.find((c) => c.primary) ?? v.categories?.[0];
    const category = primaryCategory?.name ?? 'Lugar';
    const categoryIconUrl =
      primaryCategory?.icon?.prefix && primaryCategory?.icon?.suffix
        ? `${primaryCategory.icon.prefix}64${primaryCategory.icon.suffix}`
        : null;

    const mapsUrl =
      lat != null && lng != null
        ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            v.name + ' ' + (v.location?.city ?? 'Bogotá'),
          )}`;

    const photoUrl =
      v.bestPhoto?.prefix && v.bestPhoto?.suffix
        ? `${v.bestPhoto.prefix}600x400${v.bestPhoto.suffix}`
        : null;

    // S01: sanitize all string fields that originate from Foursquare (external data).
    // name and address are capped at 120 chars; category at 80 chars.
    const safeName = sanitizeVenueField(decodeUtf8Mojibake(v.name), 120);
    const safeAddress = sanitizeVenueField(decodeUtf8Mojibake(address), 120);
    const safeCategory = sanitizeVenueField(category, 80);

    return {
      id: v.id,
      name: safeName,
      type: inferVenueType(safeCategory),
      category: safeCategory,
      address: safeAddress,
      latitude: lat,
      longitude: lng,
      distanceKm,
      rating: rating5,
      priceLevel: v.price?.tier ?? null,
      mapsUrl,
      openNow: v.hours?.isOpen ?? null,
      hoursDisplay: v.hours?.status ?? null,
      phone: v.contact?.formattedPhone ?? v.contact?.phone ?? null,
      website: v.url ?? null,
      photoUrl,
      categoryIconUrl,
    };
  }

  private async get<T>(url: string): Promise<T> {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new FoursquareError(
        `Foursquare API ${res.status} ${res.statusText}`,
        res.status,
        body.slice(0, 500),
      );
    }

    return (await res.json()) as T;
  }

  private readCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.payload as T;
  }

  private writeCache(key: string, payload: unknown): void {
    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
  }
}

// ── helpers ──────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * S01 — Indirect prompt injection mitigation.
 *
 * Pattern matches instruction-like phrases in external venue data (names,
 * descriptions, addresses). Case-insensitive, allows up to 20 chars between
 * the imperative verb and the target noun.
 *
 * Intentionally conservative — only matches clear imperative injection
 * attempts, not ordinary text that happens to contain these words.
 */
const INSTRUCTION_LIKE_RE =
  /(ignore|forget|disregard|ignora|olvida|desestima).{0,20}(instruction|rule|prompt|instruccion|instrucción|regla)/gi;

/**
 * sanitizeVenueField — sanitize a single text field from the Foursquare API
 * before it enters the LLM context as tool output.
 *
 * Operations (S01):
 * 1. Return empty string for null/undefined input.
 * 2. Trim leading/trailing whitespace.
 * 3. Strip embedded newlines (LF, CR, CRLF) — prevents multi-line injection.
 * 4. Strip obvious instruction-like patterns.
 * 5. Cap length to maxLen characters.
 *
 * @param value    - Raw string from the Foursquare API response
 * @param maxLen   - Maximum output length (default 120)
 */
function sanitizeVenueField(value: string | null | undefined, maxLen = 120): string {
  if (!value) return '';
  let s = value.trim();
  // Strip newlines — a multi-line venue name is almost certainly injection
  s = s.replace(/[\r\n]+/g, ' ');
  // Strip obvious instruction-like patterns
  s = s.replace(INSTRUCTION_LIKE_RE, '');
  // Trim again after replacements and cap length
  return s.trim().slice(0, maxLen);
}

/**
 * Build a deterministic cache key from a URL by stripping auth params.
 * Without this every cache entry would include the API credentials in the key,
 * which works but bloats the cache and leaks secrets into logs if dumped.
 */
function normalizeCacheKey(url: URL): string {
  const cleaned = new URLSearchParams(url.searchParams);
  cleaned.delete('client_id');
  cleaned.delete('client_secret');
  cleaned.delete('v');
  return `${url.pathname}?${cleaned.toString()}`;
}

/**
 * Collect up to N photo URLs from a venue. Foursquare v2 stores photos under
 * `photos.groups[*].items[*]` and/or `bestPhoto`. Returns 600x400 sized URLs.
 */
function collectPhotoUrls(venue: FoursquareV2Venue, max: number): string[] {
  const urls: string[] = [];
  if (venue.bestPhoto?.prefix && venue.bestPhoto?.suffix) {
    urls.push(`${venue.bestPhoto.prefix}600x400${venue.bestPhoto.suffix}`);
  }
  for (const group of venue.photos?.groups ?? []) {
    for (const item of group.items ?? []) {
      if (urls.length >= max) break;
      if (item.prefix && item.suffix) {
        urls.push(`${item.prefix}600x400${item.suffix}`);
      }
    }
    if (urls.length >= max) break;
  }
  return urls.slice(0, max);
}

/**
 * Decode common UTF-8 double-encoding artefacts ("Bogotá" → "Bogotá").
 * Foursquare v2 occasionally returns city/country strings with mojibake; this
 * fixes the obvious cases without touching properly-encoded text. Best-effort.
 */
/**
 * Map a Foursquare v2 category name (e.g. "Italian Restaurant", "Coffee Shop")
 * to our frontend VenueType enum. Falls back to OTHER on no match. The match is
 * case-insensitive and based on substring keywords — Foursquare's catalog has too
 * many leaf categories to enumerate exhaustively.
 */
export function inferVenueType(category: string | null | undefined): VenueType {
  if (!category) return 'OTHER';
  const c = category.toLowerCase();
  if (/(coffee|caf[eé]|tea\s?room|tea\s?house)/.test(c)) return 'CAFE';
  if (/(bar|pub|brewery|cocktail|wine|whisky|sake)/.test(c)) return 'BAR';
  if (/(nightclub|club|disco|lounge|dance)/.test(c)) return 'NIGHTLIFE';
  if (/(restaurant|food|diner|bistro|steakhouse|pizza|sushi|ramen|burger|taco|kitchen)/.test(c))
    return 'RESTAURANT';
  if (/(museum|art\s?gallery|gallery|monument|historic|historical|landmark)/.test(c))
    return 'MUSEUM';
  if (/(park|plaza|garden|reserve|playground)/.test(c)) return 'PARK';
  if (/(store|shop|mall|boutique|market|department)/.test(c)) return 'SHOPPING';
  if (/(theater|theatre|concert|music\s?venue|arena|stadium|event\s?venue|performing\s?arts)/.test(c))
    return 'EVENT_VENUE';
  if (/(airport|station|bus|train|metro|transport|terminal)/.test(c)) return 'TRANSPORT_HUB';
  return 'OTHER';
}

function decodeUtf8Mojibake(text: string): string {
  if (!text || !text.includes('Ã')) return text;
  try {
    // Convert string back to its mis-decoded bytes (latin-1) and re-decode as UTF-8.
    return Buffer.from(text, 'latin1').toString('utf8');
  } catch {
    return text;
  }
}
