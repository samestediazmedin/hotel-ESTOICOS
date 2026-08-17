import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { ReviewsService } from './reviews.service';
import { moderateReviewSchema } from './dto/moderate-review.dto';

/**
 * ReviewsAdminController — staff moderation endpoints.
 *
 * Both routes require JwtAuthGuard + RolesGuard.
 * No @Roles() decorator is applied — RolesGuard allows any authenticated
 * user when requiredRoles is empty (all 4 roles can moderate per REV-06).
 */
@Controller('reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReviewsAdminController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * GET /api/reviews
   *
   * Returns three groups for the moderation queue:
   * pending (awaiting review), published (approved), rejected.
   */
  @Get()
  async queue(): Promise<{
    pending: any[];
    published: any[];
    rejected: any[];
  }> {
    return this.reviewsService.getAdminReviews();
  }

  /**
   * PATCH /api/reviews/:id/moderate
   *
   * Approves (sets moderated=true + publishedAt) or rejects (sets rejectedAt) a review.
   * Body: { action: 'approve' | 'reject' }
   */
  @Patch(':id/moderate')
  async moderate(
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<any> {
    const dto = moderateReviewSchema.parse(body);
    return this.reviewsService.moderateReview(id, dto.action);
  }
}
