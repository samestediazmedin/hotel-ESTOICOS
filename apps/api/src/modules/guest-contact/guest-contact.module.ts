import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { GuestContactController } from './guest-contact.controller';
import { GuestContactService } from './guest-contact.service';
import { GuestContactRepository } from './guest-contact.repository';
import { GuestContactGateway } from './guest-contact.gateway';

/**
 * GuestContactModule — REST endpoints + Socket.io gateway for guest contact events.
 *
 * PrismaModule is @Global — no import needed.
 * SharedModule (JwtAuthGuard, RolesGuard) is @Global — no import needed.
 *
 * JwtModule registered locally (JwtModule.register({})) so GuestContactGateway
 * can inject JwtService for handshake JWT verification — same pattern as
 * HousekeepingModule.
 *
 * GuestContactGateway MUST be in providers[] — NestJS discovers WebSocket
 * gateways via the DI container (P2).
 *
 * DI direction: GuestContactService → GuestContactGateway (one-way).
 * Gateway NEVER imports Service (no circular dependency).
 */
@Module({
  imports: [
    // CRITICAL: JwtModule required for GuestContactGateway handshake auth
    JwtModule.register({}),
  ],
  controllers: [GuestContactController],
  providers: [
    GuestContactService,
    GuestContactRepository,
    // GuestContactGateway: Socket.io gateway — MUST be in providers (P2)
    GuestContactGateway,
  ],
  exports: [GuestContactService],
})
export class GuestContactModule {}
