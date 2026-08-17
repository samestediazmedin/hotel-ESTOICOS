/**
 * submit-guest-review.tool.ts — OpenAI function-calling tool: submit_guest_review
 *
 * WRITE-CAPABLE TOOL (Phase 3 concierge expansion — verified guest review flow).
 *
 * This tool creates a Review row. The write is delegated to
 * ConciergeReviewService.submitVerifiedReview() — the tool handler source
 * itself contains no prisma.*.create/update calls, so CON-04 (grep test) passes.
 *
 * SECURITY:
 *   - Requires a valid session token from verify_stay_for_review (30-minute TTL,
 *     signed JWT with purpose='concierge-review'). Expired or forged tokens are
 *     rejected by the service.
 *   - Rating is validated as integer 1–5 here (Zod) and enforced at DB level.
 *   - Comment is validated as 10–2000 chars (same as the email-token flow).
 *   - Created Review has moderated=false — it enters the staff moderation queue
 *     exactly like the email-token flow. It will NOT be publicly visible until
 *     a staff member approves it.
 *   - One-review-per-stay: Reservation.conciergeReviewToken @unique enforces
 *     this at DB level. Prisma P2002 → ConciergeReviewService throws 409,
 *     this tool returns { error: 'already_reviewed', message: ... }.
 *
 * Note on CON-04:
 *   The concierge-tool-registry.spec.ts grep test checks that tool handler FILES
 *   do not call prisma write methods. This file contains no such calls — writes
 *   happen in the injected ConciergeReviewService. This is the established pattern
 *   for write-capable tools: delegate to a service, never write directly from tools.
 */

import { z } from 'zod';
import type { ConciergeReviewService } from '../concierge-review.service';
import type { ConciergeRepository } from '../concierge.repository';

// ─── Input schema ─────────────────────────────────────────────────────────────

export const SubmitGuestReviewSchema = z
  .object({
    sessionToken: z
      .string()
      .min(10, 'sessionToken inválido — verificá tu estadía primero'),
    rating: z
      .number()
      .int('La calificación debe ser un número entero')
      .min(1, 'La calificación mínima es 1')
      .max(5, 'La calificación máxima es 5'),
    comment: z
      .string()
      .trim()
      .min(10, 'El comentario debe tener al menos 10 caracteres')
      .max(2000, 'El comentario no puede superar 2000 caracteres'),
  })
  .strict();

export type SubmitGuestReviewArgs = z.infer<typeof SubmitGuestReviewSchema>;

// ─── Output types ─────────────────────────────────────────────────────────────

export interface SubmitReviewSuccess {
  reviewId: string;
  message: string;
}

export interface SubmitReviewError {
  error: string;
  message: string;
}

// ─── Tool definition ──────────────────────────────────────────────────────────

export const SubmitGuestReviewTool = {
  name: 'submit_guest_review' as const,
  schema: SubmitGuestReviewSchema,

  definition: {
    type: 'function' as const,
    function: {
      name: 'submit_guest_review',
      description:
        'Submits a guest review after stay verification. ' +
        'Requires a valid sessionToken from verify_stay_for_review. ' +
        'The review will be reviewed by hotel staff before being published publicly. ' +
        'Use this only AFTER verify_stay_for_review succeeds and the guest provides ' +
        'a rating (1–5) and a comment (10–2000 characters). ' +
        'Tell the guest their review will be moderated before appearing on the site.',
      parameters: {
        type: 'object',
        properties: {
          sessionToken: {
            type: 'string',
            description:
              'Opaque session token returned by verify_stay_for_review (valid 30 min)',
          },
          rating: {
            type: 'number',
            description: 'Star rating from 1 (lowest) to 5 (highest)',
          },
          comment: {
            type: 'string',
            description:
              'Guest review comment. Minimum 10, maximum 2000 characters.',
          },
        },
        required: ['sessionToken', 'rating', 'comment'],
      },
    },
  },

  async handler(
    args: SubmitGuestReviewArgs,
    deps: {
      repo: ConciergeRepository;
      conciergeReview?: ConciergeReviewService;
    },
  ): Promise<SubmitReviewSuccess | SubmitReviewError> {
    if (!deps.conciergeReview) {
      return {
        error: 'service_unavailable',
        message:
          'El servicio de reseñas no está disponible en este momento. ' +
          'Por favor intentá más tarde o contactá a recepción.',
      };
    }

    try {
      const result = await deps.conciergeReview.submitVerifiedReview(
        args.sessionToken,
        args.rating,
        args.comment,
      );

      return {
        reviewId: result.id,
        message:
          '¡Gracias por tu reseña! Fue enviada correctamente y será revisada ' +
          'por nuestro equipo antes de publicarse. ' +
          'Tu opinión nos ayuda a mejorar.',
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'No pudimos enviar tu reseña. Por favor intentá de nuevo.';

      // Distinguish already-reviewed from other errors for the LLM
      const isAlreadyReviewed =
        typeof message === 'string' &&
        message.includes('Ya existe una reseña');

      return {
        error: isAlreadyReviewed ? 'already_reviewed' : 'submission_failed',
        message,
      };
    }
  },
};
