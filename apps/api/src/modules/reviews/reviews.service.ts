import {
  Injectable,
  UnauthorizedException,
  GoneException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { subDays } from 'date-fns';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { SubmitReviewDto } from './dto/submit-review.dto';
import { PublicReviewsQueryDto } from './dto/public-reviews-query.dto';
import { EmailService } from '../email/email.service';
import { SystemConfigService } from '../../system-config/system-config.service';

interface ReviewSubmitTokenPayload {
  reservationId: string;
  guestName: string;
  stayDate: string; // ISO date string
  jti: string;
  /** S01: concierge-review tokens carry this claim — must be rejected here. */
  purpose?: string;
  exp?: number;
  iat?: number;
}

interface ValidateTokenResult {
  guestName: string;
  stayDate: string;
  alreadySubmitted: boolean;
}

interface SignTokenResult {
  token: string;
  jti: string;
}

interface PublicReviewsResult {
  reviews: any[];
  total: number;
  averageRating: number;
  pages: number;
}

interface AdminReviewsResult {
  pending: any[];
  published: any[];
  rejected: any[];
}

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  private readonly reviewSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly systemConfig: SystemConfigService,
  ) {
    const secret = process.env.REVIEW_TOKEN_SECRET || process.env.JWT_ACCESS_SECRET;
    if (!secret) {
      throw new Error(
        'REVIEW_TOKEN_SECRET (or JWT_ACCESS_SECRET as fallback) must be set',
      );
    }
    this.reviewSecret = secret;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Token operations
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Signs a review invite token for a given reservation.
   * Used by the night-audit cron after a CHECKED_OUT event.
   */
  signReviewToken(params: {
    reservationId: string;
    guestName: string;
    stayDate: Date;
  }): SignTokenResult {
    const jti = randomUUID();
    const token = this.jwtService.sign(
      {
        reservationId: params.reservationId,
        guestName: params.guestName,
        stayDate: params.stayDate.toISOString().slice(0, 10),
        jti,
      },
      {
        expiresIn: '90d',
        secret: this.reviewSecret,
      },
    );
    return { token, jti };
  }

  /**
   * Validates a review invite token.
   * Returns guest info for prefill and alreadySubmitted flag.
   */
  async validateToken(token: string): Promise<ValidateTokenResult> {
    let payload: ReviewSubmitTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<ReviewSubmitTokenPayload>(token, {
        secret: this.reviewSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (!payload.reservationId || !payload.guestName || !payload.stayDate || !payload.jti) {
      throw new UnauthorizedException('Malformed review token');
    }

    // Check if the token's jti has already been consumed
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: payload.reservationId },
      select: { reviewTokenJtiUsed: true },
    });

    const alreadySubmitted =
      reservation !== null && reservation.reviewTokenJtiUsed === payload.jti;

    return {
      guestName: payload.guestName,
      stayDate: payload.stayDate,
      alreadySubmitted,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Submission
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Submits a guest review using a one-time JWT token.
   * Uses a DB transaction to atomically:
   *   1. Mark the token as used (Reservation.reviewTokenJtiUsed = jti)
   *   2. Create the Review row
   * Catches Prisma P2002 (unique constraint) → 410 Gone (token already used).
   */
  async submitReview(dto: SubmitReviewDto): Promise<{
    id: string;
    createdAt: Date;
  }> {
    let payload: ReviewSubmitTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<ReviewSubmitTokenPayload>(dto.token, {
        secret: this.reviewSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // S01: Reject concierge-review session tokens — they must not be replayed
    // against this endpoint. The email-invite flow is entirely separate and
    // must not accept tokens from the cédula+apellido verification flow.
    if (payload.purpose === 'concierge-review') {
      throw new UnauthorizedException('Invalid token type for this endpoint');
    }

    // S01: Reject tokens with no jti — the email flow ALWAYS has a jti.
    // A null/undefined jti would bypass the reviewTokenJtiUsed uniqueness guard
    // (NULL != NULL in Postgres, so the P2002 unique constraint would not fire).
    if (!payload.jti) {
      throw new UnauthorizedException('Token missing required jti claim');
    }

    if (!payload.reservationId) {
      throw new UnauthorizedException('Token missing reservation reference');
    }

    const reservation = await this.prisma.reservation.findUnique({
      where: { id: payload.reservationId },
    });

    if (!reservation) {
      throw new UnauthorizedException('Reservation not found');
    }

    try {
      const review = await this.prisma.$transaction(async (tx) => {
        // Attempt to mark JTI as used — P2002 if already consumed
        await tx.reservation.update({
          where: { id: payload.reservationId },
          data: { reviewTokenJtiUsed: payload.jti },
        });

        // Create the review row
        return tx.review.create({
          data: {
            guestName: payload.guestName,
            rating: dto.rating,
            comment: dto.comment,
            stayDate: new Date(payload.stayDate),
            reservationId: payload.reservationId,
            moderated: false,
          },
        });
      });

      return { id: review.id, createdAt: review.createdAt };
    } catch (err: any) {
      if (err?.code === 'P2002') {
        // Unique constraint violation on reviewTokenJtiUsed — token already used
        throw new GoneException('Este enlace de reseña ya fue utilizado');
      }
      throw err;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Public queries
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Returns paginated published reviews with server-side aggregated rating.
   * averageRating is computed from ALL published reviews, not just the current page.
   */
  async getPublicReviews(dto: PublicReviewsQueryDto): Promise<PublicReviewsResult> {
    const { page, limit } = dto;
    const where = {
      moderated: true,
      publishedAt: { not: null as unknown as Date },
    };

    const [reviews, total, aggResult] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          guestName: true,
          rating: true,
          comment: true,
          stayDate: true,
          publishedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.aggregate({
        where,
        _avg: { rating: true },
      }),
    ]);

    const averageRating = Number(aggResult._avg.rating ?? 0);
    const pages = total === 0 ? 0 : Math.ceil(total / limit);

    return { reviews, total, averageRating, pages };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Admin / moderation
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Returns three review groups for the moderation queue:
   * - pending: moderated=false AND rejectedAt=null
   * - published: moderated=true
   * - rejected: rejectedAt is not null
   */
  async getAdminReviews(): Promise<AdminReviewsResult> {
    const [pending, published, rejected] = await Promise.all([
      this.prisma.review.findMany({
        where: { moderated: false, rejectedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.findMany({
        where: { moderated: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.findMany({
        where: { rejectedAt: { not: null } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { pending, published, rejected };
  }

  /**
   * Approves or rejects a review.
   * approve → sets moderated=true, publishedAt=now(), clears rejectedAt
   * reject  → sets rejectedAt=now(), clears moderated/publishedAt
   */
  async moderateReview(id: string, action: 'approve' | 'reject'): Promise<any> {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) {
      throw new NotFoundException(`Review ${id} not found`);
    }

    if (action === 'approve') {
      return this.prisma.review.update({
        where: { id },
        data: {
          moderated: true,
          publishedAt: new Date(),
          rejectedAt: null,
        },
      });
    }

    // reject
    return this.prisma.review.update({
      where: { id },
      data: {
        moderated: false,
        publishedAt: null,
        rejectedAt: new Date(),
      },
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Night-audit integration (REV-07 — Plan 14-02)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * sendPendingReviewInvites — called by NightAuditService after the main audit completes.
   *
   * For each CHECKED_OUT reservation from yesterday that has not yet received an invite:
   * 1. Signs a 90-day single-use JWT token
   * 2. Sends a review-invite email via Resend (EmailService.sendReviewInvite — re-throws on failure)
   * 3. Marks reviewInviteSentAt = now() ONLY on confirmed delivery
   *
   * Per-reservation try/catch: a Resend failure skips the stamp so next cron run retries.
   * Process is sequential — low volume in a single-tenant hotel, easier partial-failure handling.
   */
  async sendPendingReviewInvites(businessDate: Date): Promise<void> {
    const yesterday = subDays(businessDate, 1);
    const hotelName = await this.systemConfig.getHotelName();
    const frontendBaseUrl = process.env.FRONTEND_BASE_URL ?? 'http://localhost:5173';

    const reservations = await this.prisma.reservation.findMany({
      where: {
        status: 'CHECKED_OUT',
        checkOutDate: yesterday,
        reviewInviteSentAt: null,
        guest: { email: { not: null } },
      },
      include: { guest: true },
    });

    for (const reservation of reservations) {
      try {
        const stayDate = reservation.checkOutDate.toISOString().slice(0, 10);
        const { token } = this.signReviewToken({
          reservationId: reservation.id,
          guestName: reservation.guest.fullName,
          stayDate: new Date(stayDate),
        });
        const reviewLink = `${frontendBaseUrl}/review/submit?token=${token}`;

        await this.emailService.sendReviewInvite({
          to: reservation.guest.email!,
          guestName: reservation.guest.fullName,
          hotelName,
          stayDate,
          reviewLink,
        });

        // Stamp ONLY after confirmed delivery (P1 pitfall — never stamp before send)
        await this.prisma.reservation.update({
          where: { id: reservation.id },
          data: { reviewInviteSentAt: new Date() },
        });
      } catch (err) {
        this.logger.error(
          `Review invite failed for reservation ${reservation.id} — will retry on next cron run`,
          err,
        );
        // Continue to next reservation — do not abort the batch
      }
    }
  }
}
