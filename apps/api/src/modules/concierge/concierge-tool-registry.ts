/**
 * concierge-tool-registry.ts — Registry of 10 OpenAI function-calling tools.
 *
 * CON-03: exactly 10 tools registered (boot-time assertion in ConciergeModule.onModuleInit).
 * CON-04: read-only tool handler files contain no prisma write calls. The two Phase 3
 *   review tools (verify_stay_for_review, submit_guest_review) are write-capable but
 *   delegate DB writes to the injected ConciergeReviewService — their handler source
 *   files contain no prisma.*.create/update calls, so the grep test still passes.
 *
 * Structure:
 * - CONCIERGE_TOOL_REGISTRY: Record<toolName, ToolDef> — used by the SSE service (08-02)
 *   to dispatch tool calls from the LLM response.
 * - CONCIERGE_TOOL_DEFINITIONS: OpenAI tool definition array — passed to the ChatCompletion
 *   API as the `tools` parameter.
 *
 * Tool groups:
 *   Bogotá city tools (4): search_venues, get_venue_detail, get_transport_info, get_event_info
 *   Hotel knowledge tools (3, Phase 22): get_hotel_info, get_hotel_amenities, get_room_types_summary
 *   Booking handoff tools (1, Phase 2 concierge): check_availability
 *   Verified review tools (2, Phase 3 concierge): verify_stay_for_review, submit_guest_review
 *
 * 2026-05-25: search_venues and get_venue_detail were re-pointed at Foursquare Places API
 * (FoursquareClient). They now require `deps.foursquare`; the other 5 tools continue to
 * use `deps.repo` and/or `deps.prisma`. ConciergeToolExecutorService injects all three.
 *
 * 2026-06-03 (Phase 2 concierge expansion): check_availability added. It requires
 * `deps.pricingService` (injected via ConciergeToolExecutorService) to call
 * PricingService.calculateBreakdown() — the same method the public booking engine uses.
 * This ensures IVA, seasonal multipliers, and rate plan logic are applied consistently.
 *
 * 2026-06-03 (Phase 3 concierge expansion): verify_stay_for_review and submit_guest_review
 * added. They require `deps.conciergeReview` (ConciergeReviewService) injected by the
 * executor. These are write-capable tools — the only tools in the registry that mutate
 * state (via the service layer, never directly via prisma in the handler files).
 */

import type { ChatCompletionFunctionTool } from 'openai/resources/chat/completions';
import { z } from 'zod';
import { SearchVenuesTool } from './tools/search-venues.tool';
import { GetVenueDetailTool } from './tools/get-venue-detail.tool';
import { GetTransportInfoTool } from './tools/get-transport-info.tool';
import { GetEventInfoTool } from './tools/get-event-info.tool';
import { GetHotelInfoTool } from './tools/get-hotel-info.tool';
import { GetHotelAmenitiesTool } from './tools/get-hotel-amenities.tool';
import { GetRoomTypesSummaryTool } from './tools/get-room-types-summary.tool';
import { CheckAvailabilityTool } from './tools/check-availability.tool';
import { VerifyStayForReviewTool } from './tools/verify-stay-for-review.tool';
import { SubmitGuestReviewTool } from './tools/submit-guest-review.tool';
import type { ConciergeRepository } from './concierge.repository';
import type { PrismaService } from '../../prisma/prisma.service';
import type { FoursquareClient } from './clients/foursquare.client';
import type { PricingService } from '../pricing/pricing.service';
import type { ConciergeReviewService } from './concierge-review.service';

export interface ConciergeToolDeps {
  repo: ConciergeRepository;
  prisma?: PrismaService;
  foursquare?: FoursquareClient;
  /** PricingService — injected for check_availability (Phase 2 concierge expansion) */
  pricingService?: PricingService;
  /** ConciergeReviewService — injected for verify_stay_for_review + submit_guest_review (Phase 3) */
  conciergeReview?: ConciergeReviewService;
}

export interface ConciergeTool {
  name: string;
  schema: z.ZodTypeAny; // Zod v4 schema for arg validation in ConciergeToolExecutorService
  definition: ChatCompletionFunctionTool;
  handler(args: unknown, deps: ConciergeToolDeps): Promise<unknown>;
}

/**
 * CONCIERGE_TOOL_REGISTRY — map of tool name → tool definition + handler.
 *
 * Used by the SSE endpoint (08-02) to:
 * 1. Pass definitions to the OpenAI API (tools parameter)
 * 2. Dispatch tool_call results to the correct handler
 *
 * EXACTLY 10 entries — boot-time assertion in ConciergeModule.onModuleInit() will
 * throw an Error and prevent startup if this count changes.
 *
 * Phase 22 added: get_hotel_info, get_hotel_amenities, get_room_types_summary.
 * These tools receive deps.prisma (injected by ConciergeToolExecutorService).
 *
 * 2026-05-25: search_venues and get_venue_detail receive deps.foursquare (live Foursquare
 * API), no longer deps.repo for those two tools.
 *
 * 2026-06-03 (Phase 2): check_availability added — receives deps.prisma + deps.pricingService.
 *
 * 2026-06-03 (Phase 3): verify_stay_for_review + submit_guest_review added — receive
 * deps.conciergeReview (ConciergeReviewService). Write-capable tools.
 */
export const CONCIERGE_TOOL_REGISTRY: Record<string, ConciergeTool> = {
  // ── Bogotá city tools (Phase 08) ──────────────────────────────────────────
  search_venues: {
    name: SearchVenuesTool.name,
    schema: SearchVenuesTool.schema,
    definition: SearchVenuesTool.definition,
    handler: SearchVenuesTool.handler as ConciergeTool['handler'],
  },
  get_venue_detail: {
    name: GetVenueDetailTool.name,
    schema: GetVenueDetailTool.schema,
    definition: GetVenueDetailTool.definition,
    handler: GetVenueDetailTool.handler as ConciergeTool['handler'],
  },
  get_transport_info: {
    name: GetTransportInfoTool.name,
    schema: GetTransportInfoTool.schema,
    definition: GetTransportInfoTool.definition,
    handler: GetTransportInfoTool.handler as ConciergeTool['handler'],
  },
  get_event_info: {
    name: GetEventInfoTool.name,
    schema: GetEventInfoTool.schema,
    definition: GetEventInfoTool.definition,
    handler: GetEventInfoTool.handler as ConciergeTool['handler'],
  },
  // ── Hotel knowledge tools (Phase 22) ──────────────────────────────────────
  get_hotel_info: {
    name: GetHotelInfoTool.name,
    schema: GetHotelInfoTool.schema,
    definition: GetHotelInfoTool.definition,
    handler: GetHotelInfoTool.handler as ConciergeTool['handler'],
  },
  get_hotel_amenities: {
    name: GetHotelAmenitiesTool.name,
    schema: GetHotelAmenitiesTool.schema,
    definition: GetHotelAmenitiesTool.definition,
    handler: GetHotelAmenitiesTool.handler as ConciergeTool['handler'],
  },
  get_room_types_summary: {
    name: GetRoomTypesSummaryTool.name,
    schema: GetRoomTypesSummaryTool.schema,
    definition: GetRoomTypesSummaryTool.definition,
    handler: GetRoomTypesSummaryTool.handler as ConciergeTool['handler'],
  },
  // ── Booking handoff tools (Phase 2 concierge expansion, 2026-06-03) ────────
  check_availability: {
    name: CheckAvailabilityTool.name,
    schema: CheckAvailabilityTool.schema,
    definition: CheckAvailabilityTool.definition,
    handler: CheckAvailabilityTool.handler as ConciergeTool['handler'],
  },
  // ── Verified review tools (Phase 3 concierge expansion, 2026-06-03) ────────
  // These are write-capable tools. Writes are delegated to ConciergeReviewService.
  // Tool handler source files contain no prisma.*.create/update calls (CON-04 safe).
  verify_stay_for_review: {
    name: VerifyStayForReviewTool.name,
    schema: VerifyStayForReviewTool.schema,
    definition: VerifyStayForReviewTool.definition,
    handler: VerifyStayForReviewTool.handler as ConciergeTool['handler'],
  },
  submit_guest_review: {
    name: SubmitGuestReviewTool.name,
    schema: SubmitGuestReviewTool.schema,
    definition: SubmitGuestReviewTool.definition,
    handler: SubmitGuestReviewTool.handler as ConciergeTool['handler'],
  },
} as const;

/**
 * CONCIERGE_TOOL_DEFINITIONS — array of OpenAI tool definitions for the ChatCompletion API.
 *
 * Passed directly to `openai.chat.completions.create({ tools: CONCIERGE_TOOL_DEFINITIONS })`.
 */
export const CONCIERGE_TOOL_DEFINITIONS: ChatCompletionFunctionTool[] = Object.values(
  CONCIERGE_TOOL_REGISTRY,
).map((t) => t.definition);
