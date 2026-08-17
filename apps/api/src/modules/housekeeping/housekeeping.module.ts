import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { HousekeepingController } from './housekeeping.controller';
import { HousekeepingService } from './housekeeping.service';
import { HousekeepingRepository } from './housekeeping.repository';
import { HousekeepingGateway } from './housekeeping.gateway';
import { CleaningDomainExceptionFilter } from './cleaning-exception.filter';
import { CheckoutListener } from './listeners/checkout.listener';

/**
 * HousekeepingModule — cleaning state machine + task CRUD + WebSocket gateway.
 *
 * PrismaModule is @Global — no import needed.
 * SharedModule (JwtAuthGuard, RolesGuard) is @Global — no import needed.
 * EventEmitterModule is registered globally in AppModule — CheckoutListener
 *   can inject EventEmitter2 without importing EventEmitterModule here.
 *
 * JwtModule is registered locally (not re-exported from AuthModule) so
 * HousekeepingGateway can inject JwtService for handshake JWT verification.
 * Registered with register({}) — secrets are passed at verify/sign call time
 * (same pattern as AuthModule: JwtService.verifyAsync(token, { secret: ... })).
 *
 * HousekeepingGateway MUST be in providers[] — NestJS discovers WebSocket
 * gateways via the DI container, NOT via a separate module system (P2).
 *
 * CleaningDomainExceptionFilter is scoped to this module via APP_FILTER provider.
 * This converts CleaningDomainException → HTTP 400 for all housekeeping endpoints.
 *
 * Exports HousekeepingService for potential future cross-module use.
 */
@Module({
  imports: [
    // JwtModule required for HousekeepingGateway: injects JwtService for
    // handshake auth in handleConnection (not @UseGuards — connection-level auth)
    JwtModule.register({}),
  ],
  controllers: [HousekeepingController],
  providers: [
    HousekeepingService,
    HousekeepingRepository,
    // HousekeepingGateway: Socket.io gateway — MUST be in providers (P2)
    // NestJS initializes @WebSocketServer() automatically when the gateway is provided
    HousekeepingGateway,
    // CheckoutListener: @OnEvent('reservation.checked_out') → forceTransitionToDirty
    // EventEmitter2 is injectable globally (EventEmitterModule.forRoot({ global: true }) in AppModule)
    CheckoutListener,
    // CleaningDomainException → HTTP 400 (scoped to this module)
    {
      provide: APP_FILTER,
      useClass: CleaningDomainExceptionFilter,
    },
  ],
  exports: [HousekeepingService],
})
export class HousekeepingModule {}
