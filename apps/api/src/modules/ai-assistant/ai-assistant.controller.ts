import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  NotFoundException,
  BadRequestException,
  UseGuards,
  Sse,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { MessageEvent } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { ConversationRepository } from './conversation.repository';
import { AiAssistantService } from './ai-assistant.service';
import { UserThrottlerGuard } from './guards/user-throttler.guard';
import { ChatQuerySchema } from './dto/chat-query.dto';
import { sanitizeInput } from './sanitize';
import type { ConversationListItemDto, ConversationDetailDto } from './dto/conversation-response.dto';

interface JwtUser {
  id: string;
  email: string;
  role: string;
}

/**
 * AiAssistantController — REST endpoints for conversation management + SSE streaming.
 *
 * AI-08: All endpoints are protected by JwtAuthGuard at class level.
 * AI-10: UserThrottlerGuard is applied at the @Sse('stream') METHOD level only.
 *        NOT at class level, NOT as global APP_GUARD (W5 pattern from Phase 03-04).
 *        This ensures staff endpoints (reservations, inventory, etc.) are never throttled.
 * AI-11: Conversation list is ordered by lastMessageAt DESC (handled in repo).
 *
 * SSE endpoint uses GET (not POST) because EventSource API requires GET.
 * The JWT token is passed via Authorization header using fetch+ReadableStream on frontend.
 *
 * Security:
 * - GET /conversations/:id returns 404 (not 403) for other users' conversations.
 *   This prevents the existence of a conversation from being leaked.
 * - sanitizeInput() is applied to message query param before passing to service.
 */
@Controller('ai-assistant')
@UseGuards(JwtAuthGuard)
export class AiAssistantController {
  constructor(
    private readonly convRepo: ConversationRepository,
    private readonly aiService: AiAssistantService,
  ) {}

  /**
   * GET /api/ai-assistant/stream?message=...&conversationId=...
   *
   * Streams AI responses as Server-Sent Events (AI-02).
   * JWT is validated by JwtAuthGuard (class level) before the SSE handshake.
   * Per-user throttle is applied by UserThrottlerGuard at this method only.
   *
   * W5 fix: @UseGuards(UserThrottlerGuard) is on this @Sse method ONLY.
   * This does NOT throttle other controller methods or any other controller.
   */
  @Sse('stream')
  @UseGuards(UserThrottlerGuard)
  stream(
    @Query() rawQuery: Record<string, string>,
    @CurrentUser() user: JwtUser,
  ): Observable<MessageEvent> {
    const parsed = ChatQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues); // Zod v4 .issues convention
    }
    return this.aiService.streamChat(
      {
        sanitizedMessage: sanitizeInput(parsed.data.message),
        conversationId: parsed.data.conversationId,
      },
      user,
    );
  }

  /**
   * GET /api/ai-assistant/conversations
   * Returns the caller's conversation list, ordered by lastMessageAt DESC.
   */
  @Get('conversations')
  async list(@CurrentUser() user: JwtUser): Promise<ConversationListItemDto[]> {
    return this.convRepo.listForUser(user.id);
  }

  /**
   * GET /api/ai-assistant/conversations/:id
   * Returns a specific conversation with all messages.
   * Returns 404 if not found OR if it belongs to a different user (AI-08).
   */
  @Get('conversations/:id')
  async load(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ConversationDetailDto> {
    const conv = await this.convRepo.loadForUser(id, user.id);
    if (!conv) throw new NotFoundException('Conversation not found');
    return conv;
  }

  /**
   * POST /api/ai-assistant/conversations
   * Creates an empty conversation. Returns { id } for the client to use
   * when sending the first message via the streaming endpoint.
   */
  @Post('conversations')
  async create(@CurrentUser() user: JwtUser): Promise<{ id: string }> {
    return this.convRepo.create(user.id);
  }
}
