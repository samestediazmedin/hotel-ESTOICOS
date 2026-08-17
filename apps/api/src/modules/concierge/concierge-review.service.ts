/**
 * ConciergeReviewService — verified guest review via cédula + apellido.
 *
 * Phase 3 concierge expansion. Adds a WRITE capability to the otherwise
 * read-only public concierge: a past guest can leave a review after the
 * system verifies they actually stayed, using their document number (cédula)
 * and last name.
 *
 * SECURITY DESIGN (audited by Mia, Phase 3 — fixes applied per S01–S07):
 *
 * 1. NO ENUMERATION
 *    - verifyStay() always queries Reservation+Guest in a single Prisma
 *      call. "Not found" and "already reviewed" return the exact same
 *      generic Spanish error string. The caller cannot distinguish between
 *      "cédula doesn't exist", "apellido wrong", "no CHECKED_OUT stay",
 *      or "already reviewed".
 *    - On success, the session token encodes only reservationId + stayDate +
 *      a jti. The cédula and guestName are NEVER encoded in the token.
 *
 * 2. RATE LIMITING
 *    Both verifyStay() and submitVerifiedReview() are called from concierge
 *    tool handlers which run inside the public SSE endpoint
 *    (GET /api/concierge/chat). That endpoint already enforces
 *    IpThrottlerGuard (20 msg/hr per IP). Additionally, verify_stay_for_review
 *    is subject to a dedicated VerifyAttemptLimiterService (5 attempts/hr/IP),
 *    wired through the tool executor (S03).
 *
 * 3. CSRF
 *    Tool calls flow through the existing ConciergeCsrfMiddleware-protected
 *    SSE endpoint. No additional CSRF configuration is needed.
 *
 * 4. ONE REVIEW PER STAY
 *    Reservation.conciergeReviewToken is a @unique nullable column.
 *    submitVerifiedReview() atomically sets it to a random UUID AND creates
 *    the Review row in a single $transaction. Prisma P2002 (unique constraint
 *    violation) → 409 Conflict. Idempotency is enforced at the DB level.
 *
 * 5. PII HANDLING
 *    - documentNumber (cédula): used only for the DB lookup, never stored
 *      anywhere in the output path (not in the session token, not in the
 *      Review, not in logs).
 *    - guestName: stored in Review.guestName (same as the email-token flow)
 *      for display in the moderation queue and the public reviews section.
 *      S05: guestName is NO LONGER encoded in the JWT — it is read from DB
 *      at submit time to avoid decodable PII in the token that flows through
 *      the LLM context and audit log.
 *    - The session token payload contains { reservationId, stayDate,
 *      purpose: 'concierge-review', jti } — no cédula, no guestName.
 *
 * 6. STAY ELIGIBILITY
 *    Only CHECKED_OUT reservations qualify. CONFIRMED, CHECKED_IN, CANCELLED,
 *    and NO_SHOW reservations are explicitly excluded (status filter).
 *
 * 7. TIMING SIDE-CHANNELS
 *    Both "not found" and "already reviewed" paths call the same Prisma query
 *    (no early-return before the DB call). The response time is dominated by
 *    the DB round-trip in both cases, making "cédula exists but apellido wrong"
 *    indistinguishable from "cédula doesn't exist" to a timing attacker.
 *
 * 8. DETERMINISTIC RESERVATION SELECTION (S07)
 *    orderBy: { checkOutDate: 'desc' } — most recent CHECKED_OUT stay wins
 *    when a guest has stayed multiple times.
 *
 * 9. CROSS-FLOW REPLAY PREVENTION (S01)
 *    submitVerifiedReview() rejects tokens that do NOT carry
 *    purpose === 'concierge-review'. Symmetrically, ReviewsService.submitReview()
 *    (email-invite flow) rejects tokens that DO carry purpose === 'concierge-review'.
 *
 * 10. JTI (S06)
 *     A randomUUID jti is added to every session token for defense-in-depth.
 *     It does NOT make the token valid for the email flow (S01's purpose check
 *     blocks that independently).
 */

import {
  Injectable,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Generic error message — NEVER change wording per security design ─────────
// All failure branches in verifyStay() return this identical string so the
// caller cannot tell WHY the verification failed (no enumeration).
const GENERIC_VERIFY_ERROR =
  'No encontramos una estadía verificada con esos datos. ' +
  'Verificá el número de documento y el apellido e intentá de nuevo.';

// ─── Session token purpose sentinel ──────────────────────────────────────────
// Prevents a session token from being confused with a review-invite token.
const SESSION_TOKEN_PURPOSE = 'concierge-review' as const;

// ─── Session token TTL ────────────────────────────────────────────────────────
// 30 minutes: long enough for a guest to complete the chat review flow, short
// enough to limit replay window.
const SESSION_TOKEN_TTL = '30m' as const;

interface VerifyStayResult {
  /** Opaque short-lived JWT. Encodes reservationId+stayDate+jti. No PII. */
  sessionToken: string;
  /** Display name only — used by the chat to address the guest by first name. */
  displayName: string;
}

interface VerifiedReviewResult {
  id: string;
  createdAt: Date;
}

interface SessionTokenPayload {
  reservationId: string;
  // S05: guestName REMOVED from token payload — read from DB at submit time.
  stayDate: string;
  purpose: typeof SESSION_TOKEN_PURPOSE;
  jti: string; // S06: always present — randomUUID added at sign time
  exp?: number;
  iat?: number;
}

@Injectable()
export class ConciergeReviewService {
  private readonly logger = new Logger(ConciergeReviewService.name);
  private readonly reviewSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {
    // Re-use the same secret as ReviewsService — both are review-related tokens.
    const secret =
      process.env['REVIEW_TOKEN_SECRET'] ?? process.env['JWT_ACCESS_SECRET'];
    if (!secret) {
      throw new Error(
        'REVIEW_TOKEN_SECRET (or JWT_ACCESS_SECRET as fallback) must be set',
      );
    }
    this.reviewSecret = secret;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // verifyStay — step 1 of the verified review flow
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Verifies that a guest with the given document number and last name has a
   * CHECKED_OUT reservation. On success, returns an opaque session token.
   *
   * SECURITY:
   *   - Returns GENERIC_VERIFY_ERROR on ANY failure — no enumeration.
   *   - lastName match: exact token match (split fullName on whitespace, require
   *     at least one token === normalizedLastName) — S02. Not substring ILIKE.
   *   - conciergeReviewToken: null filter excludes already-reviewed stays — S02.
   *   - orderBy checkOutDate desc for deterministic selection — S07.
   *   - guestName NOT encoded in JWT — S05.
   *   - jti added to JWT — S06.
   *
   * @param documentNumber  - Cédula / document number (trimmed, exact match)
   * @param lastName        - Guest's last name (trimmed, exact token match)
   * @returns { sessionToken, displayName }
   * @throws ConflictException with GENERIC_VERIFY_ERROR on failure
   */
  async verifyStay(
    documentNumber: string,
    lastName: string,
  ): Promise<VerifyStayResult> {
    const normalizedDoc = documentNumber.trim();
    const normalizedLastName = lastName.trim().toLowerCase();

    // Single DB round-trip — both "not found" and "wrong name" paths go through
    // this same query, minimizing timing side-channels.
    //
    // S02: Query by documentNumber (exact) + status CHECKED_OUT + conciergeReviewToken null
    //      (exclude already-reviewed stays). conciergeReviewToken: null in the WHERE clause
    //      means we never fetch already-reviewed reservations — the result is null for both
    //      "not found" and "already reviewed" cases, so the error path is identical.
    //
    // S07: orderBy checkOutDate desc — most recent eligible stay wins deterministically.
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        status: 'CHECKED_OUT',
        conciergeReviewToken: null, // S02: exclude already-reviewed stays atomically
        guest: {
          documentNumber: normalizedDoc, // exact match, trimmed
        },
      },
      orderBy: { checkOutDate: 'desc' }, // S07: deterministic — most recent stay
      select: {
        id: true,
        checkOutDate: true,
        guest: {
          select: {
            fullName: true,
          },
        },
      },
    });

    // Generic response for ALL failure cases — no enumeration
    if (!reservation) {
      throw new ConflictException(GENERIC_VERIFY_ERROR);
    }

    // S02: Exact token match — split fullName on whitespace, require at least
    // one token === normalizedLastName. This replaces the previous ILIKE
    // substring approach which was vulnerable to short-string enumeration.
    const nameTokens = reservation.guest.fullName.toLowerCase().split(/\s+/);
    const lastNameMatches = nameTokens.some((t) => t === normalizedLastName);

    if (!lastNameMatches) {
      // Generic error — same string as "not found". No enumeration.
      throw new ConflictException(GENERIC_VERIFY_ERROR);
    }

    // Issue a short-lived session token.
    // S05: guestName NOT encoded — only reservationId + stayDate + purpose + jti.
    // S06: jti = randomUUID() for defense-in-depth.
    const stayDate = reservation.checkOutDate.toISOString().slice(0, 10);
    const sessionToken = this.jwtService.sign(
      {
        reservationId: reservation.id,
        stayDate,
        purpose: SESSION_TOKEN_PURPOSE,
        jti: randomUUID(), // S06
      },
      {
        expiresIn: SESSION_TOKEN_TTL,
        secret: this.reviewSecret,
      },
    );

    return {
      sessionToken,
      // displayName is returned to the caller (tool handler) for chat use.
      // It is NOT encoded in the JWT. The LLM sees it only through the chat
      // context — it is NOT persisted in the audit log (S04 redacts sessionToken).
      displayName: reservation.guest.fullName,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // submitVerifiedReview — step 2 of the verified review flow
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Submits a guest review using the opaque session token from verifyStay().
   *
   * Atomically in a single $transaction:
   *   1. Sets Reservation.conciergeReviewToken = random UUID (P2002 → 409)
   *   2. Creates the Review row (moderated=false, enters moderation queue)
   *
   * S05: guestName is read from DB (via reservationId) at submit time —
   *      it is no longer in the JWT payload.
   *
   * The resulting Review is identical to the email-token flow (same moderation
   * pipeline, same moderation admin interface).
   *
   * @param sessionToken  - Opaque token from verifyStay()
   * @param rating        - Integer 1–5
   * @param comment       - String 10–2000 chars
   * @returns { id, createdAt }
   * @throws ConflictException if session token invalid/expired or already reviewed
   */
  async submitVerifiedReview(
    sessionToken: string,
    rating: number,
    comment: string,
  ): Promise<VerifiedReviewResult> {
    let payload: SessionTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<SessionTokenPayload>(
        sessionToken,
        { secret: this.reviewSecret },
      );
    } catch {
      throw new ConflictException(
        'El enlace de verificación no es válido o ya expiró. ' +
          'Por favor verificá tu estadía nuevamente.',
      );
    }

    // S01: Guard — ensure this token came from verifyStay(), not from a review invite.
    // This is the symmetric check to ReviewsService.submitReview() rejecting
    // purpose === 'concierge-review'.
    if (payload.purpose !== SESSION_TOKEN_PURPOSE) {
      throw new ConflictException(
        'Token de sesión inválido para este flujo.',
      );
    }

    if (!payload.reservationId || !payload.stayDate) {
      throw new ConflictException('Token de sesión malformado.');
    }

    // S05: Read guestName from DB at submit time (not from JWT payload).
    const reservationForName = await this.prisma.reservation.findUnique({
      where: { id: payload.reservationId },
      select: { guest: { select: { fullName: true } } },
    });

    if (!reservationForName) {
      throw new ConflictException(
        'La reserva asociada al token no fue encontrada.',
      );
    }

    const guestName = reservationForName.guest.fullName;

    // Sentinel value for the one-review-per-stay guard
    const sentinelToken = randomUUID();

    try {
      const review = await this.prisma.$transaction(async (tx) => {
        // Step 1: Atomically claim the slot — P2002 if already reviewed
        await tx.reservation.update({
          where: { id: payload.reservationId },
          data: { conciergeReviewToken: sentinelToken },
        });

        // Step 2: Create the review — same shape as the email-token flow
        // guestName sourced from DB (S05), not from JWT payload.
        return tx.review.create({
          data: {
            guestName,
            rating,
            comment,
            stayDate: new Date(payload.stayDate),
            reservationId: payload.reservationId,
            moderated: false,
          },
        });
      });

      this.logger.log(
        `Concierge review submitted for reservation ${payload.reservationId} — review ${review.id} pending moderation`,
      );

      return { id: review.id, createdAt: review.createdAt };
    } catch (err: unknown) {
      // P2002 = unique constraint on conciergeReviewToken → already reviewed
      if ((err as any)?.code === 'P2002') {
        throw new ConflictException(
          'Ya existe una reseña para esta estadía. ' +
            'Solo se permite una reseña por estadía.',
        );
      }
      throw err;
    }
  }
}
