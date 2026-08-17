import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  Header,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { ReviewsService } from './reviews.service';
import { submitReviewSchema } from './dto/submit-review.dto';
import { publicReviewsQuerySchema } from './dto/public-reviews-query.dto';

/**
 * ReviewsPublicController — public endpoints for the guest review flow.
 *
 * All endpoints are unauthenticated (no JwtAuthGuard).
 * POST submit is rate-limited to 5/IP/hour via the dedicated
 * 'reviews-submit' named throttler registered in ReviewsModule.
 *
 * Route registration order matters for NestJS route matching:
 * GET /reviews/validate-token MUST be registered before any /:id route
 * to prevent NestJS from matching 'validate-token' as the :id param.
 */
@Controller('public')
@UseGuards(ThrottlerGuard)
export class ReviewsPublicController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * POST /api/public/reviews
   *
   * Submits a guest review using a one-time JWT token.
   * Rate-limited to 5 submissions per IP per hour.
   */
  @Post('reviews')
  @Throttle({ 'reviews-submit': { limit: 5, ttl: 3_600_000 } })
  async submit(@Body() body: unknown): Promise<{ id: string; createdAt: Date }> {
    const dto = submitReviewSchema.parse(body);
    return this.reviewsService.submitReview(dto);
  }

  /**
   * GET /api/public/reviews/validate-token?token=...
   *
   * Validates a review invite token and returns guest info for form prefill.
   * Registered BEFORE the list route to avoid NestJS route ambiguity.
   */
  @Get('reviews/validate-token')
  async validateToken(
    @Query('token') token: string,
  ): Promise<{ guestName: string; stayDate: string; alreadySubmitted: boolean }> {
    if (!token) {
      throw new BadRequestException('token query parameter is required');
    }
    return this.reviewsService.validateToken(token);
  }

  /**
   * GET /api/public/reviews?page=N&limit=M
   *
   * Returns paginated published reviews with server-side aggregated rating.
   * Cache-Control 60s allows CDN to serve stale for up to 1 minute.
   */
  @Get('reviews')
  @Throttle({ default: { limit: 100, ttl: 60_000 } }) // 100/min for read-only public data
  @Header('Cache-Control', 'public, max-age=60, s-maxage=60')
  async list(@Query() query: unknown): Promise<{
    reviews: any[];
    total: number;
    averageRating: number;
    pages: number;
  }> {
    const dto = publicReviewsQuerySchema.parse(query);
    return this.reviewsService.getPublicReviews(dto);
  }
}
