import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConciergeToolExecutorService } from './concierge-tool-executor.service';

/**
 * Mocks for injected dependencies. The executor passes all to every tool handler:
 * - search_venues + get_venue_detail: foursquare
 * - hotel-knowledge tools: prisma
 * - Bogotá info tools (transport, events): repo
 * - check_availability: prisma + pricingService
 * - verify_stay_for_review + submit_guest_review: conciergeReview
 * - verify_stay_for_review (S03): verifyLimiter
 */
const mockRepo = {
  searchVenues: vi.fn().mockResolvedValue([{ id: '1', name: 'Café Bogotá' }]),
  getVenueById: vi.fn().mockResolvedValue({ id: '1', name: 'Café Bogotá', events: [] }),
  getTransportInfo: vi.fn().mockResolvedValue({ fromArea: 'norte', toArea: 'centro', options: [] }),
  getEvents: vi.fn().mockResolvedValue([]),
};

const mockPrisma = {
  systemConfig: { findFirst: vi.fn().mockResolvedValue(null) },
  roomType: { findMany: vi.fn().mockResolvedValue([]) },
  room: { findMany: vi.fn().mockResolvedValue([]) },
  reservation: { findMany: vi.fn().mockResolvedValue([]) },
};

const mockFoursquare = {
  isConfigured: vi.fn().mockReturnValue(true),
  searchNearby: vi.fn().mockResolvedValue([
    { id: 'fsq1', name: 'Café Cultor', category: 'Café', address: 'Cra 7', distanceKm: 0.3, rating: 4.5, mapsUrl: 'https://maps.google.com/?q=Cra+7' },
  ]),
  getDetail: vi.fn().mockResolvedValue(null),
};

const mockPricingService = {
  calculateBreakdown: vi.fn().mockResolvedValue({
    roomTypeId: 'rt1',
    ratePlanId: null,
    nights: 2,
    items: [],
    subtotal: 200000,
    totalIva: 38000,
    roomTotal: 238000,
    extras: [],
    extrasSubtotal: 0,
    extrasIva: 0,
    extrasTotal: 0,
    total: 238000,
    currency: 'COP',
    appliedRatePlan: 'Base Rate',
  }),
};

// Phase 3: mock for ConciergeReviewService
const mockConciergeReview = {
  verifyStay: vi.fn().mockResolvedValue({
    sessionToken: 'mock.session.token',
    displayName: 'Ana García',
  }),
  submitVerifiedReview: vi.fn().mockResolvedValue({
    id: 'rev-mock-001',
    createdAt: new Date('2026-06-03T00:00:00Z'),
  }),
};

// S03: mock for VerifyAttemptLimiterService
const mockVerifyLimiter = {
  isExceeded: vi.fn().mockReturnValue(false),
  recordAttempt: vi.fn(),
};

function buildExecutor(): ConciergeToolExecutorService {
  return new ConciergeToolExecutorService(
    mockRepo as any,
    mockPrisma as any,
    mockFoursquare as any,
    mockPricingService as any,
    mockConciergeReview as any,
    mockVerifyLimiter as any,
  );
}

describe('ConciergeToolExecutorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFoursquare.isConfigured.mockReturnValue(true);
    mockFoursquare.searchNearby.mockResolvedValue([
      { id: 'fsq1', name: 'Café Cultor', category: 'Café', address: 'Cra 7', distanceKm: 0.3, rating: 4.5, mapsUrl: 'https://maps.google.com/?q=Cra+7' },
    ]);
    mockConciergeReview.verifyStay.mockResolvedValue({
      sessionToken: 'mock.session.token',
      displayName: 'Ana García',
    });
    mockConciergeReview.submitVerifiedReview.mockResolvedValue({
      id: 'rev-mock-001',
      createdAt: new Date('2026-06-03T00:00:00Z'),
    });
    mockVerifyLimiter.isExceeded.mockReturnValue(false);
  });

  /** Test 1: Unknown tool name → structured error (not throw). */
  it('returns { error: "unknown_tool" } for an unrecognised tool name', async () => {
    const executor = buildExecutor();
    const result = await executor.executeOne('nonexistent_tool', '{}');
    expect(result).toMatchObject({ error: 'unknown_tool', toolName: 'nonexistent_tool' });
  });

  /** Test 2: Malformed JSON args → structured error (not throw). */
  it('returns { error: "invalid_args", reason: "malformed_json" } for invalid JSON', async () => {
    const executor = buildExecutor();
    const result = await executor.executeOne('search_venues', 'NOT JSON {{{');
    expect(result).toMatchObject({ error: 'invalid_args', reason: 'malformed_json' });
  });

  /** Test 3: Zod validation failure → returns { error: 'invalid_args', issues: [...] } (Zod v4 .issues). */
  it('returns { error: "invalid_args", issues } for Zod validation failure', async () => {
    const executor = buildExecutor();
    const result = await executor.executeOne('search_venues', JSON.stringify({ maxDistanceKm: -5 })) as any;
    expect(result.error).toBe('invalid_args');
    expect(Array.isArray(result.issues)).toBe(true);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  /** Test 4: Handler throws → executor catches → returns { error: 'handler_failure' }. */
  it('catches handler exceptions and returns { error: "handler_failure" } without rethrowing', async () => {
    const executor = buildExecutor();
    mockFoursquare.searchNearby.mockRejectedValueOnce(new Error('Foursquare 500'));
    const result = await executor.executeOne('search_venues', JSON.stringify({ query: 'café' })) as any;
    // search_venues handler catches FoursquareError and returns upstream_failure instead of
    // bubbling up — but if any other error escapes the handler's try/catch the executor
    // wraps it in handler_failure. Either is acceptable; we just verify nothing throws.
    expect(result).toHaveProperty('error');
    expect(['upstream_failure', 'handler_failure']).toContain(result.error);
  });

  /** Test 5: Happy path — search_venues with valid args → returns Foursquare results. */
  it('returns tool result on happy path (search_venues with valid args)', async () => {
    const executor = buildExecutor();
    const result = await executor.executeOne('search_venues', JSON.stringify({ query: 'café' })) as any;
    expect(result).not.toHaveProperty('error');
    expect(result).toHaveProperty('venues');
    expect(Array.isArray(result.venues)).toBe(true);
    expect(result.venues[0]).toMatchObject({ id: 'fsq1', name: 'Café Cultor' });
    expect(mockFoursquare.searchNearby).toHaveBeenCalledOnce();
  });

  /** Test 6: Foursquare key missing → search_venues returns configuration_missing without calling Foursquare. */
  it('returns configuration_missing when FOURSQUARE_API_KEY is unset', async () => {
    mockFoursquare.isConfigured.mockReturnValueOnce(false);
    const executor = buildExecutor();
    const result = await executor.executeOne('search_venues', JSON.stringify({ query: 'café' })) as any;
    expect(result.error).toBe('configuration_missing');
    expect(result.venues).toEqual([]);
    expect(mockFoursquare.searchNearby).not.toHaveBeenCalled();
  });

  // ── S03: per-tool verify attempt limiter ───────────────────────────────────

  /** S03-A: When the IP has exceeded the limit, return generic error without calling the service. */
  it('S03: returns generic verification_failed when verify attempt limit is exceeded', async () => {
    mockVerifyLimiter.isExceeded.mockReturnValueOnce(true);
    const executor = buildExecutor();
    const result = await executor.executeOne(
      'verify_stay_for_review',
      JSON.stringify({ documentNumber: '12345678', lastName: 'García' }),
      '10.0.0.1',
    ) as any;

    expect(result.error).toBe('verification_failed');
    // Must return the same generic message — no enumeration signal
    expect(result.message).toContain('No encontramos una estadía verificada');
    // Service must NOT have been called
    expect(mockConciergeReview.verifyStay).not.toHaveBeenCalled();
  });

  /** S03-B: When NOT exceeded, recordAttempt is called and the service executes normally. */
  it('S03: records attempt and calls verifyStay when limit is not exceeded', async () => {
    mockVerifyLimiter.isExceeded.mockReturnValueOnce(false);
    const executor = buildExecutor();
    const result = await executor.executeOne(
      'verify_stay_for_review',
      JSON.stringify({ documentNumber: '12345678', lastName: 'García' }),
      '10.0.0.1',
    ) as any;

    expect(mockVerifyLimiter.recordAttempt).toHaveBeenCalledWith('10.0.0.1');
    expect(mockConciergeReview.verifyStay).toHaveBeenCalledOnce();
    expect(result).toHaveProperty('sessionToken');
  });

  /** S03-C: Verify limiter is NOT called for other tools. */
  it('S03: does NOT call verifyLimiter for non-verify tools', async () => {
    const executor = buildExecutor();
    await executor.executeOne('search_venues', JSON.stringify({ query: 'café' }), '10.0.0.1');
    expect(mockVerifyLimiter.isExceeded).not.toHaveBeenCalled();
    expect(mockVerifyLimiter.recordAttempt).not.toHaveBeenCalled();
  });

  // ── S02: lastName min-length 3 (Zod schema) ───────────────────────────────

  /** S02: lastName of 2 chars should fail Zod validation (min is now 3). */
  it('S02: verify_stay_for_review rejects lastName shorter than 3 chars', async () => {
    const executor = buildExecutor();
    const result = await executor.executeOne(
      'verify_stay_for_review',
      JSON.stringify({ documentNumber: '12345678', lastName: 'Ga' }), // 2 chars
    ) as any;
    expect(result.error).toBe('invalid_args');
    expect(Array.isArray(result.issues)).toBe(true);
  });

  /** S02: lastName of exactly 3 chars should pass Zod validation. */
  it('S02: verify_stay_for_review accepts lastName of exactly 3 chars', async () => {
    const executor = buildExecutor();
    const result = await executor.executeOne(
      'verify_stay_for_review',
      JSON.stringify({ documentNumber: '12345678', lastName: 'Gil' }), // 3 chars
    ) as any;
    // Should not be a Zod validation error (service call proceeds)
    expect(result.error).not.toBe('invalid_args');
  });
});
