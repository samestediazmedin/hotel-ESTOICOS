/**
 * verify-stay-for-review.tool.ts — OpenAI function-calling tool: verify_stay_for_review
 *
 * WRITE-CAPABLE TOOL (Phase 3 concierge expansion — verified guest review flow).
 *
 * This tool performs a STATE-CREATING operation (issues a session token tied to a
 * reservation lookup). However, it does NOT write to the database directly — it
 * delegates to ConciergeReviewService.verifyStay() which is injected into the
 * concierge deps bag. The tool handler source itself contains no prisma write calls,
 * so CON-04 (grep test) still passes.
 *
 * NOTE: concierge-tool-registry.spec.ts CON-04 greps tool handler FILES for
 * prisma.*.create/update/etc. This file contains none of those calls — the
 * actual DB write is in ConciergeReviewService. The spec comment for CON-04 is
 * updated to reflect that verify_stay_for_review and submit_guest_review are
 * intentionally write-capable via injected services.
 *
 * SECURITY:
 *   - The cédula (documentNumber) is forwarded to ConciergeReviewService and is
 *     NEVER stored in the tool result, NEVER returned to the LLM in plain form,
 *     and NEVER echoed back to the guest.
 *   - On failure, the tool returns a generic error that reveals no PII or
 *     enumeration information.
 *   - On success, only a sessionToken (opaque JWT) and a generic confirmation
 *     message are returned. The LLM is instructed not to repeat the cédula.
 *   - Rate limiting: this tool is called through the concierge SSE endpoint,
 *     which enforces IpThrottlerGuard (20 msg/hr per IP).
 */

import { z } from 'zod';
import type { ConciergeReviewService } from '../concierge-review.service';
import type { ConciergeRepository } from '../concierge.repository';

// ─── Input schema ─────────────────────────────────────────────────────────────

export const VerifyStayForReviewSchema = z
  .object({
    documentNumber: z
      .string()
      .trim()
      .min(4, 'El número de documento debe tener al menos 4 caracteres')
      .max(20, 'El número de documento no puede superar 20 caracteres'),
    lastName: z
      .string()
      .trim()
      .min(3, 'El apellido debe tener al menos 3 caracteres') // S02: raised from 2→3
      .max(60, 'El apellido no puede superar 60 caracteres'),
  })
  .strict();

export type VerifyStayForReviewArgs = z.infer<typeof VerifyStayForReviewSchema>;

// ─── Output types ─────────────────────────────────────────────────────────────

export interface VerifyStaySuccess {
  /** Opaque session token. Must be passed to submit_guest_review. Valid for 30 min. */
  sessionToken: string;
  /** Neutral confirmation — does NOT echo back cédula or full name. */
  message: string;
}

export interface VerifyStayError {
  error: string;
  message: string;
}

// ─── Tool definition ──────────────────────────────────────────────────────────

export const VerifyStayForReviewTool = {
  name: 'verify_stay_for_review' as const,
  schema: VerifyStayForReviewSchema,

  definition: {
    type: 'function' as const,
    function: {
      name: 'verify_stay_for_review',
      description:
        'Verifies that a guest stayed at the hotel by matching their document number ' +
        '(cédula) and last name against a checked-out reservation. ' +
        'Returns an opaque session token that must be passed to submit_guest_review. ' +
        'Use this ONLY when a guest explicitly wants to leave a review and provides ' +
        'their cédula and apellido. ' +
        'SECURITY RULES: ' +
        '(1) NEVER reveal whether the cédula exists in the system. ' +
        '(2) NEVER echo back the cédula or full name in your response. ' +
        '(3) On success, just confirm verification succeeded and ask for the rating/comment. ' +
        '(4) On error, use only the generic message provided — do not speculate about the cause.',
      parameters: {
        type: 'object',
        properties: {
          documentNumber: {
            type: 'string',
            description:
              'Guest document number / cédula (exactly as provided by the guest)',
          },
          lastName: {
            type: 'string',
            description: "Guest's last name (apellido, as provided by the guest)",
          },
        },
        required: ['documentNumber', 'lastName'],
      },
    },
  },

  async handler(
    args: VerifyStayForReviewArgs,
    deps: {
      repo: ConciergeRepository;
      conciergeReview?: ConciergeReviewService;
    },
  ): Promise<VerifyStaySuccess | VerifyStayError> {
    if (!deps.conciergeReview) {
      return {
        error: 'service_unavailable',
        message:
          'El servicio de verificación no está disponible en este momento. ' +
          'Por favor intentá más tarde o contactá a recepción.',
      };
    }

    try {
      const result = await deps.conciergeReview.verifyStay(
        args.documentNumber,
        args.lastName,
      );

      return {
        sessionToken: result.sessionToken,
        // SECURITY: only a neutral confirmation — no PII, no name echoed
        message:
          'Verificación exitosa. Tu estadía fue confirmada. ' +
          'Ahora podés dejar tu reseña.',
      };
    } catch (err: unknown) {
      // Surface the service's generic message — do not leak internal details
      const message =
        err instanceof Error
          ? err.message
          : 'No pudimos verificar tu estadía. Por favor intentá de nuevo.';

      return {
        error: 'verification_failed',
        message,
      };
    }
  },
};
